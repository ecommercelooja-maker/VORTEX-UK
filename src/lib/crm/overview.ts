import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_ID } from "./config";
import { liveSnapshot, type LiveSnapshot } from "./live-orders";
import type { WebhookEvent } from "./types";

/**
 * Dados da Visão geral (/admin): reaproveita o snapshot de vendas (live-orders) e acrescenta
 * funil do site, carrinhos, automações, clientes, webhooks e a lista "o que fazer agora".
 * Uma rodada de consultas em paralelo; nada pesado (contagens head + colunas mínimas).
 */

const DAY = 864e5;

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
  /** conversão em relação ao passo anterior (%), null no primeiro */
  fromPrev: number | null;
}

export interface OverviewData {
  live: LiveSnapshot;
  funnel7d: FunnelStep[];
  traffic7d: { pageViews: number; productViews: number; addToCart: number; abandonEvents: number; contacts: number };
  carts: {
    abandoned7d: number;
    recovered7d: number;
    recoveryRate7d: number | null;
    recoveredRevenue30d: number;
    openAbandoned: number;
    openValue: number;
    withContactOpen: number;
    withContactValue: number;
  };
  automations: {
    sent7d: number;
    sent30d: number;
    failed: number;
    pending: number;
    byType7d: { type: string; sent: number; failed: number }[];
    lastSentAt: string | null;
  };
  customers: { total: number; new7d: number; withPhone: number; emailOptIn: number; whatsappOptIn: number };
  webhooks: { recent: WebhookEvent[]; last24h: Record<string, number>; errors: number; lastAt: string | null };
  orders: { paidWithoutTracking: number; shipped: number };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function overviewData(): Promise<OverviewData> {
  const sb = getSupabaseAdmin();
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since24h = new Date(now - DAY).toISOString();
  const S = STORE_ID;
  const head = (table: string) => sb.from(table).select("id", { count: "exact", head: true }).eq("store_id", S);
  const evCount = (type: string, since: string) => head("customer_events").eq("event_type", type).gte("created_at", since);

  const [
    live,
    pageViews,
    productViews,
    addToCart,
    checkoutStarted,
    checkoutAbandoned,
    contacts,
    cartsRows,
    autoRows,
    custRows,
    whRecent,
    wh24,
    whErrors,
    paidNoTracking,
    shipped,
  ] = await Promise.all([
    liveSnapshot(),
    evCount("page_view", since7),
    evCount("product_view", since7),
    evCount("add_to_cart", since7),
    evCount("checkout_started", since7),
    evCount("checkout_abandoned", since7),
    evCount("contact_captured", since7),
    sb.from("abandoned_carts").select("status,total,abandoned_at,recovered_at,email,phone").eq("store_id", S).gte("created_at", since30).limit(5000),
    sb.from("automation_events").select("automation_type,status,created_at,sent_at").eq("store_id", S).gte("created_at", since30).limit(5000),
    sb.from("customers").select("created_at,phone,marketing_email_opt_in,marketing_whatsapp_opt_in").eq("store_id", S).limit(5000),
    sb.from("webhook_events").select("*").eq("store_id", S).order("received_at", { ascending: false }).limit(8),
    sb.from("webhook_events").select("event_type,status").eq("store_id", S).gte("received_at", since24h).limit(2000),
    head("webhook_events").eq("status", "error"),
    head("orders").in("status", ["paid", "processing"]).is("tracking_code", null),
    head("orders").eq("status", "shipped"),
  ]);

  // Funil (7 dias): checkout iniciado → pagamento tentado → aprovado (fontes comparáveis entre si)
  const attempts7 = live.periods.week.paid + live.periods.week.refused;
  const raw: { key: string; label: string; value: number }[] = [
    { key: "checkout_started", label: "Foram ao checkout", value: checkoutStarted.count ?? 0 },
    { key: "attempts", label: "Tentaram pagar", value: attempts7 },
    { key: "paid", label: "Pagaram", value: live.periods.week.paid },
  ];
  const funnel7d: FunnelStep[] = raw.map((s, i) => ({ ...s, fromPrev: i === 0 || !raw[i - 1].value ? null : Math.round((s.value / raw[i - 1].value) * 1000) / 10 }));

  // Carrinhos
  let abandoned7d = 0;
  let recovered7d = 0;
  let recoveredRevenue30d = 0;
  let openAbandoned = 0;
  let openValue = 0;
  let withContactOpen = 0;
  let withContactValue = 0;
  for (const c of (cartsRows.data ?? []) as { status: string; total: unknown; abandoned_at: string | null; recovered_at: string | null; email: string | null; phone: string | null }[]) {
    const recovered = c.status === "recovered" || c.status === "manually_recovered";
    if (c.abandoned_at && c.abandoned_at >= since7) abandoned7d += 1;
    if (recovered && c.recovered_at && c.recovered_at >= since7) recovered7d += 1;
    if (recovered) recoveredRevenue30d += num(c.total);
    if (c.status === "abandoned") {
      openAbandoned += 1;
      openValue += num(c.total);
      if (c.email || c.phone) {
        withContactOpen += 1;
        withContactValue += num(c.total);
      }
    }
  }

  // Automações
  const byType = new Map<string, { type: string; sent: number; failed: number }>();
  let sent7d = 0;
  let sent30d = 0;
  let failed = 0;
  let pending = 0;
  let lastSentAt: string | null = null;
  for (const a of (autoRows.data ?? []) as { automation_type: string; status: string; created_at: string; sent_at: string | null }[]) {
    const ok = a.status === "sent" || a.status === "delivered";
    if (ok) {
      sent30d += 1;
      if (a.sent_at && a.sent_at >= since7) sent7d += 1;
      if (a.sent_at && (!lastSentAt || a.sent_at > lastSentAt)) lastSentAt = a.sent_at;
    }
    if (a.status === "failed") failed += 1;
    if (a.status === "pending") pending += 1;
    if (a.created_at >= since7) {
      const t = byType.get(a.automation_type) ?? { type: a.automation_type, sent: 0, failed: 0 };
      if (ok) t.sent += 1;
      if (a.status === "failed") t.failed += 1;
      byType.set(a.automation_type, t);
    }
  }

  // Clientes
  let new7d = 0;
  let withPhone = 0;
  let emailOptIn = 0;
  let whatsappOptIn = 0;
  const custs = (custRows.data ?? []) as { created_at: string; phone: string | null; marketing_email_opt_in: boolean; marketing_whatsapp_opt_in: boolean }[];
  for (const c of custs) {
    if (c.created_at >= since7) new7d += 1;
    if (c.phone) withPhone += 1;
    if (c.marketing_email_opt_in) emailOptIn += 1;
    if (c.marketing_whatsapp_opt_in) whatsappOptIn += 1;
  }

  // Webhooks últimas 24 h
  const last24h: Record<string, number> = {};
  for (const w of (wh24.data ?? []) as { event_type: string | null; status: string }[]) {
    const k = (w.event_type || "outro").toUpperCase();
    last24h[k] = (last24h[k] ?? 0) + 1;
  }
  const recent = (whRecent.data ?? []) as WebhookEvent[];

  return {
    live,
    funnel7d,
    traffic7d: { pageViews: pageViews.count ?? 0, productViews: productViews.count ?? 0, addToCart: addToCart.count ?? 0, abandonEvents: checkoutAbandoned.count ?? 0, contacts: contacts.count ?? 0 },
    carts: {
      abandoned7d,
      recovered7d,
      recoveryRate7d: abandoned7d ? Math.round((recovered7d / abandoned7d) * 1000) / 10 : null,
      recoveredRevenue30d: Math.round(recoveredRevenue30d * 100) / 100,
      openAbandoned,
      openValue: Math.round(openValue * 100) / 100,
      withContactOpen,
      withContactValue: Math.round(withContactValue * 100) / 100,
    },
    automations: {
      sent7d,
      sent30d,
      failed,
      pending,
      byType7d: Array.from(byType.values()).sort((a, b) => b.sent + b.failed - (a.sent + a.failed)),
      lastSentAt,
    },
    customers: { total: custs.length, new7d, withPhone, emailOptIn, whatsappOptIn },
    webhooks: { recent, last24h, errors: whErrors.count ?? 0, lastAt: recent[0]?.received_at ?? null },
    orders: { paidWithoutTracking: paidNoTracking.count ?? 0, shipped: shipped.count ?? 0 },
  };
}
