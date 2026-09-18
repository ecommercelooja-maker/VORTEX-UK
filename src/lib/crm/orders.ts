import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_CURRENCY, STORE_ID } from "./config";
import { findOrCreateCustomer } from "./customers";
import { logEvent } from "./events";
import { processPendingAutomations, scheduleAutomation } from "./automations";
import { recoverCustomerCarts } from "./carts";
import type { NormalizedCheckoutEvent } from "./adapters/umpi";
import type { Customer, Order, OrderStatus, PaymentStatus } from "./types";

function statusFor(kind: NormalizedCheckoutEvent["kind"], current?: Order | null): { status: OrderStatus; payment_status: PaymentStatus } | null {
  switch (kind) {
    case "payment_pending":
      // não rebaixa um pedido já pago
      if (current && current.payment_status === "paid") return null;
      return { status: "pending", payment_status: "pending" };
    case "payment_paid":
      if (current && ["processing", "shipped", "delivered"].includes(current.status)) return { status: current.status, payment_status: "paid" };
      return { status: "paid", payment_status: "paid" };
    case "payment_refused":
      if (current && current.payment_status === "paid") return null;
      return { status: "cancelled", payment_status: "refused" };
    case "chargeback":
      return { status: "refunded", payment_status: "chargeback" };
    default:
      return null;
  }
}

/** Cria/atualiza o pedido a partir de um evento normalizado do checkout (idempotente por external_order_id). */
export async function upsertOrderFromEvent(ev: NormalizedCheckoutEvent, cartId: string | null): Promise<{ order: Order; customer: Customer | null; wasPaidBefore: boolean }> {
  if (!ev.externalOrderId) throw new Error("evento sem id de transação/pedido");
  const sb = getSupabaseAdmin();

  const customer = await findOrCreateCustomer({
    name: ev.customer.name,
    email: ev.customer.email,
    phone: ev.customer.phone,
    marketing_email_opt_in: ev.customer.acceptsMarketing ?? undefined,
    marketing_whatsapp_opt_in: ev.customer.acceptsMarketing ?? undefined,
    // e-mail/telefone usados para pagar um pedido são considerados verificados
    email_verified: ev.kind === "payment_paid" && Boolean(ev.customer.email),
    phone_verified: ev.kind === "payment_paid" && Boolean(ev.customer.phone),
    source: "checkout",
  });

  const { data: existing } = await sb.from("orders").select("*").eq("store_id", STORE_ID).eq("external_order_id", ev.externalOrderId).maybeSingle();
  const current = (existing as Order | null) ?? null;
  const wasPaidBefore = Boolean(current && current.payment_status === "paid" && current.payment_confirmed_at);
  const st = statusFor(ev.kind, current);

  const base = {
    store_id: STORE_ID,
    external_order_id: ev.externalOrderId,
    provider: ev.provider,
    customer_id: customer?.id ?? current?.customer_id ?? null,
    cart_id: cartId ?? current?.cart_id ?? null,
    currency: ev.currency || current?.currency || STORE_CURRENCY,
    subtotal: ev.subtotal,
    discount: ev.discount,
    shipping: ev.shipping,
    total: ev.total,
    items: ev.items.length ? ev.items : current?.items ?? [],
    checkout_url: ev.checkoutUrl ?? current?.checkout_url ?? null,
    payment_method: ev.paymentMethod ?? current?.payment_method ?? null,
    shipping_address: ev.shippingAddress ?? current?.shipping_address ?? null,
    customer_name: ev.customer.name ?? current?.customer_name ?? customer?.name ?? null,
    customer_email: customer?.email ?? current?.customer_email ?? null,
    customer_phone: customer?.phone ?? current?.customer_phone ?? null,
    ...(st ?? {}),
    ...(ev.kind === "payment_paid" && !wasPaidBefore ? { payment_confirmed_at: ev.paidAt ?? new Date().toISOString() } : {}),
  };

  if (current) {
    const { data, error } = await sb.from("orders").update(base).eq("id", current.id).select("*").single();
    if (error) throw new Error(`upsertOrderFromEvent update: ${error.message}`);
    return { order: data as Order, customer, wasPaidBefore };
  }
  const { data, error } = await sb.from("orders").insert({ status: "pending", payment_status: "pending", ...base }).select("*").single();
  if (error) throw new Error(`upsertOrderFromEvent insert: ${error.message}`);
  return { order: data as Order, customer, wasPaidBefore };
}

/**
 * Compra concluída (pagamento confirmado). Idempotente: só executa uma vez por pedido.
 * 1) pedido já está paid  2) atualiza cliente  3) carrinhos -> recovered  4) purchase + cart_recovered
 * 5) cancela automações de recuperação  6) agenda confirmação transacional  7) envia.
 */
export async function handlePaymentConfirmed(order: Order, customer: Customer | null, wasPaidBefore: boolean): Promise<void> {
  if (wasPaidBefore) return;
  const sb = getSupabaseAdmin();
  const paidAt = order.payment_confirmed_at ?? new Date().toISOString();

  if (customer) {
    const { error } = await sb.rpc("crm_apply_paid_order", { p_customer_id: customer.id, p_total: order.total, p_paid_at: paidAt });
    if (error) console.error("[crm] crm_apply_paid_order", error.message);
    await recoverCustomerCarts(customer.id, order.id, paidAt, order.cart_id);
  }

  await logEvent({ event_type: "purchase", customer_id: customer?.id ?? null, order_id: order.id, cart_id: order.cart_id, metadata: { total: order.total, currency: order.currency, external_order_id: order.external_order_id } });
  await logEvent({ event_type: "payment_confirmed", customer_id: customer?.id ?? null, order_id: order.id, metadata: { paid_at: paidAt, payment_method: order.payment_method } });

  if (customer) {
    let scheduled = 0;
    for (const channel of ["email", "whatsapp"] as const) {
      const r = await scheduleAutomation({ automation_type: "purchase_confirmation", channel, customer, order });
      if (r.created) scheduled++;
    }
    if (scheduled) await processPendingAutomations();
  }
}

export async function handleChargeback(order: Order, customer: Customer | null): Promise<void> {
  const sb = getSupabaseAdmin();
  if (customer) {
    const { error } = await sb.rpc("crm_recalculate_customer_totals", { p_customer_id: customer.id });
    if (error) console.error("[crm] crm_recalculate_customer_totals", error.message);
  }
  await logEvent({ event_type: "refund", customer_id: customer?.id ?? null, order_id: order.id, metadata: { total: order.total, external_order_id: order.external_order_id } });
}

export async function getOrder(id: string): Promise<Order | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("orders").select("*").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  return (data as Order | null) ?? null;
}

const STATUS_EVENT: Partial<Record<OrderStatus, "order_shipped" | "order_delivered">> = { shipped: "order_shipped", delivered: "order_delivered" };

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const sb = getSupabaseAdmin();
  const patch: Partial<Order> = { status };
  if (status === "shipped") patch.shipped_at = new Date().toISOString();
  if (status === "delivered") {
    patch.delivered_at = new Date().toISOString();
    patch.tracking_status = "delivered";
    patch.tracking_status_updated_at = patch.delivered_at;
  }
  const { data, error } = await sb.from("orders").update(patch).eq("id", orderId).eq("store_id", STORE_ID).select("*").single();
  if (error) throw new Error(`updateOrderStatus: ${error.message}`);
  const order = data as Order;
  const ev = STATUS_EVENT[status];
  if (ev) await logEvent({ event_type: ev, customer_id: order.customer_id, order_id: order.id, metadata: { status } });
  return order;
}
