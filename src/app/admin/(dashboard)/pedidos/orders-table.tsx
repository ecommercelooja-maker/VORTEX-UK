"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { OrderRow } from "../../queries";
import type { ActionResult } from "../../actions";
import { addTrackingQuickAction, bulkOrderStatusAction, resendTrackingAction, updateOrderStatusAction, updateTrackingStatusAction } from "../../actions";
import { detectCarrier, normalizeTrackingCode } from "@/lib/crm/carriers";
import BulkTracking from "./bulk-tracking";

/**
 * Tabela de pedidos com seleção em lote, cadastro de rastreio direto na linha (transportadora
 * detectada pelo código), painel de rastreio em lote (colar lista / CSV) e linha expansível com
 * itens, endereço, status e histórico de notificações — com o resultado real do envio.
 */
export type OrderRowView = OrderRow & { country: string | null };

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Aguardando pagamento", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Pago", cls: "bg-green-100 text-green-800" },
  processing: { label: "Em preparação", cls: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", cls: "bg-blue-100 text-blue-800" },
  delivered: { label: "Entregue", cls: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", cls: "bg-black/5 text-black/60" },
  refunded: { label: "Reembolsado", cls: "bg-red-100 text-red-800" },
};
const PAYMENT: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-green-100 text-green-800" },
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  refused: { label: "Recusado", cls: "bg-red-100 text-red-800" },
  refunded: { label: "Reembolsado", cls: "bg-black/5 text-black/60" },
  chargeback: { label: "Chargeback", cls: "bg-red-100 text-red-800" },
};
const TRACKING_STATUS: [string, string][] = [
  ["label_created", "Etiqueta criada"],
  ["shipped", "Enviado"],
  ["in_transit", "Em trânsito"],
  ["out_for_delivery", "Saiu para entrega"],
  ["delivered", "Entregue"],
  ["exception", "Ocorrência"],
];
const ORDER_STATUS_OPTIONS: [string, string][] = [
  ["pending", "Aguardando pagamento"],
  ["paid", "Pago"],
  ["processing", "Em preparação"],
  ["shipped", "Enviado"],
  ["delivered", "Entregue"],
  ["cancelled", "Cancelado"],
  ["refunded", "Reembolsado"],
];
const AUTOMATION_LABEL: Record<string, string> = {
  purchase_confirmation: "Confirmação de compra",
  tracking_notification: "Rastreio",
  abandoned_cart: "Carrinho abandonado",
  promotion_reminder: "Promoção",
  manual_followup: "Mensagem manual",
};
const PAYMENT_METHOD_LABEL: Record<string, string> = { credit_card: "cartão", card: "cartão", pix: "Pix", boleto: "boleto", paypal: "PayPal", apple_pay: "Apple Pay", google_pay: "Google Pay" };
function paymentMethod(m: string | null | undefined): string {
  if (!m) return "";
  return PAYMENT_METHOD_LABEL[m.toLowerCase()] ?? m.toLowerCase();
}

function money(v: number | string | null | undefined, currency: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "GBP" }).format(n);
}
function fmt(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", ...(withTime ? { timeStyle: "short" } : {}) }).format(new Date(iso));
}
function hhmm(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60e3));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
function flag(iso: string | null): string {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(...iso.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function shortRef(ref: string): string {
  return ref.length > 12 ? ref.slice(0, 8) : ref;
}
function canShip(o: OrderRow): boolean {
  return o.status === "paid" || o.status === "processing";
}

export default function OrdersTable({ rows, nowIso }: { rows: OrderRowView[]; nowIso: string }) {
  const router = useRouter();
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pending, start] = useTransition();

  const selectable = rows.filter((r) => canShip(r) || r.status === "shipped");
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const ids = Array.from(selected).filter((id) => rows.some((r) => r.id === id));
  const selectedRows = ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
  const selectedToShip = selectedRows.filter(canShip);
  const selectedWithTracking = selectedRows.filter((r) => r.tracking_code);

  function run(key: string, fn: () => Promise<ActionResult>, after?: () => void) {
    setBusy(key);
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/server action|failed to find|deployment|unexpected response/i.test(msg)) {
          setToast({ ok: false, text: "O sistema foi atualizado enquanto a página estava aberta. Recarregando…" });
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
        r = { ok: false, error: msg };
      }
      setToast({ ok: r.ok, text: r.ok ? r.message ?? "OK" : r.error });
      setBusy(null);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }
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

  return (
    <div className="relative">
      {/* Barra de lote */}
      <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors ${ids.length ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60"}`}>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))} className="h-4 w-4 accent-black" aria-label="Selecionar todos os pedidos pagos/enviados desta página" />
          <span className="font-semibold">{ids.length ? `${ids.length} selecionado(s)` : `Selecionar os ${selectable.length} pagos/enviados desta página`}</span>
        </label>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Btn tone={ids.length ? "light" : "primary"} onClick={() => setBulkOpen(true)} title="Cole uma lista de códigos (um por linha, na ordem da seleção) ou pedido;código;transportadora">
            📦 Rastreio em lote{selectedToShip.length ? ` (${selectedToShip.length})` : ""}
          </Btn>
          {ids.length > 0 && (
            <>
              {selectedToShip.some((r) => r.status === "paid") && (
                <Btn tone="ghost-light" disabled={pending} onClick={() => run("bulk", () => bulkOrderStatusAction(selectedToShip.map((r) => r.id), "processing"), () => setSelected(new Set()))}>
                  ⚙ Em preparação ({selectedToShip.length})
                </Btn>
              )}
              {selectedWithTracking.length > 0 && (
                <Btn
                  tone="ghost-light"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Reenviar o e-mail de rastreio para ${selectedWithTracking.length} cliente(s)?`)) return;
                    run(
                      "bulk",
                      async () => {
                        const lines: string[] = [];
                        let okCount = 0;
                        for (const r of selectedWithTracking) {
                          const res = await resendTrackingAction(r.id);
                          if (res.ok) okCount++;
                          const detail = (res.ok ? res.message ?? "" : res.error).split("\n").slice(1).join(" · ");
                          lines.push(`#${shortRef(r.external_order_id)} — ${detail || (res.ok ? "ok" : "falhou")}`);
                        }
                        return okCount ? { ok: true, message: `${okCount}/${selectedWithTracking.length} reenviado(s):\n${lines.join("\n")}` } : { ok: false, error: `Nenhum reenviado:\n${lines.join("\n")}` };
                      },
                      () => setSelected(new Set()),
                    );
                  }}
                >
                  ✉ Reenviar rastreio ({selectedWithTracking.length})
                </Btn>
              )}
              <Btn tone="ghost-light" onClick={() => setSelected(new Set())}>
                Limpar
              </Btn>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className={`mb-3 flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${toast.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <span className="whitespace-pre-line font-medium">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs underline">
            fechar
          </button>
        </div>
      )}

      {bulkOpen && (
        <BulkTracking
          selected={selectedToShip.map((r) => ({ id: r.id, ref: r.external_order_id, customer: r.customer_name ?? r.customer_email ?? "(sem nome)" }))}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-black/60">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5 font-semibold">Pedido</th>
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 font-semibold">Total</th>
              <th className="px-3 py-2.5 font-semibold">Pagamento</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Rastreio</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-black/50">
                  Nenhum pedido neste filtro.
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const st = ORDER_STATUS[o.status] ?? { label: o.status, cls: "bg-black/5 text-black/60" };
                const pay = PAYMENT[o.payment_status] ?? { label: o.payment_status, cls: "bg-black/5 text-black/60" };
                const isSel = selected.has(o.id);
                const isOpen = open.has(o.id);
                const rowBusy = busy === o.id && pending;
                const items = Array.isArray(o.items) ? o.items : [];
                const qty = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
                const trackSent = o.automations.filter((a) => a.automation_type === "tracking_notification" && a.channel === "email");
                const lastTrack = trackSent[0];
                const trackStatusLabel = TRACKING_STATUS.find(([v]) => v === o.tracking_status)?.[1];
                return (
                  <Group key={o.id}>
                    <tr className={`align-top transition-colors ${isSel ? "bg-blue-50/60" : canShip(o) && !o.tracking_code ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-surface/50"}`}>
                      <td className="px-3 py-2.5">
                        {canShip(o) || o.status === "shipped" ? <input type="checkbox" checked={isSel} onChange={() => toggle(o.id)} className="mt-1 h-4 w-4 accent-black" aria-label="Selecionar" /> : <span className="block h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/pedidos/${o.id}`} title={o.external_order_id} className="font-mono text-[13px] font-bold underline-offset-2 hover:underline">
                            #{shortRef(o.external_order_id)}
                          </Link>
                          <Copy value={o.external_order_id} title="Copiar nº completo do pedido" />
                        </div>
                        <div className="text-xs text-black/50" title={fmt(o.created_at)}>
                          {fmt(o.created_at)} · {ago(o.created_at, nowMs)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span title={o.country ?? ""}>{flag(o.country)}</span>
                          {o.customer_id ? (
                            <Link href={`/admin/clientes/${o.customer_id}`} className="underline-offset-2 hover:underline">
                              {o.customer_name ?? o.customer_email ?? "(sem nome)"}
                            </Link>
                          ) : (
                            <span>{o.customer_name ?? o.customer_email ?? "(sem nome)"}</span>
                          )}
                        </div>
                        <div className="max-w-[220px] truncate text-xs text-black/50" title={o.customer_email ?? ""}>
                          {o.customer_email ?? o.customer_phone ?? ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="font-semibold">{money(o.total, o.currency)}</div>
                        <div className="text-xs text-black/50">{qty ? `${qty} item(ns)` : items.length ? `${items.length} item(ns)` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip cls={pay.cls}>{pay.label}</Chip>
                        <div className="mt-0.5 text-xs text-black/50">{paymentMethod(o.payment_method)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Chip cls={st.cls}>{st.label}</Chip>
                        {trackStatusLabel && o.status !== "delivered" && o.tracking_status !== "shipped" && <div className="mt-0.5 text-xs text-black/50">{trackStatusLabel}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        {o.tracking_code ? (
                          <div className="min-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[13px] font-semibold">{o.tracking_code}</span>
                              <Copy value={o.tracking_code} title="Copiar código" />
                              {o.tracking_url && (
                                <a href={o.tracking_url} target="_blank" rel="noreferrer" title="Abrir rastreamento" className="text-xs text-blue-700 hover:underline">
                                  ↗
                                </a>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-black/50">
                              {o.tracking_carrier && <span>{o.tracking_carrier}</span>}
                              {o.tracking_notification_sent || lastTrack?.status === "sent" || lastTrack?.status === "delivered" ? (
                                <Chip cls="bg-green-100 text-green-800" title={lastTrack ? `${fmt(lastTrack.at)} · ${lastTrack.recipient ?? ""}` : "cliente avisado"}>
                                  ✓ cliente avisado{lastTrack ? " " + hhmm(lastTrack.at) : ""}
                                </Chip>
                              ) : (
                                <Chip cls="bg-amber-100 text-amber-800" title={lastTrack?.error ?? "nenhuma notificação enviada"}>
                                  ⚠ cliente não avisado
                                </Chip>
                              )}
                            </div>
                          </div>
                        ) : canShip(o) ? (
                          <QuickAdd disabled={pending} busy={rowBusy} onSubmit={(code) => run(o.id, () => addTrackingQuickAction(o.id, code))} />
                        ) : (
                          <span className="text-black/30">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/pedidos/${o.id}`} className="rounded-full border border-black/15 px-2.5 py-1 text-xs font-semibold hover:bg-surface">
                            Abrir
                          </Link>
                          <button type="button" onClick={() => toggleOpen(o.id)} aria-expanded={isOpen} title="Detalhes" className={`rounded-full border px-2 py-1 text-xs font-semibold transition-transform ${isOpen ? "border-black bg-black text-white" : "border-black/15 hover:bg-surface"}`}>
                            {isOpen ? "▴" : "▾"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface/40">
                        <td colSpan={8} className="px-4 py-4">
                          <Details o={o} nowMs={nowMs} pending={pending} run={run} />
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

// ---------------------------------------------------------------------------
// Linha expandida
// ---------------------------------------------------------------------------
function Details({ o, nowMs, pending, run }: { o: OrderRowView; nowMs: number; pending: boolean; run: (key: string, fn: () => Promise<ActionResult>, after?: () => void) => void }) {
  const items = Array.isArray(o.items) ? o.items : [];
  const a = o.shipping_address;
  const addrLines = a
    ? [
        [a.street, a.number].filter(Boolean).join(", ") + (a.complement ? ` · ${a.complement}` : ""),
        [a.zip, a.city].filter(Boolean).join(" "),
        [a.state, a.country].filter(Boolean).join(" · "),
      ].filter((l) => l && l.trim())
    : [];
  const [carrier, setCarrier] = useState(o.tracking_carrier ?? "");
  const [url, setUrl] = useState(o.tracking_url ?? "");
  const [code, setCode] = useState(o.tracking_code ?? "");
  const detected = detectCarrier(code);
  const dirty = code !== (o.tracking_code ?? "") || carrier !== (o.tracking_carrier ?? "") || url !== (o.tracking_url ?? "");

  return (
    <div className="grid gap-4 text-xs md:grid-cols-2 xl:grid-cols-4">
      <div>
        <H>Itens</H>
        {items.length ? (
          <ul className="flex flex-col gap-1">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  <span className="font-semibold">{it.quantity}×</span> {it.name}
                </span>
                <span className="whitespace-nowrap text-black/60">{money(it.total ?? it.price * it.quantity, o.currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-black/40">Sem itens no payload.</p>
        )}
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-black/60">
          {Number(o.discount) > 0 && (
            <>
              <dt>Desconto</dt>
              <dd className="text-right">−{money(o.discount, o.currency)}</dd>
            </>
          )}
          {Number(o.shipping) > 0 && (
            <>
              <dt>Frete</dt>
              <dd className="text-right">{money(o.shipping, o.currency)}</dd>
            </>
          )}
          <dt className="font-semibold text-black">Total</dt>
          <dd className="text-right font-semibold text-black">{money(o.total, o.currency)}</dd>
        </dl>
      </div>

      <div>
        <H>Entrega & pagamento</H>
        {addrLines.length ? (
          <div className="flex flex-col">
            {addrLines.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        ) : (
          <p className="text-black/40">Endereço não veio no payload do checkout.</p>
        )}
        <div className="mt-2 flex flex-col gap-0.5 text-black/60">
          {o.customer_phone && (
            <span>
              📞 {o.customer_phone}{" "}
              <a href={`https://wa.me/${o.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">
                WhatsApp
              </a>
            </span>
          )}
          {o.customer_email && <span>✉ {o.customer_email}</span>}
          <span>
            Pagamento: {PAYMENT[o.payment_status]?.label ?? o.payment_status}
            {o.payment_method ? ` · ${paymentMethod(o.payment_method)}` : ""}
            {o.payment_confirmed_at ? ` · confirmado ${fmt(o.payment_confirmed_at)}` : ""}
          </span>
          <span>
            Pedido {fmt(o.created_at)} · {o.provider}
            {o.shipped_at ? ` · enviado ${fmt(o.shipped_at)}` : ""}
            {o.delivered_at ? ` · entregue ${fmt(o.delivered_at)}` : ""}
          </span>
        </div>
      </div>

      <div>
        <H>Rastreio & status</H>
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-black/50">Código</span>
            <input value={code} onChange={(e) => setCode(normalizeTrackingCode(e.target.value))} placeholder="Colar código…" className="rounded-lg border border-black/15 bg-white px-2 py-1 font-mono outline-none focus:border-black" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-black/50">Transportadora {detected && !carrier ? <em className="not-italic text-blue-700">· detectada: {detected.name}</em> : ""}</span>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={detected?.name ?? "automática pelo código"} list="carriers-list" className="rounded-lg border border-black/15 bg-white px-2 py-1 outline-none focus:border-black" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-black/50">URL de rastreamento</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="automática pela transportadora" className="rounded-lg border border-black/15 bg-white px-2 py-1 outline-none focus:border-black" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Btn tone="primary" disabled={pending || !code || !dirty} onClick={() => run(o.id, () => addTrackingQuickAction(o.id, code, carrier, url))}>
              {o.tracking_code ? "Salvar alterações" : "Salvar e avisar cliente"}
            </Btn>
            {o.tracking_code && (
              <Btn tone="ghost" disabled={pending} onClick={() => window.confirm("Reenviar o e-mail de rastreio para este cliente?") && run(o.id, () => resendTrackingAction(o.id))}>
                ✉ Reenviar rastreio
              </Btn>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-0.5">
              <span className="text-black/50">Status do pedido</span>
              <select defaultValue={o.status} disabled={pending} onChange={(e) => run(o.id, () => updateOrderStatusAction(o.id, e.target.value))} className="rounded-lg border border-black/15 bg-white px-2 py-1">
                {ORDER_STATUS_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-black/50">Status do rastreio</span>
              <select defaultValue={o.tracking_status ?? ""} disabled={pending} onChange={(e) => e.target.value && run(o.id, () => updateTrackingStatusAction(o.id, e.target.value))} className="rounded-lg border border-black/15 bg-white px-2 py-1">
                <option value="">—</option>
                {TRACKING_STATUS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div>
        <H>Notificações ao cliente</H>
        {o.automations.length ? (
          <ul className="flex flex-col gap-1">
            {o.automations.slice(0, 8).map((a, k) => {
              const ok = a.status === "sent" || a.status === "delivered";
              return (
                <li key={k} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-green-500" : a.status === "failed" ? "bg-red-500" : a.status === "cancelled" ? "bg-black/30" : "bg-amber-400"}`} />
                  <span>
                    <span className="font-semibold">{AUTOMATION_LABEL[a.automation_type] ?? a.automation_type}</span> · {a.channel === "email" ? "e-mail" : a.channel}
                    <span className="text-black/50">
                      {" "}
                      · {fmt(a.at)} ({ago(a.at, nowMs)})
                    </span>
                    <div className={`text-[11px] ${ok ? "text-green-700" : a.status === "failed" ? "text-red-700" : "text-black/50"}`}>{ok ? `enviado para ${a.recipient ?? "cliente"}` : a.status === "failed" ? `falhou: ${a.error ?? ""}` : a.status}</div>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-black/40">Nenhuma mensagem para este pedido ainda.</p>
        )}
      </div>
      <datalist id="carriers-list">
        {["Royal Mail", "Parcelforce", "Evri", "DPD", "Yodel", "DHL", "UPS", "FedEx", "GLS", "Cainiao", "Yanwen / YunExpress", "4PX", "China Post", "Correios", "Outra"].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cadastro rápido na linha
// ---------------------------------------------------------------------------
function QuickAdd({ onSubmit, disabled, busy }: { onSubmit: (code: string) => void; disabled: boolean; busy: boolean }) {
  const [code, setCode] = useState("");
  const detected = detectCarrier(code);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const c = normalizeTrackingCode(code);
        if (c) onSubmit(c);
      }}
    >
      <div className="flex items-center gap-1">
        <input
          ref={ref}
          value={code}
          disabled={disabled}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const c = normalizeTrackingCode(code);
            if (c && !disabled) onSubmit(c);
          }}
          onPaste={(e) => {
            // colou várias linhas? fica só a primeira aqui — para várias, use "Rastreio em lote"
            const t = e.clipboardData.getData("text");
            if (t.includes("\n")) {
              e.preventDefault();
              setCode(normalizeTrackingCode(t.split(/\r?\n/)[0]));
            }
          }}
          placeholder="Colar código + Enter"
          aria-label="Código de rastreio"
          className="w-44 rounded-lg border border-dashed border-black/25 bg-white px-2 py-1 font-mono text-xs outline-none placeholder:font-sans focus:border-solid focus:border-black"
        />
        <button type="submit" disabled={disabled || !code.trim()} title="Salvar rastreio e avisar o cliente" className="rounded-lg bg-black px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? "…" : "✓"}
        </button>
      </div>
      <div className="h-4 text-[11px] text-black/50">{code ? (detected ? <span className="text-blue-700">{detected.name} detectada</span> : "transportadora não identificada (ok, salva mesmo assim)") : "salva, muda para Enviado e avisa o cliente"}</div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------
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
function Btn({ tone, children, onClick, disabled, title }: { tone: "primary" | "ghost" | "light" | "ghost-light"; children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  const cls = {
    primary: "bg-black text-white hover:bg-black/80",
    ghost: "border border-black/15 hover:bg-surface",
    light: "bg-white text-black hover:bg-white/90",
    "ghost-light": "border border-white/30 text-white hover:bg-white/10",
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}
function Copy({ value, title }: { value: string; title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="rounded px-1 text-[11px] text-black/40 hover:bg-black/5 hover:text-black"
    >
      {done ? "✓" : "⧉"}
    </button>
  );
}
