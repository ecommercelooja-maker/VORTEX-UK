"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DayPoint, HourPoint, LiveOrder, LiveSnapshot, Period } from "@/lib/crm/live-orders";

/**
 * Aba "Ao vivo" — vendas em tempo real.
 * - Consulta /api/admin/live-orders a cada 5 s (15 s quando a guia está em segundo plano).
 * - Pedido novo ou que mudou de resultado (pendente → aprovado/recusado) ganha destaque por 90 s.
 * - Contador de novos no título da guia e aviso sonoro opcional (preferência guardada no navegador).
 * - Gráficos em SVG puro (sem biblioteca): 14 dias e hoje por hora, com tooltip.
 */
const POLL_MS = 5000;
const POLL_HIDDEN_MS = 15000;
const HIGHLIGHT_MS = 90_000;
const SOUND_KEY = "vortex_live_sound";
const SOUND_EVENT = "vortex-live-sound";

// Cores dos gráficos (par validado para daltonismo; verde/vermelho ficam só nas etiquetas com texto)
const C_PAID = "#2563eb";
const C_REFUSED = "#f97316";
const C_GRID = "#e5e5e5";
const C_TEXT_MUTED = "#737373";

function subscribeSound(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(SOUND_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SOUND_EVENT, cb);
  };
}
function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

type Filter = "todos" | "paid" | "refused" | "pending";

const RESULT: Record<string, { label: string; icon: string; cls: string; row: string }> = {
  paid: { label: "Aprovado", icon: "✓", cls: "bg-green-100 text-green-800", row: "bg-green-50" },
  refused: { label: "Recusado", icon: "✕", cls: "bg-red-100 text-red-800", row: "bg-red-50" },
  pending: { label: "Pendente", icon: "…", cls: "bg-amber-100 text-amber-800", row: "bg-amber-50" },
  chargeback: { label: "Chargeback", icon: "!", cls: "bg-red-100 text-red-800", row: "bg-red-50" },
  refunded: { label: "Reembolsado", icon: "↩", cls: "bg-black/5 text-black/70", row: "bg-surface" },
};

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------
function money(v: number | string | null | undefined, currency: string, compact = false): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "GBP", ...(compact ? { maximumFractionDigits: 0 } : {}) }).format(n);
}
function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} %`;
}
function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "medium" }).format(d);
}
function ago(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
function flag(iso: string | null): string {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(...iso.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
const COUNTRY_NAME: Record<string, string> = { FR: "França", GB: "Reino Unido", DE: "Alemanha", BE: "Bélgica", CH: "Suíça", LU: "Luxemburgo", MC: "Mônaco", BR: "Brasil", ES: "Espanha", IT: "Itália", PT: "Portugal", NL: "Países Baixos", IE: "Irlanda", AT: "Áustria" };
function itemsSummary(items: LiveOrder["items"]): string {
  if (!items || !items.length) return "—";
  return items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
}
function delta(cur: number, prev: number): { text: string; tone: string } | null {
  if (!prev && !cur) return null;
  if (!prev) return { text: "novo vs ontem", tone: "text-black/50" };
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return { text: "= ontem", tone: "text-black/50" };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} % vs ontem`, tone: d > 0 ? "text-green-700" : "text-red-700" };
}

/** Bipe curto via WebAudio (sem arquivo de áudio). */
function beep(kind: "paid" | "refused") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "paid" ? [880, 1175] : [440, 330];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.stop(t + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* navegador sem áudio */
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function LiveOrders({ initial }: { initial: LiveSnapshot }) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const [filter, setFilter] = useState<Filter>("todos");
  const [nowMs, setNowMs] = useState(() => new Date(initial.now).getTime());
  const [lastOk, setLastOk] = useState<number>(() => new Date(initial.now).getTime());
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const sound = useSyncExternalStore(subscribeSound, readSound, () => false);
  const router = useRouter();
  const [newCount, setNewCount] = useState(0);
  const [highlight, setHighlight] = useState<Record<string, { until: number; result: string }>>({});
  const known = useRef<Map<string, string>>(new Map(initial.orders.map((o) => [o.id, o.payment_status])));
  const baseTitle = useRef<string>("");

  const toggleSound = () => {
    const next = !sound;
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(SOUND_EVENT));
    if (next) beep("paid");
  };

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const applySnapshot = useCallback(
    (next: LiveSnapshot) => {
      const changed: { id: string; result: string }[] = [];
      for (const o of next.orders) {
        const prev = known.current.get(o.id);
        if (prev !== o.payment_status) changed.push({ id: o.id, result: o.payment_status });
        known.current.set(o.id, o.payment_status);
      }
      if (changed.length) {
        const until = Date.now() + HIGHLIGHT_MS;
        setHighlight((h) => {
          const copy = { ...h };
          for (const c of changed) copy[c.id] = { until, result: c.result };
          return copy;
        });
        const relevant = changed.filter((c) => c.result === "paid" || c.result === "refused");
        if (relevant.length) {
          setNewCount((n) => n + relevant.length);
          if (sound) beep(relevant.some((c) => c.result === "paid") ? "paid" : "refused");
        }
      }
      setSnap(next);
      setLastOk(Date.now());
      setError(null);
    },
    [sound],
  );

  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/live-orders", { cache: "no-store", credentials: "same-origin" });
        if (res.status === 401) {
          stopped = true;
          router.push("/admin/login?next=/admin/vendas");
          return;
        }
        const body = (await res.json()) as (LiveSnapshot & { ok: true }) | { ok: false; error?: string };
        if (!body.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!stopped) applySnapshot(body);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!stopped) timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
      }
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paused, applySnapshot, router]);

  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    document.title = newCount ? `(${newCount}) ${baseTitle.current}` : baseTitle.current;
    const reset = () => {
      if (!document.hidden) setNewCount(0);
    };
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("focus", reset);
    return () => {
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("focus", reset);
    };
  }, [newCount]);

  const active = useMemo(() => {
    const out: Record<string, { until: number; result: string }> = {};
    for (const [id, v] of Object.entries(highlight)) if (v.until > nowMs) out[id] = v;
    return out;
  }, [highlight, nowMs]);

  const rows = useMemo(
    () => snap.orders.filter((o) => (filter === "todos" ? o.payment_status !== "pending" || active[o.id] : o.payment_status === filter)),
    [snap.orders, filter, active],
  );

  const stale = nowMs - lastOk > POLL_MS * 4;
  const { periods: P, insights: I, carts, currency } = snap;
  const revenueDelta = delta(P.today.revenue, P.yesterday.revenue);
  const paidDelta = delta(P.today.paid, P.yesterday.paid);
  const refusedDelta = delta(P.today.refused, P.yesterday.refused);
  const rateDiff = P.today.rate !== null && P.all.rate !== null ? Math.round((P.today.rate - P.all.rate) * 10) / 10 : null;
  const pendingCount = snap.orders.filter((o) => o.payment_status === "pending").length;

  return (
    <>
      {/* Barra de status */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${paused ? "bg-black/30" : error || stale ? "bg-amber-500" : "animate-pulse bg-green-500"}`} />
            <span className="font-semibold">{paused ? "Pausado" : error ? "Reconectando…" : stale ? "Sem resposta" : "Ao vivo"}</span>
          </span>
          <span className="text-black/50">atualizado {ago(new Date(lastOk).toISOString(), nowMs)}</span>
          <span className="text-black/30">·</span>
          <span className="text-black/60">
            última venda <b className="text-black">{ago(I.lastPaidAt, nowMs)}</b>
          </span>
          <span className="text-black/30">·</span>
          <span className="text-black/60">
            última recusa <b className="text-black">{ago(I.lastRefusedAt, nowMs)}</b>
          </span>
          {error && <span className="text-xs text-red-700">({error})</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleSound} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${sound ? "border-black bg-black text-white" : "border-black/20 hover:bg-surface"}`}>
            {sound ? "🔔 Som ligado" : "🔕 Som desligado"}
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
            {paused ? "▶ Retomar" : "⏸ Pausar"}
          </button>
        </div>
      </div>

      {I.refusedStreak >= 3 && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Atenção:</b> os últimos {I.refusedStreak} pagamentos foram recusados em sequência. Pode ser antifraude do gateway ou um problema no checkout — vale conferir no painel do Umpi.
        </div>
      )}

      {/* Números do dia */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Aprovados hoje" value={P.today.paid} tone="text-green-700" hint={paidDelta} sub={`ontem ${P.yesterday.paid}`} />
        <Tile label="Recusados hoje" value={P.today.refused} tone="text-red-700" hint={refusedDelta} sub={`ontem ${P.yesterday.refused}${pendingCount ? ` · ${pendingCount} pendente(s)` : ""}`} />
        <Tile label="Receita hoje" value={money(P.today.revenue, currency)} hint={revenueDelta} sub={P.today.avgTicket ? `ticket médio ${money(P.today.avgTicket, currency)}` : `ontem ${money(P.yesterday.revenue, currency)}`} />
        <Tile
          label="Aprovação hoje"
          value={pct(P.today.rate)}
          tone={P.today.rate === null ? "" : P.today.rate >= 50 ? "text-green-700" : "text-red-700"}
          hint={rateDiff === null ? null : { text: `${rateDiff >= 0 ? "▲" : "▼"} ${Math.abs(rateDiff).toLocaleString("pt-BR")} pts vs geral (${pct(P.all.rate)})`, tone: rateDiff >= 0 ? "text-green-700" : "text-red-700" }}
          sub={`${P.today.paid + P.today.refused} tentativa(s) hoje`}
        />
      </div>

      {/* Gráficos + taxa por período */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Últimos 14 dias" subtitle="aprovados e recusados por dia" className="lg:col-span-2">
          <DaysChart days={snap.days} currency={currency} />
        </Card>
        <Card title="Taxa de aprovação" subtitle="aprovados ÷ (aprovados + recusados)">
          <RateList periods={[P.today, P.yesterday, P.week, P.month, P.all]} currency={currency} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Hoje, hora a hora" subtitle="fuso de Londres">
          <HoursChart hours={snap.hours} />
        </Card>
        <Card title="Formas de pagamento" subtitle="últimos 30 dias">
          <MethodsList methods={snap.methods} currency={currency} />
        </Card>
        <Card title="Insights" subtitle="o que os números estão dizendo">
          <Insights snap={snap} nowMs={nowMs} />
        </Card>
      </div>

      {/* Funil do dia */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini label="Carrinhos abandonados hoje" value={carts.abandonedToday} />
        <Mini label="Carrinhos recuperados hoje" value={carts.recoveredToday} />
        <Mini label="Abandonados em aberto" value={carts.openAbandoned} />
        <Mini label="Recusados que pagaram depois" value={I.refusedThenPaid30d} sub="30 dias" />
        <Mini label="Compras de clientes recorrentes" value={I.returningPaid30d} sub="30 dias" />
      </div>

      {/* Lista */}
      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todos", "Aprovados e recusados"],
              ["paid", "Só aprovados"],
              ["refused", "Só recusados"],
              ["pending", "Pendentes"],
            ] as [Filter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === v ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-black/50">{rows.length} de {snap.orders.length} pedidos recentes</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-black/60">
            <tr>
              {["Quando", "Resultado", "Cliente", "País", "Produtos", "Total", "Pagamento", "Sinais", "Pedido"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-black/50">
                  Nenhum pedido ainda. Assim que o Umpi aprovar ou recusar um pagamento, ele aparece aqui sozinho.
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const r = RESULT[o.payment_status] ?? { label: o.payment_status, icon: "", cls: "bg-black/5 text-black/70", row: "" };
                const hl = active[o.id];
                const when = o.payment_status === "paid" && o.payment_confirmed_at ? o.payment_confirmed_at : o.updated_at || o.created_at;
                return (
                  <tr key={o.id} className={`transition-colors duration-700 ${hl ? r.row : "hover:bg-surface/60"}`}>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top">
                      <div className="font-semibold">{ago(when, nowMs)}</div>
                      <div className="text-xs text-black/50">{clock(when)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.cls}`}>
                        <span aria-hidden>{r.icon}</span>
                        {r.label}
                      </span>
                      {hl && <span className="ml-1 rounded-full bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">NOVO</span>}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div>{o.customer_name ?? "—"}</div>
                      <div className="text-xs text-black/50">{o.customer_email ?? o.customer_phone ?? ""}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top" title={o.country ? (COUNTRY_NAME[o.country] ?? o.country) : "país desconhecido"}>
                      <span className="text-lg leading-none">{flag(o.country) || "🌐"}</span> <span className="text-xs text-black/60">{o.country ?? "?"}</span>
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5 align-top text-xs text-black/70">{itemsSummary(o.items)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-semibold">{money(o.total, o.currency)}</td>
                    <td className="px-3 py-2.5 align-top text-xs text-black/70">{o.payment_method ?? "—"}</td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {o.attempts_today > 1 && <Chip tone="amber" title="pedidos deste contato hoje">{o.attempts_today}ª tentativa hoje</Chip>}
                        {o.returning && <Chip tone="blue" title="já comprou antes">recorrente</Chip>}
                        {o.paid_later && <Chip tone="green" title="foi recusado, mas o cliente pagou depois">pagou depois</Chip>}
                        {!o.attempts_today && !o.returning && !o.paid_later && <span className="text-xs text-black/30">—</span>}
                        {o.attempts_today === 1 && !o.returning && !o.paid_later && <span className="text-xs text-black/30">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link href={`/admin/pedidos/${o.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                        #{o.external_order_id.slice(0, 8)}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-black/50">
        Mostra os últimos {snap.orders.length} pedidos com atividade · {I.totalOrders} pedidos no total desde {I.firstOrderAt ? clock(I.firstOrderAt).slice(0, 10) : "—"}. Histórico completo e rastreio na aba Pedidos e rastreio.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
function Tile({ label, value, tone = "", hint, sub }: { label: string; value: string | number; tone?: string; hint: { text: string; tone: string } | null; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className={`mt-1 text-3xl font-bold leading-tight ${tone}`}>{value}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
        {hint && <span className={`font-semibold ${hint.tone}`}>{hint.text}</span>}
        {sub && <span className="text-black/50">{sub}</span>}
      </div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-0.5 text-xl font-bold">
        {value} {sub && <span className="text-xs font-normal text-black/40">{sub}</span>}
      </div>
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-xl">{title}</h3>
        {subtitle && <span className="text-xs text-black/50">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ tone, title, children }: { tone: "amber" | "blue" | "green"; title?: string; children: ReactNode }) {
  const cls = { amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800" }[tone];
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function RateList({ periods, currency }: { periods: Period[]; currency: string }) {
  return (
    <ul className="flex flex-col gap-3">
      {periods.map((p) => {
        const n = p.paid + p.refused;
        return (
          <li key={p.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={`font-semibold ${p.key === "today" || p.key === "all" ? "" : "text-black/70"}`}>{p.label}</span>
              <span className="text-black/50">
                <b className={`text-base ${p.rate === null ? "text-black/40" : p.rate >= 50 ? "text-green-700" : "text-red-700"}`}>{pct(p.rate)}</b>
                <span className="ml-2 text-xs">
                  {p.paid} ✓ · {p.refused} ✕{n ? "" : " · sem tentativas"}
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.rate ?? 0}%`, background: C_PAID }} />
            </div>
            <div className="mt-0.5 text-[11px] text-black/40">
              {p.revenue > 0 ? `receita ${money(p.revenue, currency)}` : "sem receita"}
              {p.avgTicket ? ` · ticket médio ${money(p.avgTicket, currency)}` : ""}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MethodsList({ methods, currency }: { methods: LiveSnapshot["methods"]; currency: string }) {
  if (!methods.length) return <p className="text-sm text-black/50">Sem pagamentos nos últimos 30 dias.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {methods.map((m) => (
        <li key={m.method}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold capitalize">{m.method}</span>
            <span className="text-xs text-black/50">
              <b className={`text-sm ${m.rate === null ? "" : m.rate >= 50 ? "text-green-700" : "text-red-700"}`}>{pct(m.rate)}</b> · {m.paid} ✓ · {m.refused} ✕ · {money(m.revenue, currency, true)}
            </span>
          </div>
          <div className="mt-1 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-black/5">
            <div className="h-full" style={{ width: `${m.paid + m.refused ? (m.paid / (m.paid + m.refused)) * 100 : 0}%`, background: C_PAID }} />
            <div className="h-full" style={{ width: `${m.paid + m.refused ? (m.refused / (m.paid + m.refused)) * 100 : 0}%`, background: C_REFUSED }} />
          </div>
        </li>
      ))}
      <li className="flex gap-3 text-[11px] text-black/50">
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm" style={{ background: C_PAID }} /> aprovados
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm" style={{ background: C_REFUSED }} /> recusados
        </span>
      </li>
    </ul>
  );
}

function Insights({ snap, nowMs }: { snap: LiveSnapshot; nowMs: number }) {
  const { periods: P, insights: I, currency } = snap;
  const items: { icon: string; text: ReactNode }[] = [];
  if (P.today.rate !== null && P.all.rate !== null) {
    const diff = P.today.rate - P.all.rate;
    items.push({
      icon: diff >= 0 ? "📈" : "📉",
      text: (
        <>
          Aprovação de hoje está <b>{(Math.abs(Math.round(diff * 10) / 10)).toLocaleString("pt-BR")} pts {diff >= 0 ? "acima" : "abaixo"}</b> da média geral ({pct(P.all.rate)}).
        </>
      ),
    });
  }
  if (P.week.rate !== null && P.month.rate !== null) {
    const diff = P.week.rate - P.month.rate;
    if (Math.abs(diff) >= 3)
      items.push({ icon: diff > 0 ? "✅" : "⚠️", text: <>Últimos 7 dias {diff > 0 ? "melhores" : "piores"} que os 30 dias: {pct(P.week.rate)} vs {pct(P.month.rate)}.</> });
  }
  if (I.bestDay) items.push({ icon: "🏆", text: <>Melhor dia nas últimas 2 semanas: <b>{I.bestDay.label}</b> com {money(I.bestDay.revenue, currency)}.</> });
  if (I.bestHour) items.push({ icon: "⏰", text: <>Horário que mais aprova (30 dias): <b>{String(I.bestHour.hour).padStart(2, "0")}h</b> de Londres, {I.bestHour.paid} venda(s).</> });
  if (I.refusedThenPaid30d) items.push({ icon: "🔁", text: <>{I.refusedThenPaid30d} cliente(s) recusado(s) voltaram e pagaram — insistir vale a pena.</> });
  if (P.today.refused >= 3 && P.today.paid === 0) items.push({ icon: "🚨", text: <>Hoje só houve recusas ({P.today.refused}). Confira se o checkout está aceitando cartões estrangeiros.</> });
  if (I.lastPaidAt && nowMs - new Date(I.lastPaidAt).getTime() > 24 * 3600e3) items.push({ icon: "⏳", text: <>Nenhuma venda aprovada {ago(I.lastPaidAt, nowMs).replace("há ", "há ")}.</> });
  if (P.all.avgTicket) items.push({ icon: "🎯", text: <>Ticket médio geral {money(P.all.avgTicket, currency)} em {P.all.paid} venda(s) aprovada(s) desde o início.</> });
  if (!items.length) items.push({ icon: "🕐", text: <>Ainda sem dados suficientes — os insights aparecem conforme os pedidos entram.</> });
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.slice(0, 6).map((it, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="shrink-0">
            {it.icon}
          </span>
          <span className="text-black/80">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Gráficos (SVG puro, responsivo por ResizeObserver, tooltip por hover)
// ---------------------------------------------------------------------------
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

interface Tip {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 2 ? 0.5 : n <= 5 ? 1 : 2;
  return Math.ceil(n / step) * step * p;
}

function GroupedBars({ points, labels, series, height = 200, tipFor }: { points: number[][]; labels: string[]; series: { name: string; color: string }[]; height?: number; tipFor: (i: number) => { title: string; lines: string[] } }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const w = Math.max(width, 200);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(1, ...points.flat()));
  const slot = innerW / points.length;
  const gap = 2;
  const barW = Math.min(24, Math.max(4, (slot - 6) / series.length - gap));
  const ticks = [0, max / 2, max];
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label={series.map((s) => s.name).join(" e ")}>
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={C_GRID} strokeWidth={1} />
              <text x={padL - 6} y={y + 3.5} fontSize={10} textAnchor="end" fill={C_TEXT_MUTED}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          );
        })}
        {points.map((vals, i) => {
          const x0 = padL + i * slot + (slot - (barW * series.length + gap * (series.length - 1))) / 2;
          return (
            <g key={i}>
              {vals.map((v, si) => {
                const h = (v / max) * innerH;
                const x = x0 + si * (barW + gap);
                const y = padT + innerH - h;
                const r = Math.min(4, h);
                const d = h > 0 ? `M${x},${padT + innerH} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${x + barW - r} a${r},${r} 0 0 1 ${r},${r} V${padT + innerH} Z` : "";
                return d ? <path key={si} d={d} fill={series[si].color} /> : null;
              })}
              {/* alvo de hover maior que a marca */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setTip({ x: padL + i * slot + slot / 2, y: padT, ...tipFor(i) })}
                onMouseLeave={() => setTip(null)}
              />
              {(points.length <= 16 || i % Math.ceil(points.length / 12) === 0) && (
                <text x={padL + i * slot + slot / 2} y={height - 6} fontSize={10} textAnchor="middle" fill={C_TEXT_MUTED}>
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex gap-3 text-[11px] text-black/50">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(tip.x, 60), w - 60), top: tip.y }}
        >
          <div className="font-semibold">{tip.title}</div>
          {tip.lines.map((l) => (
            <div key={l} className="text-black/60">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DaysChart({ days, currency }: { days: DayPoint[]; currency: string }) {
  const total = days.reduce((s, d) => s + d.paid + d.refused, 0);
  if (!total) return <p className="py-8 text-center text-sm text-black/50">Sem pedidos nos últimos 14 dias.</p>;
  return (
    <GroupedBars
      points={days.map((d) => [d.paid, d.refused])}
      labels={days.map((d) => d.label)}
      series={[
        { name: "aprovados", color: C_PAID },
        { name: "recusados", color: C_REFUSED },
      ]}
      tipFor={(i) => {
        const d = days[i];
        const n = d.paid + d.refused;
        return { title: `${d.weekday} ${d.label}`, lines: [`${d.paid} aprovado(s) · ${d.refused} recusado(s)`, `aprovação ${n ? Math.round((d.paid / n) * 100) : 0} % · ${money(d.revenue, currency)}`] };
      }}
    />
  );
}

function HoursChart({ hours }: { hours: HourPoint[] }) {
  const total = hours.reduce((s, h) => s + h.paid + h.refused, 0);
  if (!total) return <p className="py-8 text-center text-sm text-black/50">Nenhum pagamento hoje ainda.</p>;
  return (
    <GroupedBars
      height={180}
      points={hours.map((h) => [h.paid, h.refused])}
      labels={hours.map((h) => `${String(h.hour).padStart(2, "0")}h`)}
      series={[
        { name: "aprovados", color: C_PAID },
        { name: "recusados", color: C_REFUSED },
      ]}
      tipFor={(i) => ({ title: `${String(i).padStart(2, "0")}:00 – ${String(i).padStart(2, "0")}:59`, lines: [`${hours[i].paid} aprovado(s) · ${hours[i].refused} recusado(s)`] })}
    />
  );
}
