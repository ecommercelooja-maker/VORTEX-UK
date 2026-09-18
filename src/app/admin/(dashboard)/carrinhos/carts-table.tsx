"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { CartRow } from "../../queries";
import type { ActionResult } from "../../actions";
import { markCartRecoveredAction, markContactedAction, markContactedBulkAction, sendRecoveryBulkAction, sendRecoveryNowAction } from "../../actions";

/**
 * Tabela compacta de carrinhos abandonados com seleção em lote, ações inline (enviar e-mail,
 * WhatsApp manual com texto pronto, marcar contatado/recuperado) e linha expansível com detalhes.
 */
export type CartRowView = CartRow & {
  /** texto de recuperação no idioma do cliente, para o link do WhatsApp (wa.me) */
  wa_text: string | null;
  country: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-blue-100 text-blue-800" },
  abandoned: { label: "Abandonado", cls: "bg-amber-100 text-amber-800" },
  recovered: { label: "Recuperado", cls: "bg-green-100 text-green-800" },
  manually_recovered: { label: "Recuperado (manual)", cls: "bg-green-100 text-green-800" },
  expired: { label: "Expirado", cls: "bg-black/5 text-black/60" },
};
const CHANNEL_LABEL: Record<string, string> = { email: "e-mail", whatsapp: "WhatsApp", phone: "telefone", sms: "SMS", outro: "outro" };

function money(v: number | string | null | undefined, currency: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "GBP" }).format(n);
}
function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60e3));
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
function flag(iso: string | null): string {
  if (!iso || iso.length !== 2) return "";
  return String.fromCodePoint(...iso.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function waLink(phone: string, text: string | null): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export default function CartsTable({ rows, nowIso }: { rows: CartRowView[]; nowIso: string }) {
  const router = useRouter();
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id da linha (ou "bulk") em processamento
  const [pending, start] = useTransition();

  const actionable = rows.filter((r) => r.status === "abandoned" && (r.customer_id || r.contact_email || r.contact_phone));
  const allSelected = actionable.length > 0 && actionable.every((r) => selected.has(r.id));

  function run(key: string, fn: () => Promise<ActionResult>, after?: () => void) {
    setBusy(key);
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // guia aberta antes de um deploy novo: a action antiga não existe mais → recarrega para pegar a versão nova
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
  const ids = Array.from(selected);

  return (
    <div className="relative">
      {/* Barra de lote */}
      <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors ${ids.length ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60"}`}>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(actionable.map((r) => r.id)))} className="h-4 w-4 accent-black" aria-label="Selecionar todos com contato" />
          <span className="font-semibold">{ids.length ? `${ids.length} selecionado(s)` : `Selecionar os ${actionable.length} com contato desta página`}</span>
        </label>
        {ids.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Btn tone="light" disabled={pending} onClick={() => run("bulk", () => sendRecoveryBulkAction(ids), () => setSelected(new Set()))}>
              {busy === "bulk" && pending ? "Enviando…" : `✉ Enviar e-mail (${ids.length})`}
            </Btn>
            <Btn tone="ghost-light" disabled={pending} onClick={() => run("bulk", () => markContactedBulkAction(ids, "whatsapp"), () => setSelected(new Set()))}>
              ✓ Marcar contatados
            </Btn>
            <Btn tone="ghost-light" onClick={() => setSelected(new Set())}>
              Limpar
            </Btn>
          </div>
        )}
      </div>

      {toast && (
        <div className={`mb-3 flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${toast.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <span className="whitespace-pre-line font-medium">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs underline">
            fechar
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-black/55">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-3 py-2 font-semibold">Carrinho</th>
              <th className="px-3 py-2 font-semibold">Abandonado</th>
              <th className="px-3 py-2 font-semibold">Recuperação</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-black/50">
                  Nenhum carrinho neste filtro.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const st = STATUS[r.status] ?? { label: r.status, cls: "bg-black/5 text-black/60" };
                const canAct = r.status === "abandoned";
                const hasCustomer = Boolean(r.customer_id);
                const isSel = selected.has(r.id);
                const isOpen = open.has(r.id);
                const rowBusy = busy === r.id && pending;
                const lastEmail = r.automations.find((a) => a.channel === "email");
                return (
                  <RowGroup key={r.id}>
                    <tr className={`align-top transition-colors ${isSel ? "bg-blue-50/60" : "hover:bg-surface/50"}`}>
                      <td className="px-3 py-2.5">
                        {canAct && (hasCustomer || r.contact_email || r.contact_phone) ? (
                          <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} className="mt-1 h-4 w-4 accent-black" aria-label="Selecionar" />
                        ) : (
                          <span className="block h-4 w-4" />
                        )}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.country && (
                            <span className="text-base leading-none" title={r.country}>
                              {flag(r.country)}
                            </span>
                          )}
                          {r.customer ? (
                            <Link href={`/admin/clientes/${r.customer.id}`} className="truncate font-semibold underline-offset-2 hover:underline" title={r.contact_email ?? ""}>
                              {r.contact_name ?? r.contact_email ?? r.contact_phone ?? "(sem nome)"}
                            </Link>
                          ) : r.contact_email || r.contact_phone ? (
                            <span className="truncate font-semibold">{r.contact_email ?? r.contact_phone}</span>
                          ) : (
                            <span className="text-black/40">anônimo</span>
                          )}
                        </div>
                        {r.contact_name && (
                          <div className="truncate text-xs text-black/55" title={r.contact_email ?? ""}>
                            {r.contact_email ?? <span className="text-black/30">sem e-mail</span>}
                          </div>
                        )}
                        {r.contact_phone && <div className="text-xs text-black/55">{r.contact_phone}</div>}
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <div className="truncate text-xs text-black/70" title={r.product_summary ?? ""}>
                          {r.product_summary ?? "—"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="font-semibold">{money(r.total, r.currency)}</span>
                          <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] text-black/55">{r.source === "checkout" ? "checkout Umpi" : r.source}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="font-semibold">há {ago(r.abandoned_at ?? r.last_activity_at, nowMs)}</div>
                        <div className="text-xs text-black/50">{fmt(r.abandoned_at ?? r.last_activity_at)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {r.email_sent > 0 && <Chip tone="green" title={`último e-mail ${fmt(lastEmail?.at)}`}>✉ {r.email_sent}× · há {ago(lastEmail?.at, nowMs)}</Chip>}
                          {r.email_pending > 0 && <Chip tone="amber">✉ na fila</Chip>}
                          {r.email_failed > 0 && r.email_sent === 0 && <Chip tone="red" title={lastEmail?.error ?? ""}>✉ falhou</Chip>}
                          {r.whatsapp_sent > 0 && <Chip tone="green">💬 {r.whatsapp_sent}×</Chip>}
                          {r.contacts.length > 0 && <Chip tone="blue" title={r.contacts[0].note}>👤 {CHANNEL_LABEL[r.contacts[0].channel] ?? r.contacts[0].channel} · há {ago(r.contacts[0].at, nowMs)}</Chip>}
                          {r.email_sent === 0 && r.email_pending === 0 && r.email_failed === 0 && r.whatsapp_sent === 0 && r.contacts.length === 0 && <span className="text-xs text-black/35">nenhuma ação ainda</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canAct && hasCustomer && (
                            <Btn tone="primary" disabled={pending} title={r.customer?.marketing_email_opt_in || r.source === "checkout" ? "Envia o e-mail de recuperação agora" : "Cliente sem opt-in de marketing: o envio será recusado"} onClick={() => run(r.id, () => sendRecoveryNowAction(r.id))}>
                              {rowBusy ? "…" : "✉ E-mail"}
                            </Btn>
                          )}
                          {canAct && r.contact_phone && (
                            <a href={waLink(r.contact_phone, r.wa_text)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-green-600 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50" title="Abre o WhatsApp com a mensagem pronta; depois marque como contatado">
                              💬 WhatsApp
                            </a>
                          )}
                          {canAct && (
                            <Btn tone="ghost" disabled={pending} title="Registrar que você falou com o cliente por fora" onClick={() => run(r.id, () => markContactedAction(r.id, r.contact_phone ? "whatsapp" : "email"))}>
                              ✓ Contatado
                            </Btn>
                          )}
                          {canAct && (
                            <Btn
                              tone="ghost"
                              disabled={pending}
                              title="O cliente comprou por fora ou não vai comprar: tira da fila"
                              onClick={() => {
                                if (window.confirm("Marcar este carrinho como recuperado manualmente?")) run(r.id, () => markCartRecoveredAction(r.id));
                              }}
                            >
                              🛒 Recuperado
                            </Btn>
                          )}
                          <Btn tone="ghost" onClick={() => toggleOpen(r.id)} title="Detalhes">
                            {isOpen ? "▴" : "▾"}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface/60">
                        <td />
                        <td colSpan={6} className="px-3 pb-4 pt-1">
                          <div className="grid gap-4 text-xs md:grid-cols-3">
                            <div>
                              <h4 className="mb-1 font-semibold uppercase tracking-wide text-black/50">Itens</h4>
                              <ul className="flex flex-col gap-0.5">
                                {(r.items ?? []).length ? (
                                  r.items.map((i, k) => (
                                    <li key={k} className="flex justify-between gap-2">
                                      <span className="truncate">
                                        {i.name}
                                        {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                                      </span>
                                      <span className="whitespace-nowrap text-black/60">{money(i.total, r.currency)}</span>
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-black/40">sem itens registrados</li>
                                )}
                              </ul>
                              {r.checkout_url && (
                                <div className="mt-2 flex items-center gap-2">
                                  <a href={r.checkout_url} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2">
                                    link do checkout
                                  </a>
                                  <CopyBtn text={r.checkout_url} />
                                </div>
                              )}
                              <div className="mt-2 text-black/50">
                                Criado {fmt(r.created_at)} · última atividade {fmt(r.last_activity_at)}
                                {r.recovered_at ? ` · recuperado ${fmt(r.recovered_at)}` : ""}
                              </div>
                            </div>
                            <div>
                              <h4 className="mb-1 font-semibold uppercase tracking-wide text-black/50">Mensagens automáticas</h4>
                              {r.automations.length ? (
                                <ul className="flex flex-col gap-0.5">
                                  {r.automations.slice(0, 6).map((a, k) => (
                                    <li key={k} className="flex items-center gap-2">
                                      <span className={`h-1.5 w-1.5 rounded-full ${a.status === "sent" || a.status === "delivered" ? "bg-green-500" : a.status === "failed" ? "bg-red-500" : a.status === "cancelled" ? "bg-black/30" : "bg-amber-400"}`} />
                                      <span>{a.channel === "email" ? "E-mail" : a.channel === "whatsapp" ? "WhatsApp" : a.channel}</span>
                                      <span className="text-black/50">{fmt(a.at)}</span>
                                      <span className="text-black/50">{a.status === "sent" || a.status === "delivered" ? "enviado" : a.status === "failed" ? `falhou: ${a.error ?? ""}` : a.status}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-black/40">Nenhuma ainda.</p>
                              )}
                              {r.customer && (
                                <p className="mt-2 text-black/50">
                                  Opt-in e-mail: {r.customer.marketing_email_opt_in ? "sim" : "não"} · WhatsApp: {r.customer.marketing_whatsapp_opt_in ? "sim" : "não"}
                                  {r.source === "checkout" ? " · veio do checkout (recuperação por e-mail liberada)" : ""}
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="mb-1 font-semibold uppercase tracking-wide text-black/50">Contatos manuais</h4>
                              {r.contacts.length ? (
                                <ul className="flex flex-col gap-0.5">
                                  {r.contacts.slice(0, 6).map((c, k) => (
                                    <li key={k}>
                                      <b>{CHANNEL_LABEL[c.channel] ?? c.channel}</b> · {fmt(c.at)}
                                      {c.note ? ` · ${c.note}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-black/40">Nenhum ainda.</p>
                              )}
                              {canAct && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {(["whatsapp", "phone", "email"] as const).map((ch) => (
                                    <Btn key={ch} tone="ghost" disabled={pending} onClick={() => run(r.id, () => markContactedAction(r.id, ch))}>
                                      + {CHANNEL_LABEL[ch]}
                                    </Btn>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </RowGroup>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
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

function Chip({ tone, title, children }: { tone: "green" | "amber" | "red" | "blue"; title?: string; children: ReactNode }) {
  const cls = { green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", blue: "bg-blue-100 text-blue-800" }[tone];
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-full border border-black/15 px-2 py-0.5 text-[11px] hover:bg-white"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? "copiado" : "copiar"}
    </button>
  );
}
