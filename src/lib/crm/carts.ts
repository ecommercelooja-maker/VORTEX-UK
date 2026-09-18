import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_CURRENCY, STORE_ID } from "./config";
import { findOrCreateCustomer, type ContactInput } from "./customers";
import { logEvent } from "./events";
import { getStoreSettings } from "./settings";
import { cancelPendingCartAutomations, processPendingAutomations, scheduleAutomation } from "./automations";
import type { Cart, CartItem, Customer } from "./types";

export interface SiteCartInput {
  session_id: string;
  items?: CartItem[];
  product_summary?: string | null;
  subtotal?: number;
  discount?: number;
  total?: number;
  checkout_url?: string | null;
  contact?: ContactInput | null;
}

function summarize(items: CartItem[] | undefined): string | null {
  if (!items || !items.length) return null;
  return items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(", ").slice(0, 300);
}

/** Carrinho ativo da sessão (site): cria ou atualiza a atividade. Não marca abandono aqui. */
export async function upsertSiteCart(input: SiteCartInput): Promise<Cart> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const customer = input.contact ? await findOrCreateCustomer({ ...input.contact, session_id: input.session_id, source: input.contact.source ?? "site" }) : null;

  const { data: existing } = await sb
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("session_id", input.session_id)
    .in("status", ["active", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const items = input.items ?? (existing?.items as CartItem[] | undefined) ?? [];
  const subtotal = input.subtotal ?? items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const patch = {
    store_id: STORE_ID,
    session_id: input.session_id,
    source: "site" as const,
    customer_id: customer?.id ?? existing?.customer_id ?? null,
    email: customer?.email ?? existing?.email ?? null,
    phone: customer?.phone ?? existing?.phone ?? null,
    whatsapp: customer?.whatsapp ?? existing?.whatsapp ?? null,
    items,
    product_summary: input.product_summary ?? summarize(items) ?? existing?.product_summary ?? null,
    currency: STORE_CURRENCY,
    subtotal,
    discount: input.discount ?? existing?.discount ?? 0,
    total: input.total ?? subtotal - (input.discount ?? existing?.discount ?? 0),
    checkout_url: input.checkout_url ?? existing?.checkout_url ?? null,
    last_activity_at: now,
    // nova atividade em carrinho já abandonado: volta a "active" (o cron decide de novo)
    status: "active" as const,
  };

  if (existing) {
    const { data, error } = await sb.from("abandoned_carts").update(patch).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`upsertSiteCart update: ${error.message}`);
    return data as Cart;
  }
  const { data, error } = await sb.from("abandoned_carts").insert(patch).select("*").single();
  if (error) throw new Error(`upsertSiteCart insert: ${error.message}`);
  return data as Cart;
}

/** Vincula o cliente ao carrinho ativo/abandonado da sessão, SEM criar carrinho novo (newsletter, formulários). */
export async function attachContactToSessionCart(sessionId: string, customer: Customer): Promise<Cart | null> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("session_id", sessionId)
    .in("status", ["active", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existing) return null;
  const { data } = await sb
    .from("abandoned_carts")
    .update({ customer_id: existing.customer_id ?? customer.id, email: existing.email ?? customer.email, phone: existing.phone ?? customer.phone, whatsapp: existing.whatsapp ?? customer.whatsapp })
    .eq("id", existing.id)
    .select("*")
    .single();
  return (data as Cart | null) ?? null;
}

export interface CheckoutCartInput {
  external_cart_id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  currency?: string | null;
  checkout_url?: string | null;
  contact: ContactInput;
}

/** Carrinho vindo do checkout externo (Umpi: checkout iniciado / pagamento pendente / abandonado). */
export async function upsertCheckoutCart(input: CheckoutCartInput): Promise<{ cart: Cart; customer: Customer | null }> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const customer = await findOrCreateCustomer({ ...input.contact, source: "checkout" });

  const { data: existing } = await sb
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("external_cart_id", input.external_cart_id)
    .maybeSingle();

  const patch = {
    store_id: STORE_ID,
    external_cart_id: input.external_cart_id,
    source: "checkout" as const,
    customer_id: customer?.id ?? existing?.customer_id ?? null,
    email: customer?.email ?? existing?.email ?? null,
    phone: customer?.phone ?? existing?.phone ?? null,
    whatsapp: customer?.whatsapp ?? existing?.whatsapp ?? null,
    items: input.items.length ? input.items : (existing?.items as CartItem[] | undefined) ?? [],
    product_summary: summarize(input.items) ?? existing?.product_summary ?? null,
    currency: input.currency || STORE_CURRENCY,
    subtotal: input.subtotal,
    discount: input.discount,
    total: input.total,
    checkout_url: input.checkout_url ?? existing?.checkout_url ?? null,
    last_activity_at: now,
  };

  if (existing) {
    // carrinho já recuperado/expirado não volta a ficar ativo
    const status = existing.status === "recovered" || existing.status === "manually_recovered" || existing.status === "expired" ? existing.status : "active";
    const { data, error } = await sb.from("abandoned_carts").update({ ...patch, status }).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`upsertCheckoutCart update: ${error.message}`);
    return { cart: data as Cart, customer };
  }
  const { data, error } = await sb.from("abandoned_carts").insert({ ...patch, status: "active" }).select("*").single();
  if (error) throw new Error(`upsertCheckoutCart insert: ${error.message}`);
  const cart = data as Cart;
  await logEvent({ event_type: "checkout_started", customer_id: customer?.id ?? null, cart_id: cart.id, metadata: { source: "checkout", external_cart_id: input.external_cart_id, total: input.total } });
  return { cart, customer };
}

export async function markCartRecovered(cart: Cart, orderId: string | null, manual = false): Promise<void> {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  await sb
    .from("abandoned_carts")
    .update({ status: manual ? "manually_recovered" : "recovered", recovered_at: now, recovered_order_id: orderId })
    .eq("id", cart.id);
  const cancelled = await cancelPendingCartAutomations(cart.id, manual ? "recuperado manualmente" : "compra concluída");
  await logEvent({ event_type: "cart_recovered", customer_id: cart.customer_id, cart_id: cart.id, order_id: orderId, metadata: { manual, cancelled_automations: cancelled } });
}

/** Carrinhos do cliente que ainda estão ativos/abandonados e foram criados antes do pagamento. */
export async function recoverCustomerCarts(customerId: string, orderId: string, paidAt: string, explicitCartId?: string | null): Promise<number> {
  const sb = getSupabaseAdmin();
  let q = sb.from("abandoned_carts").select("*").eq("store_id", STORE_ID).in("status", ["active", "abandoned"]);
  q = explicitCartId ? q.or(`id.eq.${explicitCartId},customer_id.eq.${customerId}`) : q.eq("customer_id", customerId);
  const { data } = await q.lte("created_at", paidAt);
  let n = 0;
  for (const cart of (data ?? []) as Cart[]) {
    await markCartRecovered(cart, orderId, false);
    n++;
  }
  return n;
}

async function hasPaidOrderSince(customerId: string, since: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("orders")
    .select("id")
    .eq("store_id", STORE_ID)
    .eq("customer_id", customerId)
    .eq("payment_status", "paid")
    .gte("payment_confirmed_at", since)
    .limit(1);
  return Boolean(data && data.length);
}

async function hasRecoveryAutomation(cartId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("automation_events")
    .select("id")
    .eq("cart_id", cartId)
    .eq("automation_type", "abandoned_cart")
    .in("status", ["pending", "processing", "sent", "delivered"])
    .limit(1);
  return Boolean(data && data.length);
}

/**
 * Marca um carrinho ativo como abandonado, registra o evento e agenda a recuperação
 * (e-mail/WhatsApp) para o cliente identificado. Usado pelo cron e pelo webhook
 * CHECKOUT_ABANDONED do Umpi (que já é o sinal de abandono do próprio checkout).
 * Não envia: quem envia é processPendingAutomations().
 */
export async function markCartAbandoned(cart: Cart): Promise<{ automations: number; skipped: string[] }> {
  const sb = getSupabaseAdmin();
  const skipped: string[] = [];
  let automations = 0;
  const now = new Date().toISOString();
  if (cart.status === "active") {
    await sb.from("abandoned_carts").update({ status: "abandoned", abandoned_at: now }).eq("id", cart.id).eq("status", "active");
    await logEvent({ event_type: "checkout_abandoned", customer_id: cart.customer_id, cart_id: cart.id, session_id: cart.session_id, metadata: { total: cart.total, product_summary: cart.product_summary } });
  }
  if (!cart.customer_id) return { automations, skipped: [`${cart.id}: sem contato`] };
  if (await hasRecoveryAutomation(cart.id)) return { automations, skipped: [`${cart.id}: automação já enviada`] };
  const { data: customer } = await sb.from("customers").select("*").eq("id", cart.customer_id).maybeSingle();
  if (!customer) return { automations, skipped: [`${cart.id}: cliente não encontrado`] };
  const abandoned: Cart = { ...cart, status: "abandoned", abandoned_at: cart.abandoned_at ?? now };
  for (const channel of ["email", "whatsapp"] as const) {
    const r = await scheduleAutomation({ automation_type: "abandoned_cart", channel, customer: customer as Customer, cart: abandoned });
    if (r.created) automations++;
    else skipped.push(`${cart.email ?? cart.id}/${channel}: ${r.reason}`);
  }
  return { automations, skipped };
}

export interface ProcessCartsResult {
  checked: number;
  abandoned: number;
  recovered: number;
  expired: number;
  automations: number;
  skipped: string[];
}

/**
 * Identificação do abandono (cron). Um carrinho só vira "abandoned" após o timeout
 * configurado sem atividade e depois de verificar: pedido pago? já recuperado? automação já enviada?
 * Só então cria as automações de recuperação (respeitando contato + consentimento + integração).
 */
export async function processAbandonedCarts(): Promise<ProcessCartsResult> {
  const sb = getSupabaseAdmin();
  const settings = await getStoreSettings();
  const cutoff = new Date(Date.now() - settings.abandoned_cart_timeout_minutes * 60e3).toISOString();
  const result: ProcessCartsResult = { checked: 0, abandoned: 0, recovered: 0, expired: 0, automations: 0, skipped: [] };

  // 1) expira carrinhos abandonados antigos
  const expireBefore = new Date(Date.now() - settings.cart_expire_days * 864e5).toISOString();
  const { data: expired } = await sb
    .from("abandoned_carts")
    .update({ status: "expired" })
    .eq("store_id", STORE_ID)
    .in("status", ["active", "abandoned"])
    .lt("last_activity_at", expireBefore)
    .select("id");
  result.expired = expired?.length ?? 0;

  // 2) carrinhos ativos sem atividade há mais que o timeout
  const { data: carts, error } = await sb
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("status", "active")
    .lt("last_activity_at", cutoff)
    .order("last_activity_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`processAbandonedCarts: ${error.message}`);

  for (const cart of (carts ?? []) as Cart[]) {
    result.checked++;
    // carrinho vazio (sem itens e sem valor) não tem o que recuperar
    if ((!cart.items || cart.items.length === 0) && Number(cart.total) <= 0) {
      await sb.from("abandoned_carts").update({ status: "expired" }).eq("id", cart.id).eq("status", "active");
      result.expired++;
      continue;
    }
    // 2a) existe pedido pago desde a criação do carrinho? -> recuperado
    if (cart.customer_id && (await hasPaidOrderSince(cart.customer_id, cart.created_at))) {
      await markCartRecovered(cart, null, false);
      result.recovered++;
      continue;
    }
    // 2b) marca como abandonado e agenda a recuperação
    const r = await markCartAbandoned(cart);
    result.abandoned++;
    result.automations += r.automations;
    result.skipped.push(...r.skipped);
  }

  // 2e) carrinhos já abandonados com cliente identificado e SEM recuperação (ex.: consentimento
  //     não vinha do checkout, ou o webhook chegou quando o envio falhou) — agenda agora.
  const { data: pendingCarts } = await sb
    .from("abandoned_carts")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("status", "abandoned")
    .not("customer_id", "is", null)
    .gte("last_activity_at", expireBefore)
    .order("last_activity_at", { ascending: false })
    .limit(100);
  for (const cart of (pendingCarts ?? []) as Cart[]) {
    if (!cart.customer_id) continue;
    if ((!cart.items || cart.items.length === 0) && Number(cart.total) <= 0) continue;
    if (await hasRecoveryAutomation(cart.id)) continue;
    if (await hasPaidOrderSince(cart.customer_id, cart.created_at)) {
      await markCartRecovered(cart, null, false);
      result.recovered++;
      continue;
    }
    const { data: customer } = await sb.from("customers").select("*").eq("id", cart.customer_id).maybeSingle();
    if (!customer) continue;
    result.checked++;
    for (const channel of ["email", "whatsapp"] as const) {
      const r = await scheduleAutomation({ automation_type: "abandoned_cart", channel, customer: customer as Customer, cart });
      if (r.created) result.automations++;
      else if (channel === "email") result.skipped.push(`${cart.email ?? cart.id}: ${r.reason}`);
    }
  }

  // 3) envia o que ficou pendente
  if (result.automations) await processPendingAutomations();
  return result;
}

export async function getCart(id: string): Promise<Cart | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("abandoned_carts").select("*").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  return (data as Cart | null) ?? null;
}
