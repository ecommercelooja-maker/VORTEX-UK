import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_ID } from "./config";
import { logEvent } from "./events";
import { scheduleAutomation, sendAutomation } from "./automations";
import { detectCarrier, matchCarrierName, normalizeTrackingCode, trackingUrlFor } from "./carriers";
import type { Customer, Order, TrackingStatus } from "./types";

export interface TrackingInput {
  code: string;
  carrier?: string | null;
  url?: string | null;
  estimated_delivery_at?: string | null;
}

export interface NotifyOutcome {
  channel: string;
  /** automação criada (havia contato + integração + consentimento) */
  created: boolean;
  /** provedor aceitou a mensagem (confirmado relendo automation_events) */
  sent: boolean;
  recipient?: string | null;
  sentAt?: string | null;
  providerMessageId?: string | null;
  /** motivo de não ter criado, ou erro do envio */
  reason?: string;
}

export interface TrackingResult {
  order: Order;
  notified: NotifyOutcome[];
  /** true quando a notificação já tinha sido enviada antes e por isso não foi repetida */
  alreadyNotified?: boolean;
}

function isHttpUrl(u: string | null | undefined): u is string {
  return Boolean(u && /^https?:\/\//i.test(u));
}

/**
 * Cadastra/atualiza o rastreio de um pedido.
 * - Sempre atualiza código, transportadora, URL e tracking_added_at e registra `tracking_added`.
 * - Transportadora vazia → detectada pelo formato do código; URL vazia → URL pública da transportadora (ou 17TRACK).
 * - Notifica o cliente automaticamente SOMENTE na primeira vez (tracking_notification_sent = false)
 *   e devolve o resultado real do envio. Atualizar o código depois não reenvia; use `resendTracking`.
 */
export async function addTracking(orderId: string, input: TrackingInput, source = "dashboard"): Promise<TrackingResult> {
  const sb = getSupabaseAdmin();
  const code = normalizeTrackingCode(input.code);
  if (!code) throw new Error("Código de rastreio obrigatório");
  const { data: current } = await sb.from("orders").select("*").eq("id", orderId).eq("store_id", STORE_ID).maybeSingle();
  if (!current) throw new Error("Pedido não encontrado");
  const order = current as Order;

  const typed = input.carrier?.trim() || "";
  const carrier = typed ? (matchCarrierName(typed)?.name ?? typed) : (detectCarrier(code)?.name ?? null);
  const now = new Date().toISOString();
  const patch: Partial<Order> = {
    tracking_code: code,
    tracking_carrier: carrier || null,
    tracking_url: isHttpUrl(input.url?.trim()) ? input.url!.trim() : trackingUrlFor(carrier, code),
    tracking_added_at: now,
    estimated_delivery_at: input.estimated_delivery_at || order.estimated_delivery_at,
  };
  if (!order.tracking_status) {
    patch.tracking_status = "shipped";
    patch.tracking_status_updated_at = now;
  }
  if (order.status === "paid" || order.status === "processing") {
    patch.status = "shipped";
    patch.shipped_at = order.shipped_at ?? now;
  }
  const { data, error } = await sb.from("orders").update(patch).eq("id", orderId).select("*").single();
  if (error) throw new Error(`addTracking: ${error.message}`);
  const updated = data as Order;

  await logEvent({
    event_type: "tracking_added",
    customer_id: updated.customer_id,
    order_id: updated.id,
    metadata: { code, carrier: patch.tracking_carrier, url: patch.tracking_url, source, previous_code: order.tracking_code },
  });
  if (patch.status === "shipped" && order.status !== "shipped") {
    await logEvent({ event_type: "order_shipped", customer_id: updated.customer_id, order_id: updated.id, metadata: { via: "tracking_added" } });
  }

  if (updated.tracking_notification_sent) return { order: updated, notified: [], alreadyNotified: true };
  const notified = await notifyTracking(updated, false);
  return { order: updated, notified };
}

/** Reenvio manual do rastreio (botão "Reenviar rastreio"). Sempre cria uma nova automação. */
export async function resendTracking(orderId: string): Promise<TrackingResult> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("orders").select("*").eq("id", orderId).eq("store_id", STORE_ID).maybeSingle();
  if (!data) throw new Error("Pedido não encontrado");
  const order = data as Order;
  if (!order.tracking_code) throw new Error("Pedido sem código de rastreio");
  const notified = await notifyTracking(order, true);
  return { order, notified };
}

/**
 * Cria e ENVIA na hora a notificação de rastreio (e-mail + WhatsApp quando disponíveis) e relê
 * automation_events para confirmar o que o provedor aceitou — o painel mostra o resultado real.
 */
async function notifyTracking(order: Order, manual: boolean): Promise<NotifyOutcome[]> {
  const sb = getSupabaseAdmin();
  const notified: NotifyOutcome[] = [];
  if (!order.customer_id) return [{ channel: "email", created: false, sent: false, reason: "pedido sem cliente" }];
  const { data: customer } = await sb.from("customers").select("*").eq("id", order.customer_id).maybeSingle();
  if (!customer) return [{ channel: "email", created: false, sent: false, reason: "cliente não encontrado" }];
  for (const channel of ["email", "whatsapp"] as const) {
    const r = await scheduleAutomation({ automation_type: "tracking_notification", channel, customer: customer as Customer, order, manual });
    if (!r.created || !r.automation) {
      notified.push({ channel, created: false, sent: false, reason: r.reason });
      continue;
    }
    const send = await sendAutomation(r.automation);
    const { data: row } = await sb.from("automation_events").select("status,sent_at,recipient,provider_message_id,error_message").eq("id", r.automation.id).maybeSingle();
    const saved = row as { status: string; sent_at: string | null; recipient: string | null; provider_message_id: string | null; error_message: string | null } | null;
    const sent = send.ok && saved?.status === "sent";
    notified.push({
      channel,
      created: true,
      sent,
      recipient: saved?.recipient ?? null,
      sentAt: saved?.sent_at ?? null,
      providerMessageId: saved?.provider_message_id ?? null,
      reason: sent ? undefined : saved?.error_message ?? send.error ?? "erro desconhecido",
    });
  }
  return notified;
}

/** Atualização de status de rastreio (manual hoje; no futuro, alimentado por API de rastreamento). */
export async function updateTrackingStatus(orderId: string, status: TrackingStatus, extra?: { estimated_delivery_at?: string | null }): Promise<Order> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const patch: Partial<Order> = { tracking_status: status, tracking_status_updated_at: now };
  if (extra?.estimated_delivery_at !== undefined) patch.estimated_delivery_at = extra.estimated_delivery_at;
  if (status === "delivered") {
    patch.status = "delivered";
    patch.delivered_at = now;
  } else if (status === "shipped" || status === "in_transit" || status === "out_for_delivery") {
    patch.status = "shipped";
  }
  const { data, error } = await sb.from("orders").update(patch).eq("id", orderId).eq("store_id", STORE_ID).select("*").single();
  if (error) throw new Error(`updateTrackingStatus: ${error.message}`);
  const order = data as Order;
  await logEvent({ event_type: "tracking_status_updated", customer_id: order.customer_id, order_id: order.id, metadata: { status } });
  if (status === "delivered") await logEvent({ event_type: "order_delivered", customer_id: order.customer_id, order_id: order.id, metadata: {} });
  return order;
}

// ---------------------------------------------------------------------------
// Lote
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encontra um pedido a partir de uma referência humana: uuid (id ou nº externo), início do nº
 * externo (ex.: "ad802126") ou e-mail do cliente (pega o pedido pago mais recente sem rastreio).
 */
export async function resolveOrderRef(ref: string): Promise<{ order: Order | null; reason?: string }> {
  const sb = getSupabaseAdmin();
  const r = ref.trim().replace(/^#/, "");
  if (!r) return { order: null, reason: "referência vazia" };
  const clean = r.replace(/[%,()"'\\*]/g, "");
  const base = () => sb.from("orders").select("*").eq("store_id", STORE_ID);
  if (UUID_RE.test(r)) {
    const { data } = await base().or(`id.eq.${r},external_order_id.eq.${r}`).limit(1);
    return data && data.length ? { order: data[0] as Order } : { order: null, reason: "pedido não encontrado" };
  }
  if (r.includes("@")) {
    const { data } = await base().ilike("customer_email", clean).order("created_at", { ascending: false }).limit(20);
    const list = (data ?? []) as Order[];
    if (!list.length) return { order: null, reason: "nenhum pedido com este e-mail" };
    const pick = list.find((o) => (o.status === "paid" || o.status === "processing") && !o.tracking_code) ?? list.find((o) => o.payment_status === "paid") ?? list[0];
    return { order: pick };
  }
  if (!/^[0-9a-z-]{4,}$/i.test(r)) return { order: null, reason: "referência inválida" };
  const { data } = await base().ilike("external_order_id", `${clean}%`).order("created_at", { ascending: false }).limit(5);
  const list = (data ?? []) as Order[];
  if (!list.length) return { order: null, reason: "nenhum pedido começa com este número" };
  if (list.length > 1) return { order: null, reason: `${list.length} pedidos começam com "${r}" — use mais caracteres` };
  return { order: list[0] };
}

export interface BulkTrackingEntry {
  /** id do pedido (quando veio da seleção) — tem prioridade sobre `ref` */
  orderId?: string;
  ref?: string;
  code: string;
  carrier?: string;
  url?: string;
}

export interface BulkTrackingOutcome {
  entry: BulkTrackingEntry;
  ok: boolean;
  orderId?: string;
  orderRef?: string;
  customer?: string | null;
  message: string;
  notified: NotifyOutcome[];
}

/** Cadastra vários rastreios de uma vez; cada item é independente (um erro não trava os outros). */
export async function bulkAddTracking(entries: BulkTrackingEntry[], source = "dashboard-bulk"): Promise<BulkTrackingOutcome[]> {
  const out: BulkTrackingOutcome[] = [];
  const seen = new Set<string>();
  const sb = getSupabaseAdmin();
  for (const entry of entries.slice(0, 200)) {
    const code = normalizeTrackingCode(entry.code ?? "");
    if (!code) {
      out.push({ entry, ok: false, message: "código vazio", notified: [] });
      continue;
    }
    let order: Order | null = null;
    let reason: string | undefined;
    if (entry.orderId) {
      const { data } = await sb.from("orders").select("*").eq("id", entry.orderId).eq("store_id", STORE_ID).maybeSingle();
      order = (data as Order | null) ?? null;
      if (!order) reason = "pedido não encontrado";
    } else {
      const r = await resolveOrderRef(entry.ref ?? "");
      order = r.order;
      reason = r.reason;
    }
    if (!order) {
      out.push({ entry, ok: false, message: reason ?? "pedido não encontrado", notified: [] });
      continue;
    }
    const who = order.customer_name ?? order.customer_email;
    if (seen.has(order.id)) {
      out.push({ entry, ok: false, orderId: order.id, orderRef: order.external_order_id, customer: who, message: "pedido repetido na lista — ignorado", notified: [] });
      continue;
    }
    seen.add(order.id);
    try {
      const r = await addTracking(order.id, { code, carrier: entry.carrier, url: entry.url }, source);
      const email = r.notified.find((n) => n.channel === "email");
      const msg = r.alreadyNotified
        ? "rastreio salvo · cliente já tinha sido avisado antes (não reenviado)"
        : email?.sent
          ? `rastreio salvo · e-mail enviado para ${email.recipient ?? "cliente"}`
          : `rastreio salvo · e-mail NÃO enviado (${email?.reason ?? "sem e-mail"})`;
      out.push({ entry, ok: true, orderId: order.id, orderRef: order.external_order_id, customer: who, message: msg, notified: r.notified });
    } catch (e) {
      out.push({ entry, ok: false, orderId: order.id, orderRef: order.external_order_id, customer: who, message: e instanceof Error ? e.message : String(e), notified: [] });
    }
  }
  return out;
}
