"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, clearAdminSession, isAdminConfigured, requireAdmin, setAdminSession } from "@/lib/crm/auth";
import { getSupabaseAdmin } from "@/lib/crm/supabase";
import { STORE_ID } from "@/lib/crm/config";
import { addTracking, bulkAddTracking, resendTracking, updateTrackingStatus, type BulkTrackingEntry, type BulkTrackingOutcome, type NotifyOutcome } from "@/lib/crm/tracking";
import { getOrder, updateOrderStatus } from "@/lib/crm/orders";
import { getCart, markCartRecovered, processAbandonedCarts } from "@/lib/crm/carts";
import { processPendingAutomations, retryAutomation, scheduleAutomation, sendAutomation } from "@/lib/crm/automations";
import { getEmailStatus } from "@/lib/crm/providers/email";
import { logEvent } from "@/lib/crm/events";
import { saveStoreSettings } from "@/lib/crm/settings";
import { getCustomer } from "@/lib/crm/customers";
import { assistantTurn, isAiConfigured, type AiMessage, type AiTurn } from "@/lib/crm/ai";
import { reprocessWebhookEvent } from "@/lib/crm/webhook";
import { customerDetail, searchCustomers, type CustomerPick } from "./queries";
import type { OrderStatus, TrackingStatus } from "@/lib/crm/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------
export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!isAdminConfigured()) return { ok: false, error: "Defina ADMIN_PASSWORD e ADMIN_SESSION_SECRET nas variáveis de ambiente." };
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) return { ok: false, error: "Senha incorreta." };
  await setAdminSession();
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Pedidos / rastreio
// ---------------------------------------------------------------------------
function describeNotify(notified: NotifyOutcome[], alreadyNotified?: boolean): string {
  if (alreadyNotified) return "cliente já tinha sido avisado antes — use Reenviar rastreio se quiser mandar de novo";
  const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return notified
    .map((n) => {
      const label = n.channel === "email" ? "E-mail" : n.channel === "whatsapp" ? "WhatsApp" : n.channel;
      if (n.sent) return `✅ ${label} enviado para ${n.recipient ?? "cliente"}${n.sentAt ? " às " + hhmm(n.sentAt) : ""}${n.providerMessageId ? " (id " + n.providerMessageId.slice(0, 8) + "…)" : ""}`;
      if (n.created) return `❌ ${label} NÃO enviado: ${n.reason ?? "erro"}`;
      return `${label}: não enviado (${n.reason ?? "indisponível"})`;
    })
    .join("\n");
}

export async function addTrackingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const orderId = String(formData.get("order_id") ?? "");
    const r = await addTracking(orderId, {
      code: String(formData.get("code") ?? ""),
      carrier: String(formData.get("carrier") ?? ""),
      url: String(formData.get("url") ?? ""),
      estimated_delivery_at: String(formData.get("estimated_delivery_at") ?? "") || null,
    });
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    return { ok: true, message: `Rastreio salvo (${r.order.tracking_carrier ?? "transportadora não identificada"}).\n${describeNotify(r.notified, r.alreadyNotified)}` };
  } catch (e) {
    return fail(e);
  }
}

/** Cadastro rápido direto na linha da tabela (sem FormData). */
export async function addTrackingQuickAction(orderId: string, code: string, carrier = "", url = ""): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await addTracking(orderId, { code, carrier, url }, "dashboard-inline");
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/mensagens");
    return { ok: true, message: `📦 Rastreio ${r.order.tracking_code} salvo${r.order.tracking_carrier ? " · " + r.order.tracking_carrier : ""}.\n${describeNotify(r.notified, r.alreadyNotified)}` };
  } catch (e) {
    return fail(e);
  }
}

export type BulkTrackingActionResult = { ok: true; results: BulkTrackingOutcome[]; saved: number; failed: number; emailsSent: number } | { ok: false; error: string };

/** Rastreio em lote: lista colada/CSV ou códigos na ordem da seleção. Cada linha é independente. */
export async function bulkTrackingAction(entries: BulkTrackingEntry[]): Promise<BulkTrackingActionResult> {
  try {
    await requireAdmin();
    if (!Array.isArray(entries) || !entries.length) return { ok: false, error: "Nenhuma linha para processar." };
    const results = await bulkAddTracking(entries.slice(0, 200));
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/mensagens");
    revalidatePath("/admin/automacoes");
    const saved = results.filter((r) => r.ok).length;
    const emailsSent = results.filter((r) => r.notified.some((n) => n.channel === "email" && n.sent)).length;
    return { ok: true, results, saved, failed: results.length - saved, emailsSent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resendTrackingAction(orderId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await resendTracking(orderId);
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/mensagens");
    const anySent = r.notified.some((n) => n.sent);
    const text = `Reenvio do rastreio:\n${describeNotify(r.notified)}`;
    return anySent ? { ok: true, message: text } : { ok: false, error: text };
  } catch (e) {
    return fail(e);
  }
}

const ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
const TRACKING_STATUSES: TrackingStatus[] = ["label_created", "shipped", "in_transit", "out_for_delivery", "delivered", "exception"];


/** Muda o status de vários pedidos de uma vez (ex.: marcar "Em preparação" o que vai sair hoje). */
export async function bulkOrderStatusAction(orderIds: string[], status: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!ORDER_STATUSES.includes(status as OrderStatus)) return { ok: false, error: "Status inválido" };
    const ids = Array.from(new Set(orderIds)).slice(0, 200);
    let n = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await updateOrderStatus(id, status as OrderStatus);
        n++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    revalidatePath("/admin/pedidos");
    const tail = errors.length ? " · erros: " + Array.from(new Set(errors)).slice(0, 3).join("; ") : "";
    if (!n) return { ok: false, error: "Nenhum pedido atualizado" + tail };
    return { ok: true, message: `${n} pedido(s) atualizado(s)${tail}` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateOrderStatusAction(orderId: string, status: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!ORDER_STATUSES.includes(status as OrderStatus)) return { ok: false, error: "Status inválido" };
    await updateOrderStatus(orderId, status as OrderStatus);
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    return { ok: true, message: "Status atualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTrackingStatusAction(orderId: string, status: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!TRACKING_STATUSES.includes(status as TrackingStatus)) return { ok: false, error: "Status de rastreio inválido" };
    await updateTrackingStatus(orderId, status as TrackingStatus);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Status do rastreio atualizado." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Carrinhos
// ---------------------------------------------------------------------------
export async function markCartRecoveredAction(cartId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cart = await getCart(cartId);
    if (!cart) return { ok: false, error: "Carrinho não encontrado" };
    await markCartRecovered(cart, null, true);
    revalidatePath("/admin/carrinhos");
    return { ok: true, message: "Carrinho marcado como recuperado manualmente." };
  } catch (e) {
    return fail(e);
  }
}

export async function logManualContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cartId = String(formData.get("cart_id") ?? "") || null;
    const customerId = String(formData.get("customer_id") ?? "") || null;
    const orderId = String(formData.get("order_id") ?? "") || null;
    const channel = String(formData.get("channel") ?? "whatsapp");
    const note = String(formData.get("note") ?? "").slice(0, 1000);
    if (!customerId) return { ok: false, error: "Cliente obrigatório" };
    await logEvent({ event_type: "manual_contact", customer_id: customerId, cart_id: cartId, order_id: orderId, metadata: { channel, note } });
    const sb = getSupabaseAdmin();
    await sb.from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", customerId);
    revalidatePath("/admin/carrinhos");
    revalidatePath(`/admin/clientes/${customerId}`);
    return { ok: true, message: "Contato manual registrado." };
  } catch (e) {
    return fail(e);
  }
}

/** Agenda a recuperação (e-mail + WhatsApp quando disponível) de UM carrinho; não envia ainda. */
interface RecoveryOutcome {
  /** mensagens realmente aceitas pelo provedor (Resend/Meta) */
  sent: number;
  /** mensagens criadas mas cujo envio falhou */
  failed: number;
  /** canais nem tentados (sem integração, sem contato, sem consentimento…) */
  skipped: number;
  /** uma linha legível por canal */
  lines: string[];
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

/**
 * Dispara a recuperação de UM carrinho e só devolve depois de confirmar o resultado real:
 * 1) cria a automação (pending) → 2) envia na hora pelo provedor → 3) relê a linha no banco
 * (status/sent_at/provider_message_id) → 4) para e-mail, pergunta ao Resend o último evento.
 * Antes o painel dizia "enviado" assim que a automação entrava na fila, sem saber se saiu.
 */
async function scheduleCartRecovery(cartId: string): Promise<RecoveryOutcome> {
  const none = (msg: string): RecoveryOutcome => ({ sent: 0, failed: 0, skipped: 2, lines: [msg] });
  const cart = await getCart(cartId);
  if (!cart) return none("carrinho não encontrado");
  if (cart.status !== "abandoned") return none(`carrinho está "${cart.status}"`);
  if (!cart.customer_id) return none("sem cliente identificado (só e-mail/telefone soltos)");
  const customer = await getCustomer(cart.customer_id);
  if (!customer) return none("cliente não encontrado");

  const out: RecoveryOutcome = { sent: 0, failed: 0, skipped: 0, lines: [] };
  const sb = getSupabaseAdmin();
  for (const channel of ["email", "whatsapp"] as const) {
    const label = channel === "email" ? "E-mail" : "WhatsApp";
    const r = await scheduleAutomation({ automation_type: "abandoned_cart", channel, customer, cart, manual: true });
    if (!r.created || !r.automation) {
      out.skipped++;
      out.lines.push(`${label}: não enviado (${r.reason ?? "motivo desconhecido"})`);
      continue;
    }
    // envia agora e espera a resposta do provedor
    const send = await sendAutomation(r.automation);
    // confirmação independente: o que ficou gravado no banco depois do envio
    const { data: row } = await sb.from("automation_events").select("status,sent_at,recipient,provider,provider_message_id,error_message").eq("id", r.automation.id).maybeSingle();
    const saved = row as { status: string; sent_at: string | null; recipient: string | null; provider: string | null; provider_message_id: string | null; error_message: string | null } | null;
    const reallySent = send.ok && saved?.status === "sent";
    if (reallySent) {
      out.sent++;
      let confirm = "";
      if (channel === "email" && saved?.provider_message_id) {
        const st = await getEmailStatus(saved.provider_message_id);
        const shortId = saved.provider_message_id.slice(0, 8) + "…";
        confirm = st.ok
          ? ` · Resend confirmou: ${st.lastEvent ?? "aceito"} (id ${shortId})`
          : /restricted/i.test(st.error ?? "")
            ? ` · aceito pelo Resend (id ${shortId}; a chave é só de envio, então a entrega não é consultada)`
            : ` · aceito pelo Resend (id ${shortId})`;
      }
      out.lines.push(`✅ ${label} enviado para ${saved?.recipient ?? customer.email ?? "?"} às ${fmtTime(saved?.sent_at)}${confirm}`);
    } else {
      out.failed++;
      out.lines.push(`❌ ${label} NÃO foi enviado: ${saved?.error_message ?? send.error ?? "erro desconhecido"}`);
    }
  }
  return out;
}

/** Dispara a recuperação de um carrinho abandonado agora e confirma se saiu de verdade. */
export async function sendRecoveryNowAction(cartId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await scheduleCartRecovery(cartId);
    revalidatePath("/admin/carrinhos");
    revalidatePath("/admin/automacoes");
    revalidatePath("/admin/mensagens");
    const text = r.lines.join("\n");
    return r.sent > 0 ? { ok: true, message: text } : { ok: false, error: text };
  } catch (e) {
    return fail(e);
  }
}

/** Recuperação em lote (seleção na aba de carrinhos) — conta só o que foi confirmado pelo provedor. */
export async function sendRecoveryBulkAction(cartIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    const ids = Array.from(new Set(cartIds)).slice(0, 100);
    let sent = 0;
    let failed = 0;
    const problems: string[] = [];
    for (const id of ids) {
      const r = await scheduleCartRecovery(id);
      sent += r.sent;
      failed += r.failed;
      for (const line of r.lines) if (line.startsWith("❌")) problems.push(line.replace(/^❌ /, ""));
      if (!r.sent && !r.failed) problems.push(r.lines[0]?.replace(/^.*?: /, "") ?? "pulado");
    }
    revalidatePath("/admin/carrinhos");
    revalidatePath("/admin/automacoes");
    revalidatePath("/admin/mensagens");
    const reasons = Array.from(new Set(problems));
    const summary = `${sent > 0 ? "✅ " : "❌ "}${sent} mensagem(ns) confirmada(s) pelo provedor para ${ids.length} carrinho(s)${failed ? ` · ${failed} falhou(aram)` : ""}${reasons.length ? " · " + reasons.slice(0, 3).join("; ") : ""}`;
    return sent > 0 ? { ok: true, message: summary } : { ok: false, error: summary };
  } catch (e) {
    return fail(e);
  }
}

/** Marca que o operador contatou o cliente por fora (WhatsApp manual, telefone, e-mail manual). */
export async function markContactedAction(cartId: string, channel: string, note = ""): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cart = await getCart(cartId);
    if (!cart) return { ok: false, error: "Carrinho não encontrado" };
    const ch = ["whatsapp", "email", "phone", "sms", "outro"].includes(channel) ? channel : "outro";
    await logEvent({ event_type: "manual_contact", customer_id: cart.customer_id, cart_id: cart.id, metadata: { channel: ch, note: note.slice(0, 500) } });
    if (cart.customer_id) await getSupabaseAdmin().from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", cart.customer_id);
    revalidatePath("/admin/carrinhos");
    return { ok: true, message: "Contato registrado." };
  } catch (e) {
    return fail(e);
  }
}

export async function markContactedBulkAction(cartIds: string[], channel: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const ids = Array.from(new Set(cartIds)).slice(0, 100);
    let n = 0;
    for (const id of ids) {
      const r = await markContactedAction(id, channel);
      if (r.ok) n++;
    }
    return { ok: true, message: `${n} carrinho(s) marcado(s) como contatado(s).` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Automações / processamento
// ---------------------------------------------------------------------------
export async function retryAutomationAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await retryAutomation(id);
    await processPendingAutomations(5);
    revalidatePath("/admin/automacoes");
    return { ok: true, message: "Automação reprocessada." };
  } catch (e) {
    return fail(e);
  }
}

export async function runCartsNowAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await processAbandonedCarts();
    revalidatePath("/admin");
    revalidatePath("/admin/carrinhos");
    return { ok: true, message: `Verificados ${r.checked} · abandonados ${r.abandoned} · recuperados ${r.recovered} · expirados ${r.expired} · automações ${r.automations}${r.skipped.length ? " · pulados: " + r.skipped.slice(0, 5).join("; ") : ""}` };
  } catch (e) {
    return fail(e);
  }
}

export async function runAutomationsNowAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await processPendingAutomations();
    revalidatePath("/admin");
    revalidatePath("/admin/automacoes");
    return { ok: true, message: `Processadas ${r.processed} · enviadas ${r.sent} · falhas ${r.failed}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------
export async function saveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const int = (k: string, min: number, max: number) => {
      const v = Number.parseInt(String(formData.get(k) ?? ""), 10);
      if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Valor inválido para ${k} (${min}–${max})`);
      return v;
    };
    const dt = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw new Error(`Data inválida em ${k}`);
      return d.toISOString();
    };
    await saveStoreSettings({
      abandoned_cart_timeout_minutes: int("abandoned_cart_timeout_minutes", 5, 10080),
      cart_expire_days: int("cart_expire_days", 1, 365),
      automation_dedupe_hours: int("automation_dedupe_hours", 1, 720),
      promotion_active: formData.get("promotion_active") === "on",
      promotion_start_at: dt("promotion_start_at"),
      promotion_end_at: dt("promotion_end_at"),
      promotion_message: String(formData.get("promotion_message") ?? "").trim().slice(0, 300) || null,
    });
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return fail(e);
  }
}

export async function reprocessWebhookAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await reprocessWebhookEvent(id);
    await processPendingAutomations(10);
    revalidatePath("/admin");
    revalidatePath("/admin/carrinhos");
    revalidatePath("/admin/pedidos");
    return r.status === "error" ? { ok: false, error: r.message ?? "erro" } : { ok: true, message: `Webhook ${r.kind}: ${r.status}${r.message ? " (" + r.message + ")" : ""}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Assistente de I.A. (redação e envio de e-mails)
// ---------------------------------------------------------------------------
export async function searchCustomersAction(q: string): Promise<CustomerPick[]> {
  await requireAdmin();
  return searchCustomers(String(q ?? "").slice(0, 80));
}

export type AssistantResult = { ok: true; turn: AiTurn } | { ok: false; error: string };

/** Uma rodada de conversa com a assistente. Não envia nada ao cliente. */
export async function assistantChatAction(customerId: string | null, messages: AiMessage[]): Promise<AssistantResult> {
  try {
    await requireAdmin();
    if (!isAiConfigured()) return { ok: false, error: "Assistente não configurada: defina ANTHROPIC_API_KEY na Vercel (Production) e faça redeploy." };
    const clean: AiMessage[] = (Array.isArray(messages) ? messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
    const ctx = customerId ? await customerDetail(customerId) : null;
    if (customerId && !ctx) return { ok: false, error: "Cliente não encontrado." };
    const turn = await assistantTurn(clean, ctx);
    return { ok: true, turn };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Envia o e-mail redigido (após revisão do operador) pelo mesmo pipeline das automações. */
export async function sendAssistantEmailAction(customerId: string, subject: string, body: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const customer = await getCustomer(customerId);
    if (!customer) return { ok: false, error: "Cliente não encontrado." };
    if (!customer.email) return { ok: false, error: "Este cliente não tem e-mail cadastrado." };
    const subj = String(subject ?? "").trim().slice(0, 200);
    const text = String(body ?? "").trim().slice(0, 20000);
    if (!subj || !text) return { ok: false, error: "Assunto e corpo são obrigatórios." };
    const r = await scheduleAutomation({
      automation_type: "manual_followup",
      channel: "email",
      customer,
      manual: true,
      metadata: { subject: subj, text, source: "ai_assistant" },
    });
    if (!r.created || !r.automation) return { ok: false, error: r.reason ?? "Não foi possível agendar o envio." };
    const sent = await processPendingAutomations(10);
    const sb = getSupabaseAdmin();
    const { data: row } = await sb.from("automation_events").select("status,error_message").eq("id", r.automation.id).maybeSingle();
    await sb.from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", customerId);
    revalidatePath("/admin/mensagens");
    revalidatePath("/admin/automacoes");
    revalidatePath(`/admin/clientes/${customerId}`);
    if (row?.status === "sent") return { ok: true, message: `E-mail enviado para ${customer.email}.` };
    if (row?.status === "failed") return { ok: false, error: `Falha no envio: ${row.error_message ?? "erro desconhecido"}` };
    return { ok: true, message: `E-mail agendado (processadas ${sent.processed}); acompanhe na aba Mensagens enviadas.` };
  } catch (e) {
    return fail(e);
  }
}

// util para as páginas: garante escopo da loja em listagens simples
export async function storeIdAction(): Promise<string> {
  await requireAdmin();
  return STORE_ID;
}

export async function orderExistsAction(id: string): Promise<boolean> {
  await requireAdmin();
  return Boolean(await getOrder(id));
}
