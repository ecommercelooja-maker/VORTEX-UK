"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { CustomerDirectoryRow, CustomerSegment } from "../../queries";

/**
 * Diretório de clientes compacto (cabe na tela sem rolagem lateral): cliente + contato numa célula,
 * segmento, compras, carrinho aberto, mensagens e atividade. Linha expansível com pedidos, carrinhos
 * e mensagens do cliente; seleção em lote para copiar e-mails/telefones ou exportar CSV (públicos de anúncio).
 */
const SEGMENT: Record<CustomerSegment, { label: string; cls: string; hint: string }> = {
  vip: { label: "VIP", cls: "bg-purple-100 text-purple-800", hint: "2 ou mais pedidos pagos" },
  comprador: { label: "Comprador", cls: "bg-green-100 text-green-800", hint: "1 pedido pago" },
  recusado: { label: "Recusado", cls: "bg-red-100 text-red-800", hint: "tentou pagar e o gateway recusou; ainda não comprou" },
  carrinho: { label: "Carrinho aberto", cls: "bg-amber-100 text-amber-800", hint: "abandonou um carrinho e ainda não comprou" },
  lead: { label: "Só cadastro", cls: "bg-black/5 text-black/60", hint: "sem pedido e sem carrinho" },
};
const ORDER_STATUS: Record<string, string> = { pending: "Aguardando pagamento", paid: "Pago", processing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado" };
const PAYMENT: Record<string, { label: string; cls: string }> = {
  paid: { label: "pago", cls: "text-green-700" },
  pending: { label: "pendente", cls: "text-amber-700" },
  refused: { label: "recusado", cls: "text-red-700" },
  refunded: { label: "reembolsado", cls: "text-black/50" },
  chargeback: { label: "chargeback", cls: "text-red-700" },
};
const CART_STATUS: Record<string, { label: string; cls: string }> = {
  abandoned: { label: "aberto", cls: "text-amber-700" },
  recovered: { label: "recuperado", cls: "text-green-700" },
  manually_recovered: { label: "recuperado", cls: "text-green-700" },
  expired: { label: "expirado", cls: "text-black/40" },
};
const AUTOMATION_LABEL: Record<string, string> = {
  purchase_confirmation: "Confirmação de compra",
  tracking_notification: "Rastreio",
  abandoned_cart: "Carrinho abandonado",
  promotion_reminder: "Promoção",
  manual_followup: "Mensagem manual",
};

function money(v: number | string | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "GBP" }).format(n);
}
function fmt(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", ...(withTime ? { timeStyle: "short" } : {}) }).format(new Date(iso));
}
function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60e3));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `há ${d} d`;
  return `há ${Math.floor(d / 30)} m`;
}
function flag(iso: string | null): string {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(...iso.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
function shortRef(ref: string): string {
  return ref.length > 12 ? ref.slice(0, 8) : ref;
}
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function CustomersTable({ rows, nowIso }: { rows: CustomerDirectoryRow[]; nowIso: string }) {
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const ids = Array.from(selected).filter((id) => rows.some((r) => r.id === id));
  const chosen = ids.length ? rows.filter((r) => selected.has(r.id)) : rows;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleOpen(id: string) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function copy(kind: "emails" | "phones" | "csv") {
    let text = "";
    if (kind === "emails") text = chosen.map((r) => r.email).filter(Boolean).join("\n");
    else if (kind === "phones") text = chosen.map((r) => r.whatsapp || r.phone).filter(Boolean).join("\n");
    else {
      const head = ["nome", "email", "telefone", "pais", "segmento", "pedidos_pagos", "total_gasto", "ultima_compra", "carrinho_aberto", "mensagens", "opt_in_email", "cadastro", "ultima_atividade"];
      const lines = chosen.map((r) =>
        [r.name, r.email, r.whatsapp || r.phone, r.country, SEGMENT[r.segment].label, r.paid_orders, r.paid_total.toFixed(2), r.last_paid_at ? fmt(r.last_paid_at) : "", r.open_cart_total ? r.open_cart_total.toFixed(2) : "", r.messages_sent, r.marketing_email_opt_in ? "sim" : "não", fmt(r.created_at), fmt(r.last_activity_at)].map(csvCell).join(";"),
      );
      text = [head.join(";"), ...lines].join("\n");
    }
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }
  const scope = ids.length ? `${ids.length} selecionado(s)` : `${rows.length} desta página`;

  return (
    <div>
      {/* Barra de lote */}
      <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors ${ids.length ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60"}`}>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-black" aria-label="Selecionar todos desta página" />
          <span className="font-semibold">{ids.length ? `${ids.length} selecionado(s)` : `Selecionar os ${rows.length} desta página`}</span>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] ${ids.length ? "text-white/60" : "text-black/40"}`}>Copiar ({scope}):</span>
          <Btn tone={ids.length ? "ghost-light" : "ghost"} onClick={() => copy("emails")} title="Lista de e-mails, um por linha — para público personalizado no Meta/Google Ads ou campanha">
            {copied === "emails" ? "✓ copiado" : "✉ e-mails"}
          </Btn>
          <Btn tone={ids.length ? "ghost-light" : "ghost"} onClick={() => copy("phones")} title="Lista de telefones, um por linha">
            {copied === "phones" ? "✓ copiado" : "📞 telefones"}
          </Btn>
          <Btn tone={ids.length ? "light" : "primary"} onClick={() => copy("csv")} title="Tabela completa em CSV (separador ;) — cole no Excel ou Google Sheets">
            {copied === "csv" ? "✓ copiado" : "⬇ CSV"}
          </Btn>
          {ids.length > 0 && (
            <Btn tone="ghost-light" onClick={() => setSelected(new Set())}>
              Limpar
            </Btn>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-black/60">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 font-semibold">Perfil</th>
              <th className="px-3 py-2.5 font-semibold">Compras</th>
              <th className="px-3 py-2.5 font-semibold">Carrinho</th>
              <th className="px-3 py-2.5 font-semibold">Mensagens</th>
              <th className="px-3 py-2.5 font-semibold">Atividade</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-black/50">
                  Nenhum cliente neste filtro.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const seg = SEGMENT[c.segment];
                const isSel = selected.has(c.id);
                const isOpen = open.has(c.id);
                const phone = c.whatsapp || c.phone;
                return (
                  <Group key={c.id}>
                    <tr className={`align-top transition-colors ${isSel ? "bg-blue-50/60" : "hover:bg-surface/50"}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={isSel} onChange={() => toggle(c.id)} className="mt-1 h-4 w-4 accent-black" aria-label="Selecionar" />
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span title={c.country ?? ""}>{flag(c.country)}</span>
                          <Link href={`/admin/clientes/${c.id}`} className="truncate font-semibold underline-offset-2 hover:underline">
                            {c.name ?? "(sem nome)"}
                          </Link>
                        </div>
                        <div className="truncate text-xs text-black/60" title={c.email ?? ""}>
                          {c.email ?? "—"}
                        </div>
                        <div className="text-xs text-black/50">
                          {phone ? (
                            <a href={waLink(phone)} target="_blank" rel="noreferrer" className="hover:text-green-700 hover:underline" title="Abrir no WhatsApp">
                              📞 {phone}
                            </a>
                          ) : (
                            <span className="text-black/30">sem telefone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip cls={seg.cls} title={seg.hint}>
                          {seg.label}
                        </Chip>
                        <div className="mt-1 flex gap-1 text-[11px] text-black/50">
                          <span title={c.marketing_email_opt_in ? "aceita e-mail de marketing" : "sem opt-in de e-mail (só transacional + recuperação de checkout)"} className={c.marketing_email_opt_in ? "text-green-700" : ""}>
                            ✉ {c.marketing_email_opt_in ? "sim" : "não"}
                          </span>
                          <span title={c.marketing_whatsapp_opt_in ? "aceita WhatsApp" : "sem opt-in de WhatsApp"} className={c.marketing_whatsapp_opt_in ? "text-green-700" : ""}>
                            💬 {c.marketing_whatsapp_opt_in ? "sim" : "não"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {c.paid_orders ? (
                          <>
                            <div className="font-semibold">
                              {c.paid_orders}× · {money(c.paid_total)}
                            </div>
                            <div className="text-xs text-black/50">última {ago(c.last_paid_at, nowMs)}</div>
                          </>
                        ) : c.refused_orders ? (
                          <>
                            <div className="font-semibold text-red-700">{c.refused_orders} recusado(s)</div>
                            <div className="text-xs text-black/50">{ago(c.last_refused_at, nowMs)}</div>
                          </>
                        ) : (
                          <span className="text-black/30">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {c.open_cart_total ? (
                          <>
                            <div className="font-semibold text-amber-700">{money(c.open_cart_total)}</div>
                            <div className="text-xs text-black/50">aberto {ago(c.open_cart_at, nowMs)}</div>
                          </>
                        ) : c.recovered_carts_count ? (
                          <div className="text-xs text-green-700">{c.recovered_carts_count} recuperado(s)</div>
                        ) : c.abandoned_carts_count ? (
                          <div className="text-xs text-black/40">{c.abandoned_carts_count} expirado(s)</div>
                        ) : (
                          <span className="text-black/30">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {c.messages_sent || c.messages_failed ? (
                          <>
                            <div className="font-semibold">{c.messages_sent} enviada(s)</div>
                            <div className="text-xs text-black/50">
                              {c.last_message_at ? ago(c.last_message_at, nowMs) : ""}
                              {c.messages_failed ? <span className="text-red-700"> · {c.messages_failed} falhou</span> : ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-black/30">nenhuma</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="font-medium" title={fmt(c.last_activity_at)}>
                          {ago(c.last_activity_at, nowMs)}
                        </div>
                        <div className="text-xs text-black/50" title={fmt(c.created_at)}>
                          desde {fmt(c.created_at, false)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {phone && (
                            <a href={waLink(phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="rounded-full border border-green-600/30 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100">
                              💬
                            </a>
                          )}
                          <Link href={`/admin/assistente?cliente=${c.id}`} title="Escrever com a Assistente I.A." className="rounded-full border border-black/15 px-2 py-1 text-xs font-semibold hover:bg-surface">
                            ✨ I.A.
                          </Link>
                          <button type="button" onClick={() => toggleOpen(c.id)} aria-expanded={isOpen} title="Histórico" className={`rounded-full border px-2 py-1 text-xs font-semibold ${isOpen ? "border-black bg-black text-white" : "border-black/15 hover:bg-surface"}`}>
                            {isOpen ? "▴" : "▾"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface/40">
                        <td colSpan={8} className="px-4 py-4">
                          <Details c={c} nowMs={nowMs} />
                        </td>
                      </tr>
                    )}
                  </Group>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Details({ c, nowMs }: { c: CustomerDirectoryRow; nowMs: number }) {
  const seg = SEGMENT[c.segment];
  const next =
    c.segment === "recusado"
      ? "Pagamento recusado sem compra depois: mande uma mensagem oferecendo outro meio de pagamento ou o link do checkout."
      : c.segment === "carrinho"
        ? "Carrinho aberto: envie a recuperação pela aba Carrinhos abandonados ou chame no WhatsApp com o texto pronto."
        : c.segment === "vip"
          ? "Cliente recorrente: bom candidato a oferta exclusiva ou pedido de avaliação."
          : c.segment === "comprador"
            ? "Comprou uma vez: acompanhe a entrega e depois convide para a próxima compra."
            : "Só cadastro: sem carrinho e sem pedido; entra nas campanhas de e-mail se tiver opt-in.";
  return (
    <div className="grid gap-4 text-xs md:grid-cols-2 xl:grid-cols-4">
      <div>
        <H>Pedidos ({c.orders.length})</H>
        {c.orders.length ? (
          <ul className="flex flex-col gap-1">
            {c.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <span>
                  <Link href={`/admin/pedidos/${o.id}`} className="font-mono font-semibold underline-offset-2 hover:underline">
                    #{shortRef(o.ref)}
                  </Link>{" "}
                  <span className="text-black/50">{fmt(o.created_at)}</span>
                </span>
                <span className="whitespace-nowrap">
                  <span className={PAYMENT[o.payment_status]?.cls ?? ""}>{PAYMENT[o.payment_status]?.label ?? o.payment_status}</span> · {ORDER_STATUS[o.status] ?? o.status} · {money(o.total)}
                  {o.tracking_code ? " · 📦" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-black/40">Nenhum pedido.</p>
        )}
      </div>
      <div>
        <H>Carrinhos ({c.carts.length})</H>
        {c.carts.length ? (
          <ul className="flex flex-col gap-1">
            {c.carts.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="truncate" title={x.product_summary ?? ""}>
                  <span className={CART_STATUS[x.status]?.cls ?? ""}>{CART_STATUS[x.status]?.label ?? x.status}</span> <span className="text-black/50">{fmt(x.at)}</span>
                </span>
                <span className="whitespace-nowrap">
                  {money(x.total)}
                  {x.status === "abandoned" && x.checkout_url && (
                    <a href={x.checkout_url} target="_blank" rel="noreferrer" className="ml-1 text-blue-700 hover:underline" title="Abrir o checkout do cliente">
                      ↗
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-black/40">Nenhum carrinho.</p>
        )}
      </div>
      <div>
        <H>Mensagens ({c.messages_sent + c.messages_failed})</H>
        {c.messages.length ? (
          <ul className="flex flex-col gap-1">
            {c.messages.map((m, k) => {
              const ok = m.status === "sent" || m.status === "delivered";
              return (
                <li key={k} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-green-500" : m.status === "failed" ? "bg-red-500" : m.status === "cancelled" ? "bg-black/30" : "bg-amber-400"}`} />
                  <span>
                    <span className="font-semibold">{AUTOMATION_LABEL[m.automation_type] ?? m.automation_type}</span> · {m.channel === "email" ? "e-mail" : m.channel}
                    <span className="text-black/50"> · {ago(m.at, nowMs)}</span>
                    {m.status === "failed" && <span className="text-red-700"> · falhou</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-black/40">Nenhuma mensagem ainda.</p>
        )}
      </div>
      <div>
        <H>Ficha</H>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-black/50">Perfil</dt>
          <dd>
            <Chip cls={seg.cls}>{seg.label}</Chip>
          </dd>
          <dt className="text-black/50">País</dt>
          <dd>
            {flag(c.country)} {c.country ?? "—"}
          </dd>
          <dt className="text-black/50">E-mail</dt>
          <dd className="break-all">
            {c.email ?? "—"} {c.email_verified ? <span className="text-green-700">· verificado</span> : ""}
          </dd>
          <dt className="text-black/50">Telefone</dt>
          <dd>{c.whatsapp || c.phone || "—"}</dd>
          <dt className="text-black/50">Opt-in</dt>
          <dd>{[c.marketing_email_opt_in && "e-mail", c.marketing_whatsapp_opt_in && "WhatsApp", c.marketing_sms_opt_in && "SMS"].filter(Boolean).join(", ") || "nenhum"}</dd>
          <dt className="text-black/50">Cadastro</dt>
          <dd>{fmt(c.created_at)}</dd>
          <dt className="text-black/50">Atividade</dt>
          <dd>{fmt(c.last_activity_at)}</dd>
        </dl>
        <p className="mt-2 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] text-black/70">💡 {next}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link href={`/admin/clientes/${c.id}`} className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black/80">
            Abrir ficha completa
          </Link>
          <Link href={`/admin/assistente?cliente=${c.id}`} className="rounded-full border border-black/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-surface">
            ✨ Escrever com a I.A.
          </Link>
        </div>
      </div>
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
function H({ children }: { children: ReactNode }) {
  return <h4 className="mb-1.5 font-semibold uppercase tracking-wide text-black/50">{children}</h4>;
}
function Chip({ cls, title, children }: { cls: string; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}
function Btn({ tone, children, onClick, title }: { tone: "primary" | "ghost" | "light" | "ghost-light"; children: ReactNode; onClick?: () => void; title?: string }) {
  const cls = {
    primary: "bg-black text-white hover:bg-black/80",
    ghost: "border border-black/15 hover:bg-surface",
    light: "bg-white text-black hover:bg-white/90",
    "ghost-light": "border border-white/30 text-white hover:bg-white/10",
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </button>
  );
}
