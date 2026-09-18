import type { AutomationEvent } from "@/lib/crm/types";

// Componentes/utilitários da aba Mensagens enviadas (server-safe).

export const CHANNEL_LABEL: Record<string, { label: string; icon: string; cls: string }> = {
  email: { label: "E-mail", icon: "✉️", cls: "bg-blue-100 text-blue-800" },
  whatsapp: { label: "WhatsApp", icon: "💬", cls: "bg-green-100 text-green-800" },
  sms: { label: "SMS", icon: "📱", cls: "bg-purple-100 text-purple-800" },
};

export function ChannelBadge({ channel, count }: { channel: string; count?: number }) {
  const c = CHANNEL_LABEL[channel] ?? { label: channel, icon: "•", cls: "bg-black/5 text-black/70" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      <span aria-hidden>{c.icon}</span>
      {c.label}
      {count != null && <span className="opacity-70">· {count}</span>}
    </span>
  );
}

/** Primeiras palavras do texto enviado (para a listagem). */
export function messagePreview(a: AutomationEvent, max = 140): string {
  const m = a.metadata ?? {};
  const raw = typeof m.body_text === "string" ? m.body_text : typeof m.text === "string" ? m.text : "";
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (!oneLine) return a.error_message ? "" : "(conteúdo não registrado — mensagem anterior a 14/09/2026)";
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}
