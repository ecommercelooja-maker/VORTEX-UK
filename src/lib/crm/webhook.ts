import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabase";
import { CHECKOUT_AMOUNTS_IN_CENTS, STORE_ID } from "./config";
import { ensureStore } from "./settings";
import { normalizeUmpiPayload, type NormalizedCheckoutEvent } from "./adapters/umpi";
import { markCartAbandoned, upsertCheckoutCart } from "./carts";
import { processPendingAutomations } from "./automations";
import { handleChargeback, handlePaymentConfirmed, upsertOrderFromEvent } from "./orders";
import { addTracking } from "./tracking";
import { logEvent } from "./events";

export interface WebhookOutcome {
  duplicate: boolean;
  kind: NormalizedCheckoutEvent["kind"];
  status: "processed" | "ignored" | "error";
  message?: string;
  orderId?: string | null;
}

function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonicalize(o[k]);
        return acc;
      }, {});
  }
  return v;
}

/** Hash estável do payload (chaves ordenadas em todos os níveis) para detectar reenvios idênticos. */
function stableHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

/**
 * Recebe um webhook do Umpi: guarda o payload bruto (auditoria + idempotência por hash),
 * normaliza e despacha. Nunca lança para o route handler: o resultado descreve o que houve.
 */
export async function handleUmpiWebhook(payload: unknown): Promise<WebhookOutcome> {
  await ensureStore();
  const sb = getSupabaseAdmin();
  const ev = normalizeUmpiPayload(payload, { amountsInCents: CHECKOUT_AMOUNTS_IN_CENTS });
  const hash = stableHash(payload);

  const { data: inserted, error: insErr } = await sb
    .from("webhook_events")
    .insert({ store_id: STORE_ID, provider: "umpi", event_type: ev.rawEvent, external_id: ev.externalOrderId, payload_hash: hash, payload: payload as object, status: "received" })
    .select("id")
    .maybeSingle();
  if (insErr) {
    if (insErr.code === "23505") return { duplicate: true, kind: ev.kind, status: "ignored", message: "payload já processado" };
    throw new Error(`webhook_events insert: ${insErr.message}`);
  }
  return dispatchWebhookEvent(inserted?.id as string, ev);
}

/**
 * Reprocessa um webhook já guardado (status "received" ou "error" — por exemplo, quando o Supabase
 * respondeu Gateway Timeout no meio do processamento). Usa o payload bruto salvo.
 */
export async function reprocessWebhookEvent(webhookId: string): Promise<WebhookOutcome> {
  await ensureStore();
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("webhook_events").select("id,payload,status").eq("id", webhookId).eq("store_id", STORE_ID).maybeSingle();
  if (error) throw new Error(`webhook_events select: ${error.message}`);
  if (!row) throw new Error("webhook não encontrado");
  const ev = normalizeUmpiPayload(row.payload, { amountsInCents: CHECKOUT_AMOUNTS_IN_CENTS });
  return dispatchWebhookEvent(webhookId, ev);
}

async function dispatchWebhookEvent(webhookId: string, ev: NormalizedCheckoutEvent): Promise<WebhookOutcome> {
  const sb = getSupabaseAdmin();
  const finish = async (o: Omit<WebhookOutcome, "duplicate" | "kind">): Promise<WebhookOutcome> => {
    await sb
      .from("webhook_events")
      .update({ status: o.status, error_message: o.status === "processed" ? null : o.message ?? null, order_id: o.orderId ?? null, processed_at: new Date().toISOString() })
      .eq("id", webhookId);
    return { duplicate: false, kind: ev.kind, ...o };
  };

  try {
    switch (ev.kind) {
      case "checkout_abandoned":
      case "payment_pending": {
        // Sem contato não há como identificar o cliente; guarda só o webhook.
        if (!ev.customer.email && !ev.customer.phone) return finish({ status: "ignored", message: "evento sem e-mail/telefone do cliente" });
        const cartId = ev.externalCartId || ev.externalOrderId;
        if (!cartId) return finish({ status: "ignored", message: "evento sem id de checkout" });
        const { cart, customer } = await upsertCheckoutCart({
          external_cart_id: cartId,
          items: ev.items,
          subtotal: ev.subtotal,
          discount: ev.discount,
          total: ev.total,
          currency: ev.currency,
          checkout_url: ev.checkoutUrl,
          contact: { name: ev.customer.name, email: ev.customer.email, phone: ev.customer.phone, marketing_email_opt_in: ev.customer.acceptsMarketing ?? undefined, marketing_whatsapp_opt_in: ev.customer.acceptsMarketing ?? undefined },
        });
        let orderId: string | null = null;
        if (ev.kind === "payment_pending" && ev.externalOrderId) {
          const { order } = await upsertOrderFromEvent(ev, cart.id);
          orderId = order.id;
        }
        await logEvent({ event_type: "checkout_started", customer_id: customer?.id ?? null, cart_id: cart.id, order_id: orderId, metadata: { source: "umpi", event: ev.rawEvent, total: ev.total } });
        // CHECKOUT_ABANDONED já é o sinal de abandono do Umpi: marca e agenda a recuperação sem esperar o timeout.
        let message: string | undefined;
        if (ev.kind === "checkout_abandoned" && cart.status === "active") {
          const r = await markCartAbandoned(cart);
          message = r.automations ? `recuperação agendada (${r.automations})` : r.skipped.join("; ") || undefined;
          if (r.automations) await processPendingAutomations(5);
        }
        return finish({ status: "processed", orderId, message });
      }
      case "payment_paid": {
        const cartId = ev.externalCartId || ev.externalOrderId;
        let linkedCartId: string | null = null;
        if (cartId) {
          const { data: cart } = await sb.from("abandoned_carts").select("id").eq("store_id", STORE_ID).eq("external_cart_id", cartId).maybeSingle();
          linkedCartId = (cart?.id as string | undefined) ?? null;
        }
        const { order, customer, wasPaidBefore } = await upsertOrderFromEvent(ev, linkedCartId);
        await handlePaymentConfirmed(order, customer, wasPaidBefore);
        return finish({ status: "processed", orderId: order.id, message: wasPaidBefore ? "pagamento já confirmado antes" : undefined });
      }
      case "payment_refused": {
        const { order, customer } = await upsertOrderFromEvent(ev, null);
        await logEvent({ event_type: "payment_refused", customer_id: customer?.id ?? null, order_id: order.id, metadata: { external_order_id: order.external_order_id } });
        return finish({ status: "processed", orderId: order.id });
      }
      case "chargeback": {
        const { order, customer } = await upsertOrderFromEvent(ev, null);
        await handleChargeback(order, customer);
        return finish({ status: "processed", orderId: order.id });
      }
      case "tracking_found": {
        if (!ev.externalOrderId) return finish({ status: "ignored", message: "sem id de pedido" });
        const { data: existing } = await sb.from("orders").select("id").eq("store_id", STORE_ID).eq("external_order_id", ev.externalOrderId).maybeSingle();
        if (!existing) return finish({ status: "ignored", message: "pedido desconhecido" });
        if (!ev.tracking.code) return finish({ status: "ignored", message: "evento sem código de rastreio no payload (ver payload bruto)" });
        const r = await addTracking(existing.id as string, { code: ev.tracking.code, carrier: ev.tracking.carrier, url: ev.tracking.url }, "umpi");
        return finish({ status: "processed", orderId: r.order.id });
      }
      default:
        return finish({ status: "ignored", message: `evento não reconhecido: ${ev.rawEvent ?? "?"}` });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[crm] webhook", ev.kind, message);
    return finish({ status: "error", message });
  }
}
