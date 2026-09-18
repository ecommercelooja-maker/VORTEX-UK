import "server-only";
import { getSupabaseAdmin } from "@/lib/crm/supabase";
import { STORE_ID } from "@/lib/crm/config";
import { resolveCountry } from "@/lib/crm/country";
import type { AutomationEvent, Cart, Customer, CustomerEvent, CustomerOverview, Order, WebhookEvent } from "@/lib/crm/types";

const PAGE = 50;

/** Remove caracteres que quebram a sintaxe de filtro do PostgREST (.or/.ilike). */
function sanitizeSearch(s: string): string {
  return s.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function overviewStats() {
  const sb = getSupabaseAdmin();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [customers, ordersPaid, revenue, abandoned, recovered, autoSent, autoFailed, autoPending, webhooksErr] = await Promise.all([
    sb.from("customers").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("payment_status", "paid"),
    sb.from("orders").select("total").eq("store_id", STORE_ID).eq("payment_status", "paid").gte("payment_confirmed_at", since30),
    sb.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("status", "abandoned"),
    sb.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).in("status", ["recovered", "manually_recovered"]),
    sb.from("automation_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).in("status", ["sent", "delivered"]),
    sb.from("automation_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("status", "failed"),
    sb.from("automation_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("status", "pending"),
    sb.from("webhook_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("status", "error"),
  ]);
  const revenue30 = (revenue.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0);
  return {
    customers: customers.count ?? 0,
    ordersPaid: ordersPaid.count ?? 0,
    revenue30,
    abandoned: abandoned.count ?? 0,
    recovered: recovered.count ?? 0,
    autoSent: autoSent.count ?? 0,
    autoFailed: autoFailed.count ?? 0,
    autoPending: autoPending.count ?? 0,
    webhooksErr: webhooksErr.count ?? 0,
  };
}

export async function recentWebhooks(limit = 10): Promise<WebhookEvent[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("webhook_events").select("*").eq("store_id", STORE_ID).order("received_at", { ascending: false }).limit(limit);
  return (data ?? []) as WebhookEvent[];
}

export async function listCustomers(search: string, page: number): Promise<{ rows: CustomerOverview[]; count: number }> {
  const sb = getSupabaseAdmin();
  let q = sb.from("customer_overview").select("*", { count: "exact" }).eq("store_id", STORE_ID);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  const from = (page - 1) * PAGE;
  const { data, count } = await q.order("last_activity_at", { ascending: false }).range(from, from + PAGE - 1);
  return { rows: (data ?? []) as CustomerOverview[], count: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Aba Clientes — diretório com agregados por cliente (pedidos, carrinhos, mensagens), segmentos e ordenação
// ---------------------------------------------------------------------------
export type CustomerFilter = "todos" | "compradores" | "vip" | "carrinho" | "recusados" | "leads" | "telefone" | "novos";
export type CustomerSort = "atividade" | "gasto" | "pedidos" | "cadastro";
export type CustomerSegment = "vip" | "comprador" | "recusado" | "carrinho" | "lead";

export interface CustomerOrderMini {
  id: string;
  ref: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  tracking_code: string | null;
}
export interface CustomerCartMini {
  id: string;
  status: string;
  total: number;
  at: string;
  product_summary: string | null;
  checkout_url: string | null;
}
export interface CustomerMessageMini {
  automation_type: string;
  channel: string;
  status: string;
  at: string;
  subject: string | null;
}

export interface CustomerDirectoryRow extends Customer {
  country: string | null;
  segment: CustomerSegment;
  paid_orders: number;
  paid_total: number;
  refused_orders: number;
  last_paid_at: string | null;
  last_refused_at: string | null;
  open_cart_total: number;
  open_cart_at: string | null;
  abandoned_carts_count: number;
  recovered_carts_count: number;
  messages_sent: number;
  messages_failed: number;
  last_message_at: string | null;
  orders: CustomerOrderMini[];
  carts: CustomerCartMini[];
  messages: CustomerMessageMini[];
}

export interface CustomerDirectoryStats {
  total: number;
  buyers: number;
  vip: number;
  revenue: number;
  avgTicket: number;
  openCarts: number;
  openCartsValue: number;
  refusedToRecover: number;
  withPhone: number;
  newLast7d: number;
  emailOptIn: number;
  counts: Record<CustomerFilter, number>;
}

export async function customersDirectory(
  filter: CustomerFilter,
  search: string,
  sort: CustomerSort,
  page: number,
): Promise<{ rows: CustomerDirectoryRow[]; count: number; stats: CustomerDirectoryStats }> {
  const sb = getSupabaseAdmin();
  const [customers, orders, carts, autos] = await Promise.all([
    sb.from("customers").select("*").eq("store_id", STORE_ID).limit(5000),
    sb.from("orders").select("id,customer_id,external_order_id,status,payment_status,total,created_at,tracking_code,shipping_address").eq("store_id", STORE_ID).limit(10000),
    sb.from("abandoned_carts").select("id,customer_id,status,total,last_activity_at,abandoned_at,product_summary,checkout_url").eq("store_id", STORE_ID).neq("status", "active").limit(10000),
    sb.from("automation_events").select("customer_id,automation_type,channel,status,sent_at,created_at,subject").eq("store_id", STORE_ID).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(10000),
  ]);
  const byCustOrders = new Map<string, (Pick<Order, "id" | "external_order_id" | "status" | "payment_status" | "created_at" | "tracking_code" | "shipping_address"> & { total: unknown; customer_id: string | null })[]>();
  for (const o of (orders.data ?? []) as (Pick<Order, "id" | "external_order_id" | "status" | "payment_status" | "created_at" | "tracking_code" | "shipping_address"> & { total: unknown; customer_id: string | null })[]) {
    if (!o.customer_id) continue;
    const l = byCustOrders.get(o.customer_id) ?? [];
    l.push(o);
    byCustOrders.set(o.customer_id, l);
  }
  const byCustCarts = new Map<string, { id: string; status: string; total: unknown; last_activity_at: string; abandoned_at: string | null; product_summary: string | null; checkout_url: string | null }[]>();
  for (const c of (carts.data ?? []) as { id: string; customer_id: string | null; status: string; total: unknown; last_activity_at: string; abandoned_at: string | null; product_summary: string | null; checkout_url: string | null }[]) {
    if (!c.customer_id) continue;
    const l = byCustCarts.get(c.customer_id) ?? [];
    l.push(c);
    byCustCarts.set(c.customer_id, l);
  }
  const byCustMsgs = new Map<string, { automation_type: string; channel: string; status: string; sent_at: string | null; created_at: string; subject: string | null }[]>();
  for (const a of (autos.data ?? []) as { customer_id: string; automation_type: string; channel: string; status: string; sent_at: string | null; created_at: string; subject: string | null }[]) {
    const l = byCustMsgs.get(a.customer_id) ?? [];
    l.push(a);
    byCustMsgs.set(a.customer_id, l);
  }

  const since7 = Date.now() - 7 * 864e5;
  const all: CustomerDirectoryRow[] = ((customers.data ?? []) as Customer[]).map((c) => {
    const os = (byCustOrders.get(c.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const cs = (byCustCarts.get(c.id) ?? []).sort((a, b) => (b.abandoned_at ?? b.last_activity_at).localeCompare(a.abandoned_at ?? a.last_activity_at));
    const ms = byCustMsgs.get(c.id) ?? [];
    const paid = os.filter((o) => o.payment_status === "paid");
    const refused = os.filter((o) => o.payment_status === "refused");
    const openCarts = cs.filter((x) => x.status === "abandoned");
    const paid_total = paid.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const sent = ms.filter((m) => m.status === "sent" || m.status === "delivered");
    const failed = ms.filter((m) => m.status === "failed");
    const segment: CustomerSegment = paid.length >= 2 ? "vip" : paid.length === 1 ? "comprador" : refused.length ? "recusado" : openCarts.length ? "carrinho" : "lead";
    return {
      ...c,
      country: resolveCountry(c, os),
      segment,
      paid_orders: paid.length,
      paid_total,
      refused_orders: refused.length,
      last_paid_at: paid[0]?.created_at ?? null,
      last_refused_at: refused[0]?.created_at ?? null,
      open_cart_total: openCarts.reduce((s, x) => s + (Number(x.total) || 0), 0),
      open_cart_at: openCarts[0] ? openCarts[0].abandoned_at ?? openCarts[0].last_activity_at : null,
      abandoned_carts_count: cs.filter((x) => x.status === "abandoned" || x.status === "expired").length,
      recovered_carts_count: cs.filter((x) => x.status === "recovered" || x.status === "manually_recovered").length,
      messages_sent: sent.length,
      messages_failed: failed.length,
      last_message_at: sent[0] ? sent[0].sent_at ?? sent[0].created_at : null,
      orders: os.slice(0, 10).map((o) => ({ id: o.id, ref: o.external_order_id, status: o.status, payment_status: o.payment_status, total: Number(o.total) || 0, created_at: o.created_at, tracking_code: o.tracking_code })),
      carts: cs.slice(0, 6).map((x) => ({ id: x.id, status: x.status, total: Number(x.total) || 0, at: x.abandoned_at ?? x.last_activity_at, product_summary: x.product_summary, checkout_url: x.checkout_url })),
      messages: ms.slice(0, 8).map((m) => ({ automation_type: m.automation_type, channel: m.channel, status: m.status, at: m.sent_at ?? m.created_at, subject: m.subject })),
    };
  });

  const matches = (r: CustomerDirectoryRow, f: CustomerFilter): boolean => {
    switch (f) {
      case "compradores":
        return r.paid_orders > 0;
      case "vip":
        return r.paid_orders >= 2;
      case "carrinho":
        return r.open_cart_total > 0 || (r.segment === "carrinho");
      case "recusados":
        return r.refused_orders > 0 && r.paid_orders === 0;
      case "leads":
        return r.segment === "lead";
      case "telefone":
        return Boolean(r.phone || r.whatsapp);
      case "novos":
        return new Date(r.created_at).getTime() >= since7;
      default:
        return true;
    }
  };
  const counts: Record<CustomerFilter, number> = { todos: 0, compradores: 0, vip: 0, carrinho: 0, recusados: 0, leads: 0, telefone: 0, novos: 0 };
  for (const r of all) for (const f of Object.keys(counts) as CustomerFilter[]) if (matches(r, f)) counts[f]++;

  const buyers = all.filter((r) => r.paid_orders > 0);
  const revenue = buyers.reduce((s, r) => s + r.paid_total, 0);
  const paidOrders = buyers.reduce((s, r) => s + r.paid_orders, 0);
  const stats: CustomerDirectoryStats = {
    total: all.length,
    buyers: buyers.length,
    vip: counts.vip,
    revenue,
    avgTicket: paidOrders ? revenue / paidOrders : 0,
    openCarts: all.filter((r) => r.open_cart_total > 0).length,
    openCartsValue: all.reduce((s, r) => s + r.open_cart_total, 0),
    refusedToRecover: counts.recusados,
    withPhone: counts.telefone,
    newLast7d: counts.novos,
    emailOptIn: all.filter((r) => r.marketing_email_opt_in).length,
    counts,
  };

  const s = sanitizeSearch(search).toLowerCase();
  let rows = all.filter((r) => matches(r, filter));
  if (s) rows = rows.filter((r) => [r.name, r.email, r.phone, r.whatsapp].some((v) => v && v.toLowerCase().includes(s)));
  const key = (r: CustomerDirectoryRow) => {
    switch (sort) {
      case "gasto":
        return r.paid_total;
      case "pedidos":
        return r.paid_orders * 1e13 + new Date(r.last_paid_at ?? 0).getTime();
      case "cadastro":
        return new Date(r.created_at).getTime();
      default:
        return new Date(r.last_activity_at).getTime();
    }
  };
  rows.sort((a, b) => key(b) - key(a));
  const from = (page - 1) * PAGE;
  return { rows: rows.slice(from, from + PAGE), count: rows.length, stats };
}

export interface CustomerDetail {
  customer: Customer;
  orders: Order[];
  carts: Cart[];
  events: CustomerEvent[];
  automations: AutomationEvent[];
}

export async function customerDetail(id: string): Promise<CustomerDetail | null> {
  const sb = getSupabaseAdmin();
  const { data: customer } = await sb.from("customers").select("*").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  if (!customer) return null;
  const [orders, carts, events, automations] = await Promise.all([
    sb.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    sb.from("abandoned_carts").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    sb.from("customer_events").select("*").eq("customer_id", id).order("created_at", { ascending: true }).limit(500),
    sb.from("automation_events").select("*").eq("customer_id", id).order("created_at", { ascending: true }).limit(200),
  ]);
  return {
    customer: customer as Customer,
    orders: (orders.data ?? []) as Order[],
    carts: (carts.data ?? []) as Cart[],
    events: (events.data ?? []) as CustomerEvent[],
    automations: (automations.data ?? []) as AutomationEvent[],
  };
}

export type CartFilter = "com_contato" | "todos" | "novos" | "automacao" | "nao_recuperados" | "recuperados" | "ativos" | "expirados";

export interface CartAutomationSummary {
  channel: string;
  status: string;
  at: string;
  error: string | null;
}

export interface CartRow extends Cart {
  customer: Pick<Customer, "id" | "name" | "email" | "phone" | "whatsapp" | "marketing_email_opt_in" | "marketing_whatsapp_opt_in"> | null;
  /** automações (todas, inclusive falhas), mais recentes primeiro */
  automations: CartAutomationSummary[];
  automation_count: number;
  last_automation_at: string | null;
  last_automation_channel: string | null;
  email_sent: number;
  email_failed: number;
  email_pending: number;
  whatsapp_sent: number;
  /** contatos manuais registrados pelo operador, mais recentes primeiro */
  contacts: { channel: string; note: string; at: string }[];
  last_contact_at: string | null;
  /** contato resolvido (cliente > carrinho) */
  contact_email: string | null;
  contact_phone: string | null;
  contact_name: string | null;
}

export async function listCarts(filter: CartFilter, page: number): Promise<{ rows: CartRow[]; count: number }> {
  const sb = getSupabaseAdmin();
  let q = sb.from("abandoned_carts").select("*, customer:customers(id,name,email,phone,whatsapp,marketing_email_opt_in,marketing_whatsapp_opt_in)", { count: "exact" }).eq("store_id", STORE_ID);
  if (filter === "ativos") q = q.eq("status", "active");
  else if (filter === "recuperados") q = q.in("status", ["recovered", "manually_recovered"]);
  else if (filter === "expirados") q = q.eq("status", "expired");
  else if (filter === "todos") q = q.neq("status", "active");
  else if (filter === "com_contato") q = q.eq("status", "abandoned").or("customer_id.not.is.null,email.not.is.null,phone.not.is.null");
  else q = q.eq("status", "abandoned");
  const from = (page - 1) * PAGE;
  const { data, count } = await q.order("last_activity_at", { ascending: false }).range(from, from + PAGE - 1);
  const carts = (data ?? []) as (Cart & { customer: CartRow["customer"] })[];
  if (!carts.length) return { rows: [], count: count ?? 0 };

  const ids = carts.map((c) => c.id);
  const [{ data: autos }, { data: contacts }] = await Promise.all([
    sb.from("automation_events").select("cart_id,channel,status,sent_at,created_at,error_message").in("cart_id", ids).eq("automation_type", "abandoned_cart").order("created_at", { ascending: false }),
    sb.from("customer_events").select("cart_id,created_at,metadata").in("cart_id", ids).eq("event_type", "manual_contact").order("created_at", { ascending: false }),
  ]);
  const autosByCart = new Map<string, CartAutomationSummary[]>();
  for (const a of (autos ?? []) as { cart_id: string; channel: string; status: string; sent_at: string | null; created_at: string; error_message: string | null }[]) {
    const list = autosByCart.get(a.cart_id) ?? [];
    list.push({ channel: a.channel, status: a.status, at: a.sent_at ?? a.created_at, error: a.error_message });
    autosByCart.set(a.cart_id, list);
  }
  const contactsByCart = new Map<string, CartRow["contacts"]>();
  for (const c of (contacts ?? []) as { cart_id: string; created_at: string; metadata: Record<string, unknown> | null }[]) {
    const list = contactsByCart.get(c.cart_id) ?? [];
    list.push({ channel: String(c.metadata?.channel ?? "outro"), note: String(c.metadata?.note ?? ""), at: c.created_at });
    contactsByCart.set(c.cart_id, list);
  }

  const SENT = new Set(["sent", "delivered"]);
  const PENDING = new Set(["pending", "processing"]);
  let rows: CartRow[] = carts.map((c) => {
    const list = autosByCart.get(c.id) ?? [];
    const counted = list.filter((a) => SENT.has(a.status) || PENDING.has(a.status));
    const cs = contactsByCart.get(c.id) ?? [];
    return {
      ...c,
      automations: list,
      automation_count: counted.length,
      last_automation_at: counted[0]?.at ?? null,
      last_automation_channel: counted[0]?.channel ?? null,
      email_sent: list.filter((a) => a.channel === "email" && SENT.has(a.status)).length,
      email_failed: list.filter((a) => a.channel === "email" && a.status === "failed").length,
      email_pending: list.filter((a) => a.channel === "email" && PENDING.has(a.status)).length,
      whatsapp_sent: list.filter((a) => a.channel === "whatsapp" && SENT.has(a.status)).length,
      contacts: cs,
      last_contact_at: cs[0]?.at ?? null,
      contact_email: c.customer?.email ?? c.email ?? null,
      contact_phone: c.customer?.whatsapp ?? c.customer?.phone ?? c.whatsapp ?? c.phone ?? null,
      contact_name: c.customer?.name ?? null,
    };
  });
  if (filter === "novos") rows = rows.filter((r) => r.automation_count === 0 && !r.last_contact_at);
  if (filter === "automacao") rows = rows.filter((r) => r.automation_count > 0);
  return { rows, count: filter === "novos" || filter === "automacao" ? rows.length : count ?? 0 };
}

export interface CartStats {
  open: number;
  openValue: number;
  withContact: number;
  withContactValue: number;
  noAction: number;
  recovered7d: number;
  recovered30d: number;
  emailsSent7d: number;
}

/** Números do topo da aba de carrinhos. */
export async function cartStats(): Promise<CartStats> {
  const sb = getSupabaseAdmin();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [carts, autos, emails7] = await Promise.all([
    sb.from("abandoned_carts").select("id,status,total,email,phone,customer_id,recovered_at").eq("store_id", STORE_ID).neq("status", "active").limit(10000),
    sb.from("automation_events").select("cart_id").eq("store_id", STORE_ID).eq("automation_type", "abandoned_cart").in("status", ["sent", "delivered", "pending", "processing"]).limit(10000),
    sb.from("automation_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID).eq("automation_type", "abandoned_cart").eq("channel", "email").in("status", ["sent", "delivered"]).gte("sent_at", since7),
  ]);
  const touched = new Set((autos.data ?? []).map((a) => a.cart_id as string));
  const s: CartStats = { open: 0, openValue: 0, withContact: 0, withContactValue: 0, noAction: 0, recovered7d: 0, recovered30d: 0, emailsSent7d: emails7.count ?? 0 };
  for (const c of (carts.data ?? []) as { id: string; status: string; total: unknown; email: string | null; phone: string | null; customer_id: string | null; recovered_at: string | null }[]) {
    const total = Number(c.total) || 0;
    if (c.status === "abandoned") {
      s.open += 1;
      s.openValue += total;
      const hasContact = Boolean(c.customer_id || c.email || c.phone);
      if (hasContact) {
        s.withContact += 1;
        s.withContactValue += total;
        if (!touched.has(c.id)) s.noAction += 1;
      }
    } else if ((c.status === "recovered" || c.status === "manually_recovered") && c.recovered_at) {
      if (c.recovered_at >= since7) s.recovered7d += 1;
      if (c.recovered_at >= since30) s.recovered30d += 1;
    }
  }
  s.openValue = Math.round(s.openValue * 100) / 100;
  s.withContactValue = Math.round(s.withContactValue * 100) / 100;
  return s;
}

export type OrderFilter = "todos" | "a_enviar" | "paid" | "processing" | "shipped" | "delivered" | "pending" | "refused" | "cancelled" | "refunded";

export interface OrderAutomationSummary {
  automation_type: string;
  channel: string;
  status: string;
  at: string;
  recipient: string | null;
  error: string | null;
}

export type OrderRow = Order & { automations: OrderAutomationSummary[] };

export async function listOrders(status: string, search: string, page: number): Promise<{ rows: OrderRow[]; count: number }> {
  const sb = getSupabaseAdmin();
  let q = sb.from("orders").select("*", { count: "exact" }).eq("store_id", STORE_ID);
  if (status === "a_enviar" || status === "sem_rastreio") q = q.in("status", ["paid", "processing"]).is("tracking_code", null);
  else if (status === "refused") q = q.eq("payment_status", "refused");
  else if (status && status !== "todos") q = q.eq("status", status);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`external_order_id.ilike.%${s}%,customer_name.ilike.%${s}%,customer_email.ilike.%${s}%,tracking_code.ilike.%${s}%,customer_phone.ilike.%${s}%`);
  const from = (page - 1) * PAGE;
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  const orders = (data ?? []) as Order[];
  const ids = orders.map((o) => o.id);
  const byOrder = new Map<string, OrderAutomationSummary[]>();
  if (ids.length) {
    const { data: autos } = await sb
      .from("automation_events")
      .select("order_id,automation_type,channel,status,sent_at,created_at,recipient,error_message")
      .in("order_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const a of (autos ?? []) as { order_id: string; automation_type: string; channel: string; status: string; sent_at: string | null; created_at: string; recipient: string | null; error_message: string | null }[]) {
      const list = byOrder.get(a.order_id) ?? [];
      list.push({ automation_type: a.automation_type, channel: a.channel, status: a.status, at: a.sent_at ?? a.created_at, recipient: a.recipient, error: a.error_message });
      byOrder.set(a.order_id, list);
    }
  }
  return { rows: orders.map((o) => ({ ...o, automations: byOrder.get(o.id) ?? [] })), count: count ?? 0 };
}

export interface OrderStats {
  counts: Record<OrderFilter, number>;
  toShipValue: number;
  paidRevenue30d: number;
  paidCount30d: number;
  shippedAwaiting: number;
  delivered30d: number;
  refusedToday: number;
  paidToday: number;
  notNotified: number;
  avgHoursToShip: number | null;
}

/** Números do topo da aba Pedidos + contagem por filtro (calculado em JS: a base tem poucos milhares de linhas). */
export async function orderStats(): Promise<OrderStats> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("orders")
    .select("status,payment_status,total,tracking_code,tracking_notification_sent,created_at,payment_confirmed_at,shipped_at,delivered_at")
    .eq("store_id", STORE_ID)
    .limit(10000);
  const rows = (data ?? []) as { status: string; payment_status: string; total: unknown; tracking_code: string | null; tracking_notification_sent: boolean; created_at: string; payment_confirmed_at: string | null; shipped_at: string | null; delivered_at: string | null }[];
  const now = Date.now();
  const since30 = now - 30 * 864e5;
  const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = london.format(new Date(now));
  const counts: Record<OrderFilter, number> = { todos: 0, a_enviar: 0, paid: 0, processing: 0, shipped: 0, delivered: 0, pending: 0, refused: 0, cancelled: 0, refunded: 0 };
  const st: OrderStats = { counts, toShipValue: 0, paidRevenue30d: 0, paidCount30d: 0, shippedAwaiting: 0, delivered30d: 0, refusedToday: 0, paidToday: 0, notNotified: 0, avgHoursToShip: null };
  const shipHours: number[] = [];
  for (const o of rows) {
    counts.todos++;
    if (o.status in counts) counts[o.status as OrderFilter]++;
    if (o.payment_status === "refused") counts.refused++;
    const total = Number(o.total) || 0;
    const createdMs = new Date(o.created_at).getTime();
    if ((o.status === "paid" || o.status === "processing") && !o.tracking_code) {
      counts.a_enviar++;
      st.toShipValue += total;
    }
    if (o.payment_status === "paid" && createdMs >= since30) {
      st.paidRevenue30d += total;
      st.paidCount30d++;
    }
    if (o.status === "shipped") st.shippedAwaiting++;
    if (o.status === "delivered" && o.delivered_at && new Date(o.delivered_at).getTime() >= since30) st.delivered30d++;
    if (o.payment_status === "refused" && london.format(new Date(createdMs)) === today) st.refusedToday++;
    if (o.payment_status === "paid" && london.format(new Date(o.payment_confirmed_at ?? createdMs)) === today) st.paidToday++;
    if (o.tracking_code && !o.tracking_notification_sent && (o.status === "shipped" || o.status === "delivered")) st.notNotified++;
    if (o.shipped_at && o.payment_confirmed_at) {
      const h = (new Date(o.shipped_at).getTime() - new Date(o.payment_confirmed_at).getTime()) / 36e5;
      if (h >= 0 && h < 24 * 60) shipHours.push(h);
    }
  }
  if (shipHours.length) st.avgHoursToShip = shipHours.reduce((x, y) => x + y, 0) / shipHours.length;
  return st;
}

export async function orderDetail(id: string): Promise<{ order: Order; customer: Customer | null; automations: AutomationEvent[]; events: CustomerEvent[] } | null> {
  const sb = getSupabaseAdmin();
  const { data: order } = await sb.from("orders").select("*").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  if (!order) return null;
  const o = order as Order;
  const [customer, automations, events] = await Promise.all([
    o.customer_id ? sb.from("customers").select("*").eq("id", o.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("automation_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    sb.from("customer_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  return { order: o, customer: (customer.data as Customer | null) ?? null, automations: (automations.data ?? []) as AutomationEvent[], events: (events.data ?? []) as CustomerEvent[] };
}

export async function listAutomations(status: string, page: number): Promise<{ rows: (AutomationEvent & { customer: Pick<Customer, "name" | "email"> | null })[]; count: number }> {
  const sb = getSupabaseAdmin();
  let q = sb.from("automation_events").select("*, customer:customers(name,email)", { count: "exact" }).eq("store_id", STORE_ID);
  if (status && status !== "todos") q = q.eq("status", status);
  const from = (page - 1) * PAGE;
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  return { rows: (data ?? []) as (AutomationEvent & { customer: Pick<Customer, "name" | "email"> | null })[], count: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Mensagens enviadas (e-mail, WhatsApp, SMS) — acompanhamento por mensagem e por cliente
// ---------------------------------------------------------------------------
export type MessageRow = AutomationEvent & { customer: Pick<Customer, "id" | "name" | "email" | "phone" | "whatsapp"> | null };

export interface MessageFilter {
  channel: string; // todos | email | whatsapp | sms
  type: string; // todos | abandoned_cart | purchase_confirmation | promotion_reminder | tracking_notification | manual_followup
  status: string; // todos | sent | failed | pending | cancelled
  q: string;
}

const SENT = ["sent", "delivered"];

export async function listMessages(f: MessageFilter, page: number): Promise<{ rows: MessageRow[]; count: number }> {
  const sb = getSupabaseAdmin();
  let q = sb.from("automation_events").select("*, customer:customers(id,name,email,phone,whatsapp)", { count: "exact" }).eq("store_id", STORE_ID);
  if (f.channel && f.channel !== "todos") q = q.eq("channel", f.channel);
  if (f.type && f.type !== "todos") q = q.eq("automation_type", f.type);
  if (f.status && f.status !== "todos") q = f.status === "sent" ? q.in("status", SENT) : q.eq("status", f.status);
  const s = sanitizeSearch(f.q);
  if (s) q = q.or(`recipient.ilike.%${s}%,subject.ilike.%${s}%`);
  const from = (page - 1) * PAGE;
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  return { rows: (data ?? []) as MessageRow[], count: count ?? 0 };
}

export interface MessageStats {
  sentTotal: number;
  sent7d: number;
  failed: number;
  pending: number;
  byChannel: Record<string, number>;
  byType: Record<string, number>;
  customersReached: number;
}

export async function messageStats(): Promise<MessageStats> {
  const sb = getSupabaseAdmin();
  const base = () => sb.from("automation_events").select("id", { count: "exact", head: true }).eq("store_id", STORE_ID);
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const types = ["abandoned_cart", "purchase_confirmation", "promotion_reminder", "tracking_notification", "manual_followup"];
  const channels = ["email", "whatsapp", "sms"];
  const [sentTotal, sent7d, failed, pending, reached, ...rest] = await Promise.all([
    base().in("status", SENT),
    base().in("status", SENT).gte("sent_at", since7),
    base().eq("status", "failed"),
    base().eq("status", "pending"),
    sb.from("automation_events").select("customer_id").eq("store_id", STORE_ID).in("status", SENT).not("customer_id", "is", null).limit(5000),
    ...channels.map((c) => base().in("status", SENT).eq("channel", c)),
    ...types.map((t) => base().in("status", SENT).eq("automation_type", t)),
  ]);
  const byChannel: Record<string, number> = {};
  channels.forEach((c, i) => (byChannel[c] = rest[i].count ?? 0));
  const byType: Record<string, number> = {};
  types.forEach((t, i) => (byType[t] = rest[channels.length + i].count ?? 0));
  const customersReached = new Set(((reached.data ?? []) as { customer_id: string }[]).map((r) => r.customer_id)).size;
  return { sentTotal: sentTotal.count ?? 0, sent7d: sent7d.count ?? 0, failed: failed.count ?? 0, pending: pending.count ?? 0, byChannel, byType, customersReached };
}

export interface CustomerMessageSummary {
  customer: Pick<Customer, "id" | "name" | "email" | "phone" | "whatsapp">;
  total: number;
  byChannel: Record<string, number>;
  types: string[];
  last: MessageRow;
  first_at: string;
}

/** Uma linha por cliente que já recebeu ao menos uma mensagem (enviada/entregue). */
export async function customersReached(search: string): Promise<CustomerMessageSummary[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("automation_events")
    .select("*, customer:customers(id,name,email,phone,whatsapp)")
    .eq("store_id", STORE_ID)
    .in("status", SENT)
    .not("customer_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(2000);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`recipient.ilike.%${s}%,subject.ilike.%${s}%`);
  const { data } = await q;
  const map = new Map<string, CustomerMessageSummary>();
  for (const row of (data ?? []) as MessageRow[]) {
    if (!row.customer_id) continue;
    const cur = map.get(row.customer_id);
    const at = row.sent_at ?? row.created_at;
    if (!cur) {
      map.set(row.customer_id, {
        customer: row.customer ?? { id: row.customer_id, name: null, email: row.recipient, phone: null, whatsapp: null },
        total: 1,
        byChannel: { [row.channel]: 1 },
        types: [row.automation_type],
        last: row,
        first_at: at,
      });
      continue;
    }
    cur.total++;
    cur.byChannel[row.channel] = (cur.byChannel[row.channel] ?? 0) + 1;
    if (!cur.types.includes(row.automation_type)) cur.types.push(row.automation_type);
    if (at < cur.first_at) cur.first_at = at;
  }
  return [...map.values()];
}

export async function messageDetail(id: string): Promise<{ message: MessageRow; order: Order | null; cart: Cart | null; history: MessageRow[] } | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("automation_events").select("*, customer:customers(id,name,email,phone,whatsapp)").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  if (!data) return null;
  const message = data as MessageRow;
  const [order, cart, history] = await Promise.all([
    message.order_id ? sb.from("orders").select("*").eq("id", message.order_id).maybeSingle() : Promise.resolve({ data: null }),
    message.cart_id ? sb.from("abandoned_carts").select("*").eq("id", message.cart_id).maybeSingle() : Promise.resolve({ data: null }),
    message.customer_id
      ? sb.from("automation_events").select("*, customer:customers(id,name,email,phone,whatsapp)").eq("store_id", STORE_ID).eq("customer_id", message.customer_id).neq("id", id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  return { message, order: (order.data as Order | null) ?? null, cart: (cart.data as Cart | null) ?? null, history: ((history.data ?? []) as MessageRow[]) };
}

// ---------------------------------------------------------------------------
// Assistente de I.A.
// ---------------------------------------------------------------------------
export type CustomerPick = Pick<Customer, "id" | "name" | "email" | "total_orders" | "last_activity_at">;

export async function searchCustomers(search: string, limit = 8): Promise<CustomerPick[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("customers").select("id,name,email,total_orders,last_activity_at").eq("store_id", STORE_ID);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  const { data } = await q.order("last_activity_at", { ascending: false }).limit(limit);
  return (data ?? []) as CustomerPick[];
}

export const PAGE_SIZE = PAGE;
