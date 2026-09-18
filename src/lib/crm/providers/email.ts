import "server-only";

/**
 * Provedor de e-mail transacional: Resend (API REST, sem SDK).
 * Ativo somente quando RESEND_API_KEY e EMAIL_FROM estão definidos.
 * Sem chave, as automações de e-mail ficam com status "failed" e a razão visível no dashboard.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function emailProviderName(): string {
  return "resend";
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, provider: "resend", error: "Provedor de e-mail não configurado (RESEND_API_KEY / EMAIL_FROM)." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo || process.env.EMAIL_REPLY_TO || undefined,
        tags: msg.tags ? Object.entries(msg.tags).map(([name, value]) => ({ name, value })) : undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return { ok: false, provider: "resend", error: `Resend ${res.status}: ${body.message || body.name || "erro"}` };
    }
    return { ok: true, provider: "resend", providerMessageId: body.id };
  } catch (e) {
    return { ok: false, provider: "resend", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Situação de um e-mail já enviado, consultada no Resend (GET /emails/{id}). */
export interface EmailStatus {
  ok: boolean;
  /** sent | delivered | delivery_delayed | bounced | complained | opened | clicked … (vocabulário do Resend) */
  lastEvent?: string;
  to?: string[];
  error?: string;
}

/**
 * Confirma com o provedor se o e-mail existe e qual foi o último evento dele.
 * Usado pelo painel para mostrar "o Resend confirmou" logo após o envio manual.
 * Nunca lança: em caso de falha de rede devolve ok=false com o motivo.
 */
export async function getEmailStatus(providerMessageId: string, timeoutMs = 4000): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY ausente" };
  try {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(providerMessageId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { last_event?: string; to?: string[]; message?: string; name?: string };
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${body.message || body.name || "erro"}` };
    return { ok: true, lastEvent: body.last_event, to: body.to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
