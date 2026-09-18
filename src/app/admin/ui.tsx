import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/crm/money";
import { STORE_CURRENCY } from "@/lib/crm/config";

// Componentes de apresentação do dashboard (server-safe, sem estado).

export function fmtDate(v: string | null | undefined, withTime = true): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", ...(withTime ? { timeStyle: "short" } : {}) }).format(d);
}

export function fmtMoney(v: number | string | null | undefined, currency = STORE_CURRENCY): string {
  return formatMoney(v, currency, "pt-BR");
}

export function timeAgo(v: string | null | undefined): string {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const m = Math.floor(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

const TONES: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-black/5 text-black/70",
  blue: "bg-blue-100 text-blue-800",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

export const ORDER_STATUS_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  pending: { label: "Pendente", tone: "yellow" },
  paid: { label: "Pago", tone: "green" },
  processing: { label: "Em preparação", tone: "blue" },
  shipped: { label: "Enviado", tone: "blue" },
  delivered: { label: "Entregue", tone: "green" },
  cancelled: { label: "Cancelado", tone: "gray" },
  refunded: { label: "Reembolsado", tone: "red" },
};
export const CART_STATUS_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  active: { label: "Ativo", tone: "blue" },
  abandoned: { label: "Abandonado", tone: "yellow" },
  recovered: { label: "Recuperado", tone: "green" },
  manually_recovered: { label: "Recuperado (manual)", tone: "green" },
  expired: { label: "Expirado", tone: "gray" },
};
export const AUTOMATION_STATUS_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  pending: { label: "Pendente", tone: "yellow" },
  processing: { label: "Processando", tone: "blue" },
  sent: { label: "Enviada", tone: "green" },
  delivered: { label: "Entregue", tone: "green" },
  failed: { label: "Falhou", tone: "red" },
  cancelled: { label: "Cancelada", tone: "gray" },
};
export const AUTOMATION_TYPE_LABEL: Record<string, string> = {
  abandoned_cart: "Carrinho abandonado",
  purchase_confirmation: "Confirmação de compra",
  promotion_reminder: "Lembrete de promoção",
  tracking_notification: "Rastreio enviado",
  manual_followup: "Follow-up manual",
};
export const TRACKING_STATUS_LABEL: Record<string, string> = {
  label_created: "Etiqueta criada",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  exception: "Ocorrência",
};
export const EVENT_LABEL: Record<string, string> = {
  customer_created: "Cliente cadastrado",
  contact_captured: "Contato informado",
  page_view: "Visitou a página",
  product_view: "Visualizou produto",
  add_to_cart: "Adicionou ao carrinho",
  checkout_started: "Iniciou checkout",
  checkout_abandoned: "Abandonou o carrinho",
  purchase: "Compra realizada",
  payment_confirmed: "Pagamento confirmado",
  payment_refused: "Pagamento recusado",
  refund: "Estorno / chargeback",
  email_sent: "E-mail enviado",
  email_delivered: "E-mail entregue",
  email_opened: "E-mail aberto",
  email_clicked: "Cliente clicou no e-mail",
  whatsapp_sent: "WhatsApp enviado",
  whatsapp_delivered: "WhatsApp entregue",
  whatsapp_read: "WhatsApp lido",
  manual_contact: "Contato manual",
  tracking_added: "Rastreio cadastrado",
  tracking_sent: "Rastreio enviado ao cliente",
  tracking_status_updated: "Status do rastreio atualizado",
  order_shipped: "Pedido enviado",
  order_delivered: "Pedido entregue",
  cart_recovered: "Carrinho recuperado",
};

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: keyof typeof TONES }>; value: string | null | undefined }) {
  const m = value ? map[value] : undefined;
  return <Badge tone={m?.tone ?? "gray"}>{m?.label ?? value ?? "—"}</Badge>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-black/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 font-heading text-2xl">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-black/50">{hint}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = !rows || (Array.isArray(rows) && rows.length === 0);
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-black/60">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-black/50">
                {empty ?? "Nenhum registro ainda. Os dados aparecem aqui assim que a loja receber eventos reais."}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}

export function FilterTabs({ base, param, current, options }: { base: string; param: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={o.value === "todos" ? base : `${base}?${param}=${o.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Pagination({ base, page, count, pageSize, extra = "" }: { base: string; page: number; count: number; pageSize: number; extra?: string }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  const link = (p: number) => `${base}?${extra ? extra + "&" : ""}page=${p}`;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-black/60">
      <span>
        Página {page} de {pages} · {count} registros
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={link(page - 1)} className="rounded-full border border-black/15 px-3 py-1">
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link href={link(page + 1)} className="rounded-full border border-black/15 px-3 py-1">
            Próxima
          </Link>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: ReactNode }) {
  const cls = tone === "ok" ? "border-green-200 bg-green-50 text-green-900" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
