import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_CURRENCY, STORE_ID } from "./config";
import { countryFromEmail, countryFromPhone } from "./country";
import type { CartItem } from "./types";

/**
 * Dados da aba "Ao vivo" (/admin/vendas): últimos pedidos enriquecidos, resumo por período
 * (hoje, ontem, 7 dias, 30 dias, geral), série diária e por hora, formas de pagamento, funil de
 * carrinhos e "insights". Usado pela página (render inicial) e por /api/admin/live-orders (polling).
 *
 * Tudo é calculado em memória a partir de UMA consulta (colunas mínimas de todos os pedidos da loja)
 * + 3 contagens de carrinhos. Cache de alguns segundos por instância para várias guias abertas não
 * multiplicarem consultas no Supabase.
 */

const TZ = "Europe/London";
const RECENT_LIMIT = 80;
const MAX_ROWS = 10000;
const CACHE_MS = 3000;

interface RawOrder {
  id: string;
  external_order_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number | string | null;
  currency: string | null;
  items: CartItem[] | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  payment_confirmed_at: string | null;
}

export interface LiveOrder {
  id: string;
  external_order_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number;
  currency: string;
  items: CartItem[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  payment_confirmed_at: string | null;
  /** ISO-2 (FR, GB...) deduzido do telefone/e-mail */
  country: string | null;
  /** quantos pedidos este contato fez hoje (tentativas) */
  attempts_today: number;
  /** já tinha comprado antes deste pedido */
  returning: boolean;
  /** pedido recusado cujo contato acabou pagando depois */
  paid_later: boolean;
}

export interface Period {
  key: "today" | "yesterday" | "week" | "month" | "all";
  label: string;
  paid: number;
  refused: number;
  pending: number;
  revenue: number;
  avgTicket: number | null;
  /** aprovados / (aprovados + recusados), em % — null sem tentativas */
  rate: number | null;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD (Londres)
  label: string; // dd/MM
  weekday: string; // seg, ter...
  paid: number;
  refused: number;
  revenue: number;
}

export interface HourPoint {
  hour: number;
  paid: number;
  refused: number;
}

export interface MethodStat {
  method: string;
  paid: number;
  refused: number;
  revenue: number;
  rate: number | null;
}

export interface LiveSnapshot {
  orders: LiveOrder[];
  periods: Record<Period["key"], Period>;
  days: DayPoint[];
  hours: HourPoint[];
  methods: MethodStat[];
  carts: { abandonedToday: number; recoveredToday: number; openAbandoned: number };
  insights: {
    lastPaidAt: string | null;
    lastRefusedAt: string | null;
    refusedThenPaid30d: number;
    returningPaid30d: number;
    bestDay: { label: string; revenue: number } | null;
    bestHour: { hour: number; paid: number } | null;
    /** recusados consecutivos entre os pedidos mais recentes (alerta de gateway/antifraude) */
    refusedStreak: number;
    firstOrderAt: string | null;
    totalOrders: number;
  };
  currency: string;
  /** ISO — relógio do servidor, base para "há X s" sem divergência de hidratação */
  now: string;
}

const COLS = "id,external_order_id,status,payment_status,payment_method,total,currency,items,customer_name,customer_email,customer_phone,created_at,updated_at,payment_confirmed_at";

// ---------------------------------------------------------------------------
// Datas no fuso da loja
// ---------------------------------------------------------------------------
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });

function dayKey(d: Date): string {
  return dayFmt.format(d); // YYYY-MM-DD
}
function hourOf(d: Date): number {
  const h = Number.parseInt(hourFmt.format(d), 10);
  return h === 24 ? 0 : h;
}
function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d + days, 12)));
}
function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}
function weekdayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return weekdayFmt.format(new Date(Date.UTC(y, m - 1, d, 12))).replace(".", "");
}
/** Início do dia (chave YYYY-MM-DD de Londres) em ISO UTC. */
function startOfDayIso(key: string, now: Date): string {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(now).find((x) => x.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(p);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - offsetMin * 60e3).toISOString();
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------
function contactKey(o: Pick<RawOrder, "customer_email" | "customer_phone">): string | null {
  const e = o.customer_email?.trim().toLowerCase();
  if (e) return `e:${e}`;
  const p = o.customer_phone?.replace(/\D/g, "");
  return p ? `p:${p}` : null;
}

function emptyPeriod(key: Period["key"], label: string): Period {
  return { key, label, paid: 0, refused: 0, pending: 0, revenue: 0, avgTicket: null, rate: null };
}
function addToPeriod(p: Period, o: RawOrder) {
  const total = Number(o.total) || 0;
  if (o.payment_status === "paid") {
    p.paid += 1;
    p.revenue += total;
  } else if (o.payment_status === "refused") p.refused += 1;
  else if (o.payment_status === "pending") p.pending += 1;
}
function finishPeriod(p: Period): Period {
  const attempts = p.paid + p.refused;
  p.rate = attempts ? Math.round((p.paid / attempts) * 1000) / 10 : null;
  p.avgTicket = p.paid ? Math.round((p.revenue / p.paid) * 100) / 100 : null;
  p.revenue = Math.round(p.revenue * 100) / 100;
  return p;
}
function rateOf(paid: number, refused: number): number | null {
  const n = paid + refused;
  return n ? Math.round((paid / n) * 1000) / 10 : null;
}

function normalizeMethod(m: string | null): string {
  const s = (m || "").trim().toLowerCase();
  if (!s) return "outro";
  if (s.includes("card") || s.includes("credit") || s.includes("cart")) return "cartão";
  if (s.includes("pix")) return "pix";
  if (s.includes("boleto")) return "boleto";
  if (s.includes("paypal")) return "paypal";
  if (s.includes("apple")) return "apple pay";
  if (s.includes("google")) return "google pay";
  return s;
}

function build(rows: RawOrder[], carts: LiveSnapshot["carts"], now: Date): LiveSnapshot {
  const todayKey = dayKey(now);
  const yesterdayKey = shiftDay(todayKey, -1);
  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => shiftDay(todayKey, -i)));
  const monthKeys = new Set(Array.from({ length: 30 }, (_, i) => shiftDay(todayKey, -i)));
  const dayKeys14 = Array.from({ length: 14 }, (_, i) => shiftDay(todayKey, i - 13));

  const periods: Record<Period["key"], Period> = {
    today: emptyPeriod("today", "Hoje"),
    yesterday: emptyPeriod("yesterday", "Ontem"),
    week: emptyPeriod("week", "7 dias"),
    month: emptyPeriod("month", "30 dias"),
    all: emptyPeriod("all", "Geral"),
  };
  const days = new Map<string, DayPoint>(dayKeys14.map((k) => [k, { date: k, label: dayLabel(k), weekday: weekdayOf(k), paid: 0, refused: 0, revenue: 0 }]));
  const hours: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, paid: 0, refused: 0 }));
  const hours30: number[] = Array(24).fill(0);
  const methods = new Map<string, MethodStat>();

  // pagos por contato (para "recorrente" e "pagou depois")
  const paidByContact = new Map<string, number[]>();
  const attemptsToday = new Map<string, number>();
  for (const o of rows) {
    const c = contactKey(o);
    if (!c) continue;
    if (o.payment_status === "paid") {
      const arr = paidByContact.get(c) ?? [];
      arr.push(new Date(o.created_at).getTime());
      paidByContact.set(c, arr);
    }
    if (dayKey(new Date(o.created_at)) === todayKey) attemptsToday.set(c, (attemptsToday.get(c) ?? 0) + 1);
  }

  let lastPaidAt: string | null = null;
  let lastRefusedAt: string | null = null;
  let refusedThenPaid30d = 0;
  let returningPaid30d = 0;
  let firstOrderAt: string | null = null;

  const enriched = new Map<string, LiveOrder>();
  for (const o of rows) {
    const created = new Date(o.created_at);
    const key = dayKey(created);
    addToPeriod(periods.all, o);
    if (key === todayKey) addToPeriod(periods.today, o);
    if (key === yesterdayKey) addToPeriod(periods.yesterday, o);
    if (weekKeys.has(key)) addToPeriod(periods.week, o);
    if (monthKeys.has(key)) addToPeriod(periods.month, o);
    if (!firstOrderAt || o.created_at < firstOrderAt) firstOrderAt = o.created_at;

    const total = Number(o.total) || 0;
    const dp = days.get(key);
    if (dp) {
      if (o.payment_status === "paid") {
        dp.paid += 1;
        dp.revenue += total;
      } else if (o.payment_status === "refused") dp.refused += 1;
    }
    if (key === todayKey) {
      const h = hourOf(created);
      if (o.payment_status === "paid") hours[h].paid += 1;
      else if (o.payment_status === "refused") hours[h].refused += 1;
    }
    if (monthKeys.has(key)) {
      if (o.payment_status === "paid") hours30[hourOf(created)] += 1;
      const mk = normalizeMethod(o.payment_method);
      const ms = methods.get(mk) ?? { method: mk, paid: 0, refused: 0, revenue: 0, rate: null };
      if (o.payment_status === "paid") {
        ms.paid += 1;
        ms.revenue += total;
      } else if (o.payment_status === "refused") ms.refused += 1;
      methods.set(mk, ms);
    }
    if (o.payment_status === "paid") {
      const at = o.payment_confirmed_at || o.created_at;
      if (!lastPaidAt || at > lastPaidAt) lastPaidAt = at;
    }
    if (o.payment_status === "refused" && (!lastRefusedAt || o.updated_at > lastRefusedAt)) lastRefusedAt = o.updated_at;

    const c = contactKey(o);
    const paidTimes = c ? (paidByContact.get(c) ?? []) : [];
    const t = created.getTime();
    const returning = paidTimes.some((x) => x < t);
    const paidLater = o.payment_status === "refused" && paidTimes.some((x) => x > t);
    if (monthKeys.has(key)) {
      if (paidLater) refusedThenPaid30d += 1;
      if (o.payment_status === "paid" && returning) returningPaid30d += 1;
    }

    enriched.set(o.id, {
      id: o.id,
      external_order_id: o.external_order_id,
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      total,
      currency: o.currency || STORE_CURRENCY,
      items: o.items ?? [],
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      customer_phone: o.customer_phone,
      created_at: o.created_at,
      updated_at: o.updated_at,
      payment_confirmed_at: o.payment_confirmed_at,
      country: countryFromPhone(o.customer_phone) ?? countryFromEmail(o.customer_email),
      attempts_today: c ? (attemptsToday.get(c) ?? 0) : 0,
      returning,
      paid_later: paidLater,
    });
  }

  // recusados consecutivos entre os mais recentes (ignora pendentes)
  let refusedStreak = 0;
  for (const o of rows) {
    if (o.payment_status === "pending") continue;
    if (o.payment_status === "refused") refusedStreak += 1;
    else break;
  }

  const dayList = dayKeys14.map((k) => {
    const d = days.get(k)!;
    d.revenue = Math.round(d.revenue * 100) / 100;
    return d;
  });
  const bestDayPoint = dayList.reduce<DayPoint | null>((best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best), null);
  const bestHourIdx = hours30.reduce((bi, v, i) => (v > hours30[bi] ? i : bi), 0);

  const recent = Array.from(enriched.values())
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, RECENT_LIMIT);

  return {
    orders: recent,
    periods: {
      today: finishPeriod(periods.today),
      yesterday: finishPeriod(periods.yesterday),
      week: finishPeriod(periods.week),
      month: finishPeriod(periods.month),
      all: finishPeriod(periods.all),
    },
    days: dayList,
    hours,
    methods: Array.from(methods.values())
      .map((m) => ({ ...m, revenue: Math.round(m.revenue * 100) / 100, rate: rateOf(m.paid, m.refused) }))
      .sort((a, b) => b.paid + b.refused - (a.paid + a.refused)),
    carts,
    insights: {
      lastPaidAt,
      lastRefusedAt,
      refusedThenPaid30d,
      returningPaid30d,
      bestDay: bestDayPoint && bestDayPoint.revenue > 0 ? { label: `${bestDayPoint.weekday} ${bestDayPoint.label}`, revenue: bestDayPoint.revenue } : null,
      bestHour: hours30[bestHourIdx] > 0 ? { hour: bestHourIdx, paid: hours30[bestHourIdx] } : null,
      refusedStreak,
      firstOrderAt,
      totalOrders: rows.length,
    },
    currency: rows[0]?.currency || STORE_CURRENCY,
    now: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Consulta + cache
// ---------------------------------------------------------------------------
let cache: { at: number; snap: LiveSnapshot } | null = null;

export async function liveSnapshot(): Promise<LiveSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return { ...cache.snap, now: new Date().toISOString() };
  const sb = getSupabaseAdmin();
  const now = new Date();
  const todayStart = startOfDayIso(dayKey(now), now);
  const [orders, abandonedToday, recoveredToday, openAbandoned] = await Promise.all([
    sb.from("orders").select(COLS).eq("store_id", STORE_ID).order("created_at", { ascending: false }).limit(MAX_ROWS),
    sb.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).gte("abandoned_at", todayStart),
    sb.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).gte("recovered_at", todayStart),
    sb.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("status", "abandoned"),
  ]);
  if (orders.error) throw new Error(`liveSnapshot: ${orders.error.message}`);
  const snap = build((orders.data ?? []) as unknown as RawOrder[], { abandonedToday: abandonedToday.count ?? 0, recoveredToday: recoveredToday.count ?? 0, openAbandoned: openAbandoned.count ?? 0 }, now);
  cache = { at: Date.now(), snap };
  return snap;
}
