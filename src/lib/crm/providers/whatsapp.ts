import "server-only";
import type { SendResult } from "./email";

/**
 * Canal WhatsApp — provedor oficial: Meta WhatsApp Cloud API (Graph API, sem SDK).
 *
 * Ativo somente quando WHATSAPP_PROVIDER=meta e WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID estão
 * definidos. Sem isso, `isWhatsAppConfigured()` devolve false e o sistema NÃO cria automações de WhatsApp
 * (a regra "quando houver integração disponível" continua respeitada).
 *
 * Regra da Meta: toda mensagem iniciada pela loja (carrinho abandonado, confirmação, rastreio) precisa ser
 * um TEMPLATE aprovado no Meta Business. Texto livre só é aceito nas 24 h após a última mensagem do
 * cliente (erro 131047 fora da janela). Por isso cada automação leva um `template`; se o nome do template
 * daquele tipo não estiver configurado, cai no texto livre e o erro da Meta fica visível no dashboard.
 *
 * Variáveis:
 *   WHATSAPP_PROVIDER=meta
 *   WHATSAPP_PHONE_NUMBER=+5567920018516      número da loja (exibição no dashboard)
 *   WHATSAPP_PHONE_NUMBER_ID=                 "Phone number ID" em Meta → WhatsApp → API Setup
 *   WHATSAPP_ACCESS_TOKEN=                    token permanente de usuário do sistema (Meta Business)
 *   WHATSAPP_TEMPLATE_ABANDONED_CART=         nome do template aprovado ({{1}} nome, {{2}} resumo da compra, {{3}} link)
 *   WHATSAPP_TEMPLATE_PURCHASE=               ({{1}} nome, {{2}} nº do pedido, {{3}} total, {{4}} link do pedido)
 *   WHATSAPP_TEMPLATE_TRACKING=               ({{1}} nome, {{2}} nº do pedido, {{3}} código, {{4}} link)
 *   WHATSAPP_TEMPLATE_LANGS=fr                idiomas em que os templates existem na Meta (fr,pt,en,de);
 *                                             cliente de outro idioma recebe o primeiro da lista
 *   WHATSAPP_GRAPH_VERSION=v21.0              opcional
 */
export type WhatsAppTemplateKind = "abandoned_cart" | "purchase_confirmation" | "tracking_notification";

export interface WhatsAppTemplate {
  kind: WhatsAppTemplateKind;
  /** idioma do template (fr, pt, en, de) — mapeado para o código de idioma da Meta */
  lang: string;
  /** valores de {{1}}, {{2}}, ... na ordem */
  params: string[];
}

export interface WhatsAppMessage {
  to: string; // E.164
  /** texto livre (usado quando não há template configurado; só funciona na janela de 24 h) */
  text: string;
  template?: WhatsAppTemplate;
}

const GRAPH_VERSION = (process.env.WHATSAPP_GRAPH_VERSION || "v21.0").trim();

/** Códigos de idioma dos templates na Meta (os templates devem ser criados nesses idiomas). */
const META_LANG: Record<string, string> = { fr: "fr", pt: "pt_BR", en: "en", de: "de" };

/** Idioma do template a usar: o do cliente se existir na Meta, senão o primeiro configurado. */
export function whatsappTemplateLang(lang: string): string {
  const available = (process.env.WHATSAPP_TEMPLATE_LANGS || "fr,pt,en,de").split(",").map((l) => l.trim().toLowerCase()).filter(Boolean);
  const chosen = available.includes(lang) ? lang : available[0] || lang;
  return META_LANG[chosen] || chosen;
}

export function whatsappProviderName(): string {
  return (process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
}

/** Número da loja no WhatsApp (só exibição; o envio usa WHATSAPP_PHONE_NUMBER_ID). */
export function whatsappPhoneNumber(): string | null {
  const n = (process.env.WHATSAPP_PHONE_NUMBER || "").trim();
  return n || null;
}

export function whatsappTemplateName(kind: WhatsAppTemplateKind): string | null {
  const key = { abandoned_cart: "WHATSAPP_TEMPLATE_ABANDONED_CART", purchase_confirmation: "WHATSAPP_TEMPLATE_PURCHASE", tracking_notification: "WHATSAPP_TEMPLATE_TRACKING" }[kind];
  const v = (process.env[key] || "").trim();
  return v || null;
}

export function isWhatsAppConfigured(): boolean {
  return whatsappProviderName() === "meta" && Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** O que ainda falta para o canal funcionar (para o card Integrações do dashboard). */
export function whatsappMissing(): string[] {
  const missing: string[] = [];
  if (whatsappProviderName() !== "meta") missing.push("WHATSAPP_PROVIDER=meta");
  if (!process.env.WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  return missing;
}

/** Templates ainda não configurados (o canal funciona sem eles, mas só dentro da janela de 24 h). */
export function whatsappTemplatesMissing(): WhatsAppTemplateKind[] {
  return (["abandoned_cart", "purchase_confirmation", "tracking_notification"] as const).filter((k) => !whatsappTemplateName(k));
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<SendResult> {
  const provider = whatsappProviderName() || "none";
  if (!isWhatsAppConfigured()) {
    return { ok: false, provider, error: `Integração de WhatsApp não configurada (falta ${whatsappMissing().join(", ")}).` };
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN as string;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID as string;
  const to = msg.to.replace(/\D/g, "");
  if (to.length < 8) return { ok: false, provider, error: `número inválido: ${msg.to}` };

  const templateName = msg.template ? whatsappTemplateName(msg.template.kind) : null;
  const payload: Record<string, unknown> =
    msg.template && templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: whatsappTemplateLang(msg.template.lang) },
            components: msg.template.params.length
              ? [{ type: "body", parameters: msg.template.params.map((p) => ({ type: "text", text: cleanParam(p) })) }]
              : [],
          },
        }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: msg.text, preview_url: true } };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
    };
    if (!res.ok || body.error) {
      const e = body.error;
      const detail = e?.error_data?.details ? ` — ${e.error_data.details}` : "";
      const hint = e?.code === 131047 ? " (fora da janela de 24 h: configure um template aprovado)" : "";
      return { ok: false, provider, error: `Meta ${e?.code ?? res.status}: ${e?.message || "erro"}${detail}${hint}` };
    }
    return { ok: true, provider, providerMessageId: body.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, provider, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Parâmetros de template não podem ter quebras de linha, tabulações ou mais de 4 espaços seguidos, nem ser vazios. */
function cleanParam(p: string): string {
  const s = p.replace(/[\r\n\t]+/g, " ").replace(/ {5,}/g, "    ").trim();
  return s || "-";
}
