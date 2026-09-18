import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { STORE_CURRENCY, STORE_LOCALE, STORE_NAME } from "./config";
import { SITE_URL } from "@/lib/site";
import { company } from "@/data/company";
import { CHECKOUT_URL, product } from "@/data/product";
import { formatMoney } from "./money";
import { langFromLocale } from "./templates";
import { getStoreSettings } from "./settings";
import { getPromotionState } from "./promotion";
import type { AutomationEvent, Cart, Customer, CustomerEvent, Order } from "./types";

/**
 * Assistente de I.A. do dashboard (Claude, via SDK oficial da Anthropic).
 * Ajuda o operador a redigir e-mails para clientes no idioma da loja.
 * Ativo somente quando ANTHROPIC_API_KEY está definida (servidor). Nada é enviado ao cliente
 * sem o clique explícito do operador em "Enviar" (ver sendAssistantEmailAction).
 */
export const AI_MODEL = (process.env.ANTHROPIC_MODEL || "claude-opus-5").trim();

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiDraft {
  subject: string;
  body: string;
}

export interface AiTurn {
  reply: string;
  draft: AiDraft | null;
}

export interface AssistantCustomerContext {
  customer: Customer;
  orders: Order[];
  carts: Cart[];
  events: CustomerEvent[];
  automations: AutomationEvent[];
}

const LANG_NAME: Record<string, string> = { fr: "francês", pt: "português do Brasil", en: "inglês britânico", de: "alemão" };
const SIGNATURE: Record<string, string> = { fr: `L'équipe ${STORE_NAME}`, pt: `Equipe ${STORE_NAME}`, en: `The ${STORE_NAME} team`, de: `Ihr ${STORE_NAME}-Team` };

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Resposta curta ao operador, em português do Brasil." },
    has_draft: { type: "boolean", description: "true quando há um e-mail pronto (ou atualizado) para o cliente." },
    subject: { type: "string", description: "Assunto do e-mail no idioma do cliente. Vazio se has_draft=false." },
    body: {
      type: "string",
      description: "Corpo do e-mail em texto simples (parágrafos separados por linha em branco), no idioma do cliente, já com saudação e assinatura. Vazio se has_draft=false.",
    },
  },
  required: ["reply", "has_draft", "subject", "body"],
  additionalProperties: false,
};

function fmt(v: number | string | null | undefined, currency = STORE_CURRENCY): string {
  return formatMoney(v, currency, "pt-BR");
}

function day(v: string | null | undefined): string {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

/** Resumo compacto (texto) do cliente para o modelo. Só dados desta loja, nada de segredos. */
export function describeCustomer(ctx: AssistantCustomerContext): string {
  const { customer: c, orders, carts, events, automations } = ctx;
  const lines: string[] = [];
  lines.push(`Nome: ${c.name ?? "(desconhecido)"}`);
  lines.push(`E-mail: ${c.email ?? "(sem e-mail — não é possível enviar)"}`);
  lines.push(`Telefone/WhatsApp: ${c.whatsapp ?? c.phone ?? "—"}`);
  lines.push(`Consentimento marketing por e-mail: ${c.marketing_email_opt_in ? "sim" : "não"}`);
  lines.push(`Cliente desde: ${day(c.created_at)} · pedidos: ${c.total_orders} · total gasto: ${fmt(c.total_spent)} · última atividade: ${day(c.last_activity_at)}`);
  lines.push("");
  lines.push(`Pedidos (${orders.length}):`);
  if (!orders.length) lines.push("  nenhum");
  for (const o of orders.slice(0, 10)) {
    const items = (o.items ?? []).map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ") || "—";
    const track = o.tracking_code
      ? `rastreio ${o.tracking_code}${o.tracking_carrier ? ` (${o.tracking_carrier})` : ""}${o.tracking_url ? ` ${o.tracking_url}` : ""}, status do rastreio: ${o.tracking_status ?? "—"}`
      : "sem código de rastreio";
    lines.push(
      `  #${o.external_order_id} · ${day(o.created_at)} · ${fmt(o.total, o.currency)} · status: ${o.status} · pagamento: ${o.payment_status} · itens: ${items} · ${track}${o.estimated_delivery_at ? ` · previsão de entrega ${day(o.estimated_delivery_at)}` : ""}`,
    );
  }
  lines.push("");
  lines.push(`Carrinhos (${carts.length}):`);
  if (!carts.length) lines.push("  nenhum");
  for (const k of carts.slice(0, 5)) {
    lines.push(`  ${day(k.last_activity_at)} · ${k.product_summary ?? "—"} · ${fmt(k.total, k.currency)} · status: ${k.status}${k.checkout_url ? ` · link do checkout: ${k.checkout_url}` : ""}`);
  }
  lines.push("");
  lines.push("Últimas mensagens automáticas enviadas:");
  const sent = automations.filter((a) => a.status === "sent" || a.status === "delivered").slice(-8);
  if (!sent.length) lines.push("  nenhuma");
  for (const a of sent) lines.push(`  ${day(a.sent_at)} · ${a.channel} · ${a.automation_type} · "${a.subject ?? ""}"`);
  lines.push("");
  lines.push("Últimos eventos:");
  for (const e of events.slice(-12)) {
    const note = typeof e.metadata?.note === "string" && e.metadata.note ? ` — ${e.metadata.note}` : "";
    lines.push(`  ${day(e.created_at)} · ${e.event_type}${note}`);
  }
  return lines.join("\n");
}

async function systemPrompt(customerText: string | null): Promise<string> {
  const lang = langFromLocale(STORE_LOCALE);
  const langName = LANG_NAME[lang] ?? lang;
  const settings = await getStoreSettings();
  const promo = getPromotionState(settings);
  const storeFacts = [
    `Loja: ${STORE_NAME} (${company.tradingName}) — site ${SITE_URL}`,
    `Produto: ${product.title} — preço ${product.price} (antes ${product.comparePrice}, ${product.discountLabel})`,
    `Argumentos: ${product.bullets.join(" · ")}`,
    `Link do checkout: ${CHECKOUT_URL}`,
    `E-mail de atendimento: ${company.email} · horário: ${company.serviceHours}`,
    "Políticas: direito de cancelamento de 14 dias (lei britânica — Consumer Contracts Regulations 2013) e garantia de reembolso de 60 dias; entrega expressa gratuita no Reino Unido; pagamento seguro.",
    promo.active
      ? `Promoção ativa: ${promo.message ?? "sim"}${promo.isLastDay ? " (ÚLTIMO DIA)" : ""}${promo.endsAt ? ` — termina ${day(promo.endsAt.toISOString())}` : ""}`
      : "Nenhuma promoção ativa no momento.",
  ].join("\n");

  return `Você é a assistente de atendimento e vendas do CRM da loja ${STORE_NAME}. Você conversa com o OPERADOR da loja (em português do Brasil) e redige E-MAILS para os CLIENTES, que são falantes de ${langName}.

Regras:
- Fale com o operador em português do Brasil, de forma curta e direta.
- Escreva o e-mail ao cliente inteiramente em ${langName}, tom cordial, profissional e humano, com saudação pelo primeiro nome (quando houver) e assinatura "${SIGNATURE[lang] ?? STORE_NAME}". Texto simples, sem HTML e sem markdown; parágrafos separados por uma linha em branco.
- Use SOMENTE os dados fornecidos abaixo (loja, pedidos, rastreio, carrinhos). Nunca invente número de pedido, código de rastreio, prazo, valor, desconto ou cupom. Se faltar informação para escrever o e-mail que o operador pediu, pergunte a ele e deixe has_draft=false.
- Não prometa reembolso, troca ou prazo que não estejam nos dados ou que o operador não tenha autorizado explicitamente na conversa.
- Quando o operador pedir ajustes, devolva o e-mail completo atualizado (has_draft=true).
- Só ofereça desconto/cupom se o operador informar o valor e o código.

Dados da loja:
${storeFacts}

${customerText ? `Cliente selecionado:\n${customerText}` : "Nenhum cliente selecionado: você pode redigir um modelo genérico, mas avise o operador que precisa selecionar um cliente para enviar."}`;
}

/** Uma rodada da conversa com o modelo. Retorna a resposta ao operador e (opcionalmente) o rascunho do e-mail. */
export async function assistantTurn(messages: AiMessage[], customer: AssistantCustomerContext | null): Promise<AiTurn> {
  if (!isAiConfigured()) throw new Error("Assistente de I.A. não configurada: defina ANTHROPIC_API_KEY nas variáveis de ambiente.");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  const system = await systemPrompt(customer ? describeCustomer(customer) : null);
  const history: Anthropic.MessageParam[] = messages
    .filter((m) => m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (!history.length || history[0].role !== "user") throw new Error("Escreva uma instrução para a assistente.");

  const res = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: history,
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  });
  if (res.stop_reason === "refusal") {
    throw new Error(`O modelo recusou esta solicitação${res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : "."}`);
  }
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  let parsed: { reply?: string; has_draft?: boolean; subject?: string; body?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Resposta inesperada do modelo. Tente novamente.");
  }
  const draft = parsed.has_draft && parsed.subject?.trim() && parsed.body?.trim() ? { subject: parsed.subject.trim(), body: parsed.body.trim() } : null;
  return { reply: (parsed.reply ?? "").trim() || (draft ? "Rascunho pronto ao lado. Revise e clique em Enviar." : "Sem resposta."), draft };
}

/** Serializa uma rodada da assistente para o histórico enviado de volta ao modelo. */
export function turnToHistory(turn: AiTurn): string {
  if (!turn.draft) return turn.reply;
  return `${turn.reply}\n\n[Rascunho atual]\nAssunto: ${turn.draft.subject}\n\n${turn.draft.body}`;
}
