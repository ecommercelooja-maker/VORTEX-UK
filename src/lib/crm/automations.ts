import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_CURRENCY, STORE_ID, STORE_LOCALE, STORE_NAME } from "./config";
import { SITE_URL } from "@/lib/site";
import { company } from "@/data/company";
import { logEvent } from "./events";
import { getStoreSettings } from "./settings";
import { getPromotionState } from "./promotion";
import { isEmailConfigured, sendEmail, type SendResult } from "./providers/email";
import { isWhatsAppConfigured, sendWhatsApp, type WhatsAppTemplate } from "./providers/whatsapp";
import { detectCustomerCountry, langForCountry } from "./country";
import { firstName } from "./normalize";
import { formatMoney } from "./money";
import {
  abandonedCartEmail,
  abandonedCartWhatsApp,
  langFromLocale,
  manualEmail,
  purchaseConfirmationEmail,
  purchaseConfirmationWhatsApp,
  trackingEmail,
  trackingWhatsApp,
  type TemplateContext,
} from "./templates";
import type { AutomationEvent, AutomationType, Cart, Channel, Customer, Order } from "./types";

export const templateContext: TemplateContext = {
  lang: langFromLocale(STORE_LOCALE),
  locale: STORE_LOCALE,
  currency: STORE_CURRENCY,
  storeName: STORE_NAME,
  siteUrl: SITE_URL,
  supportEmail: company.email,
};

export interface ScheduleInput {
  automation_type: AutomationType;
  channel: Channel;
  customer: Customer;
  cart?: Cart | null;
  order?: Order | null;
  /** força uma nova chave (reenvio manual) */
  manual?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ScheduleResult {
  created: boolean;
  reason?: string;
  automation?: AutomationEvent;
}

/** Canal disponível = contato existe + integração configurada. */
export function channelAvailable(channel: Channel, customer: Customer): { ok: boolean; reason?: string } {
  if (channel === "email") {
    if (!customer.email) return { ok: false, reason: "cliente sem e-mail" };
    if (!isEmailConfigured()) return { ok: false, reason: "provedor de e-mail não configurado" };
    return { ok: true };
  }
  if (channel === "whatsapp") {
    if (!(customer.whatsapp || customer.phone)) return { ok: false, reason: "cliente sem telefone" };
    if (!isWhatsAppConfigured()) return { ok: false, reason: "integração de WhatsApp não configurada" };
    return { ok: true };
  }
  return { ok: false, reason: "SMS não implementado" };
}

/**
 * Consentimento de marketing: exigido para lembretes promocionais e para recuperação de carrinhos
 * capturados no site (newsletter). Carrinhos do CHECKOUT (o cliente informou o e-mail para comprar
 * e o Umpi não transmite opt-in) recebem a recuperação como continuidade da compra em andamento.
 * Transacionais (confirmação, rastreio) nunca exigem.
 */
export function requiresMarketingConsent(type: AutomationType, cart?: Cart | null): boolean {
  if (type === "promotion_reminder") return true;
  if (type === "abandoned_cart") return cart?.source !== "checkout";
  return false;
}

export function hasConsent(channel: Channel, customer: Customer): boolean {
  if (channel === "email") return customer.marketing_email_opt_in;
  if (channel === "whatsapp") return customer.marketing_whatsapp_opt_in;
  return customer.marketing_sms_opt_in;
}

function recipientFor(channel: Channel, customer: Customer): string | null {
  if (channel === "email") return customer.email;
  if (channel === "whatsapp") return customer.whatsapp || customer.phone;
  return customer.phone;
}

/**
 * Cria uma automação de forma idempotente.
 * - Verifica store_id + cart_id/order_id + automation_type + channel dentro da janela configurada.
 * - Índice único em dedupe_key garante que duas execuções concorrentes não dupliquem.
 * - Não envia nada aqui: o envio acontece em processPendingAutomations().
 */
export async function scheduleAutomation(input: ScheduleInput): Promise<ScheduleResult> {
  const { automation_type, channel, customer, cart, order } = input;
  const sb = getSupabaseAdmin();
  const settings = await getStoreSettings();

  const avail = channelAvailable(channel, customer);
  if (!avail.ok) return { created: false, reason: avail.reason };
  if (requiresMarketingConsent(automation_type, cart) && !hasConsent(channel, customer)) {
    return { created: false, reason: `sem consentimento de marketing (${channel})` };
  }
  const scope = cart ? `cart:${cart.id}` : order ? `order:${order.id}` : `customer:${customer.id}`;

  if (!input.manual) {
    // já existe uma equivalente recente (pendente, enviada ou entregue)?
    const since = new Date(Date.now() - settings.automation_dedupe_hours * 36e5).toISOString();
    let q = sb
      .from("automation_events")
      .select("id,status,created_at")
      .eq("store_id", STORE_ID)
      .eq("automation_type", automation_type)
      .eq("channel", channel)
      .in("status", ["pending", "processing", "sent", "delivered"])
      .gte("created_at", since)
      .limit(1);
    q = cart ? q.eq("cart_id", cart.id) : order ? q.eq("order_id", order.id) : q.eq("customer_id", customer.id);
    const { data: dup } = await q;
    if (dup && dup.length) return { created: false, reason: "automação equivalente já existe no período" };
  }

  const dedupe_key = input.manual
    ? `${STORE_ID}:${scope}:${automation_type}:${channel}:manual:${Date.now()}`
    : `${STORE_ID}:${scope}:${automation_type}:${channel}:auto`;

  const { data, error } = await sb
    .from("automation_events")
    .insert({
      store_id: STORE_ID,
      customer_id: customer.id,
      cart_id: cart?.id ?? null,
      order_id: order?.id ?? null,
      channel,
      automation_type,
      status: "pending",
      // relógio do app (não o default now() do banco): evita ficar "pendente" por diferença de segundos entre os relógios
      scheduled_at: new Date().toISOString(),
      dedupe_key,
      recipient: recipientFor(channel, customer),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { created: false, reason: "automação já registrada (idempotência)" };
    throw new Error(`scheduleAutomation: ${error.message}`);
  }
  return { created: true, automation: data as AutomationEvent };
}

/** Cancela automações pendentes de recuperação de um carrinho (compra concluída). */
export async function cancelPendingCartAutomations(cartId: string, reason: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("automation_events")
    .update({ status: "cancelled", error_message: reason })
    .eq("store_id", STORE_ID)
    .eq("cart_id", cartId)
    .in("automation_type", ["abandoned_cart", "promotion_reminder"])
    .in("status", ["pending", "processing"])
    .select("id");
  if (error) throw new Error(`cancelPendingCartAutomations: ${error.message}`);
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

async function buildMessage(a: AutomationEvent, customer: Customer, cart: Cart | null, order: Order | null) {
  const ctx = templateContext;
  if (a.automation_type === "abandoned_cart" || a.automation_type === "promotion_reminder") {
    if (!cart) throw new Error("carrinho não encontrado");
    const settings = await getStoreSettings();
    const promotion = getPromotionState(settings);
    // idioma pelo país do cliente (França → francês, Reino Unido → inglês); fallback: idioma da loja
    const country = await detectCustomerCountry(customer);
    const localCtx: TemplateContext = { ...ctx, lang: langForCountry(country, ctx.lang) };
    const data = {
      customerName: customer.name,
      items: cart.items ?? [],
      total: Number(cart.total) || 0,
      checkoutUrl: cart.checkout_url || `${SITE_URL}/`,
      promotion,
    };
    const msg =
      a.channel === "email"
        ? abandonedCartEmail(localCtx, data)
        : {
            text: abandonedCartWhatsApp(localCtx, data),
            template: waTemplate("abandoned_cart", localCtx.lang, [
              firstName(data.customerName) || genericName(localCtx.lang),
              cartSummary(data.items, data.total, localCtx),
              data.checkoutUrl,
            ]),
          };
    return { ...msg, country, lang: localCtx.lang };
  }
  if (a.automation_type === "purchase_confirmation") {
    if (!order) throw new Error("pedido não encontrado");
    const data = {
      customerName: customer.name || order.customer_name,
      orderNumber: order.external_order_id,
      items: order.items ?? [],
      total: Number(order.total) || 0,
      shippingAddress: order.shipping_address,
      orderStatus: order.status,
    };
    if (a.channel === "email") return purchaseConfirmationEmail(ctx, data);
    return {
      text: purchaseConfirmationWhatsApp(ctx, data),
      // {{1}} nome, {{2}} nº do pedido, {{3}} total, {{4}} link dos detalhes (checkout do Umpi; fallback: site)
      template: waTemplate("purchase_confirmation", ctx.lang, [
        firstName(data.customerName) || genericName(ctx.lang),
        data.orderNumber,
        formatMoney(data.total, ctx.currency, ctx.locale),
        order.checkout_url || SITE_URL,
      ]),
    };
  }
  if (a.automation_type === "tracking_notification") {
    if (!order || !order.tracking_code) throw new Error("pedido sem código de rastreio");
    const data = {
      customerName: customer.name || order.customer_name,
      orderNumber: order.external_order_id,
      trackingCode: order.tracking_code,
      carrier: order.tracking_carrier,
      trackingUrl: order.tracking_url,
    };
    if (a.channel === "email") return trackingEmail(ctx, data);
    return {
      text: trackingWhatsApp(ctx, data),
      // {{1}} nome, {{2}} nº do pedido, {{3}} código, {{4}} link (sem URL da transportadora: rastreador universal)
      template: waTemplate("tracking_notification", ctx.lang, [
        firstName(data.customerName) || genericName(ctx.lang),
        data.orderNumber,
        data.trackingCode,
        data.trackingUrl || `https://t.17track.net/${ctx.lang}#nums=${encodeURIComponent(data.trackingCode)}`,
      ]),
    };
  }
  // manual_followup: texto livre em metadata.text / metadata.subject (operador ou assistente de I.A.)
  const text = String(a.metadata?.text ?? "");
  const subject = String(a.metadata?.subject ?? "");
  if (!text) throw new Error("mensagem manual vazia");
  return a.channel === "email" ? manualEmail(ctx, { subject: subject || STORE_NAME, body: text }) : { text };
}

export type RenderedMessage = ({ subject: string; html: string; text: string } | { text: string; template?: WhatsAppTemplate }) & { country?: string; lang?: string };

function waTemplate(kind: WhatsAppTemplate["kind"], lang: string, params: string[]): WhatsAppTemplate {
  return { kind, lang, params };
}

/** Resumo do carrinho em uma linha para o template ("VORTEX Z10 x2 · 169,80 €"). */
function cartSummary(items: Cart["items"], total: number, ctx: TemplateContext): string {
  const names = (items ?? []).map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");
  const money = formatMoney(total, ctx.currency, ctx.locale);
  return names ? `${names} · ${money}` : money;
}

/** Nome neutro quando o cliente não tem nome (parâmetros de template da Meta não podem ser vazios). */
function genericName(lang: string): string {
  return { fr: "cher client", pt: "cliente", en: "there", de: "liebe Kundin, lieber Kunde" }[lang] || "client";
}

/**
 * Reconstrói a mensagem de uma automação a partir dos templates atuais (usado na aba Mensagens enviadas
 * para automações antigas que ainda não guardaram o corpo em metadata.body_html).
 */
export async function renderAutomationMessage(a: AutomationEvent): Promise<RenderedMessage> {
  const sb = getSupabaseAdmin();
  const [{ data: customer }, { data: cart }, { data: order }] = await Promise.all([
    a.customer_id ? sb.from("customers").select("*").eq("id", a.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    a.cart_id ? sb.from("abandoned_carts").select("*").eq("id", a.cart_id).maybeSingle() : Promise.resolve({ data: null }),
    a.order_id ? sb.from("orders").select("*").eq("id", a.order_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!customer) throw new Error("cliente não encontrado");
  return buildMessage(a, customer as Customer, cart as Cart | null, order as Order | null);
}

/** Envia UMA automação (marca processing -> sent/failed) e registra o evento na timeline. */
export async function sendAutomation(a: AutomationEvent): Promise<SendResult> {
  const sb = getSupabaseAdmin();
  // trava otimista: só processa se ainda estiver pending
  const { data: locked } = await sb
    .from("automation_events")
    .update({ status: "processing", attempts: (a.attempts ?? 0) + 1 })
    .eq("id", a.id)
    .eq("status", "pending")
    .select("id");
  if (!locked || !locked.length) return { ok: false, provider: "", error: "já processada por outra execução" };

  let result: SendResult;
  let subject: string | null = null;
  // corpo enviado (guardado em metadata para a aba Mensagens enviadas; a tabela não precisa de coluna nova)
  let body: { body_html?: string; body_text?: string; country?: string; lang?: string } = {};
  try {
    const [{ data: customer }, { data: cart }, { data: order }] = await Promise.all([
      a.customer_id ? sb.from("customers").select("*").eq("id", a.customer_id).maybeSingle() : Promise.resolve({ data: null }),
      a.cart_id ? sb.from("abandoned_carts").select("*").eq("id", a.cart_id).maybeSingle() : Promise.resolve({ data: null }),
      a.order_id ? sb.from("orders").select("*").eq("id", a.order_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!customer) throw new Error("cliente não encontrado");

    // Guarda final: recuperação não é enviada se o carrinho já foi recuperado/expirado
    if ((a.automation_type === "abandoned_cart" || a.automation_type === "promotion_reminder") && cart && cart.status !== "abandoned") {
      await sb.from("automation_events").update({ status: "cancelled", error_message: `carrinho ${cart.status}` }).eq("id", a.id);
      return { ok: false, provider: "", error: `carrinho ${cart.status}` };
    }

    const msg = await buildMessage(a, customer as Customer, cart as Cart | null, order as Order | null);
    const to = a.recipient || (a.channel === "email" ? customer.email : customer.whatsapp || customer.phone);
    if (!to) throw new Error("destinatário vazio");

    const locale = "country" in msg && msg.country ? { country: msg.country, lang: msg.lang } : {};
    if (a.channel === "email" && "subject" in msg) {
      subject = msg.subject;
      body = { body_html: msg.html, body_text: msg.text, ...locale };
      result = await sendEmail({ to, subject: msg.subject, html: msg.html, text: msg.text, tags: { store: STORE_ID, type: a.automation_type } });
    } else if (a.channel === "whatsapp") {
      body = { body_text: msg.text, ...locale };
      result = await sendWhatsApp({ to, text: msg.text, template: "template" in msg ? msg.template : undefined });
    } else {
      result = { ok: false, provider: "none", error: "canal não suportado" };
    }
  } catch (e) {
    result = { ok: false, provider: "", error: e instanceof Error ? e.message : String(e) };
  }

  const now = new Date().toISOString();
  await sb
    .from("automation_events")
    .update({
      status: result.ok ? "sent" : "failed",
      provider: result.provider || null,
      provider_message_id: result.providerMessageId ?? null,
      sent_at: result.ok ? now : null,
      error_message: result.ok ? null : result.error ?? "erro desconhecido",
      subject,
      metadata: { ...(a.metadata ?? {}), ...body },
    })
    .eq("id", a.id);

  if (result.ok) {
    await logEvent({
      event_type: a.channel === "email" ? "email_sent" : "whatsapp_sent",
      customer_id: a.customer_id,
      cart_id: a.cart_id,
      order_id: a.order_id,
      metadata: { automation_id: a.id, automation_type: a.automation_type, subject },
    });
    if (a.automation_type === "tracking_notification" && a.order_id) {
      await sb.from("orders").update({ tracking_sent_at: now, tracking_notification_sent: true }).eq("id", a.order_id);
      await logEvent({ event_type: "tracking_sent", customer_id: a.customer_id, order_id: a.order_id, metadata: { channel: a.channel, automation_id: a.id } });
    }
  }
  return result;
}

/** Processa automações pendentes já agendadas (chamado pelo cron e após eventos importantes). */
export async function processPendingAutomations(limit = 50): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("automation_events")
    .select("*")
    .eq("store_id", STORE_ID)
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`processPendingAutomations: ${error.message}`);
  let sent = 0;
  let failed = 0;
  for (const a of (data ?? []) as AutomationEvent[]) {
    const r = await sendAutomation(a);
    if (r.ok) sent++;
    else failed++;
  }
  return { processed: data?.length ?? 0, sent, failed };
}

/** Recoloca uma automação falha na fila (ação manual do dashboard). */
export async function retryAutomation(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("automation_events")
    .update({ status: "pending", error_message: null, scheduled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("store_id", STORE_ID)
    .eq("status", "failed");
  if (error) throw new Error(`retryAutomation: ${error.message}`);
}
