"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { bulkTrackingAction, type BulkTrackingActionResult } from "../../actions";
import { parseBulkTracking, type BulkLine } from "@/lib/crm/carriers";
import type { BulkTrackingEntry } from "@/lib/crm/tracking";

/**
 * Painel "Rastreio em lote": o operador cola a lista (um código por linha, na ordem dos pedidos
 * selecionados, ou `pedido;código;transportadora;url`) ou importa um CSV/TXT; vê a pré-visualização
 * com a transportadora detectada e, ao confirmar, recebe o resultado real linha a linha
 * (rastreio salvo? e-mail enviado para quem?).
 */
export interface SelectedOrder {
  id: string;
  ref: string;
  customer: string;
}

type Preview = BulkLine & { orderId?: string; orderLabel: string; problem?: string };

export default function BulkTracking({ selected, onClose, onDone }: { selected: SelectedOrder[]; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkTrackingActionResult | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview: Preview[] = useMemo(() => {
    const lines = parseBulkTracking(text);
    let seq = 0;
    return lines.map((l) => {
      if (l.error) return { ...l, orderLabel: "—", problem: l.error };
      if (l.ref) {
        const hit = selected.find((s) => s.ref === l.ref || s.ref.startsWith(l.ref) || s.id === l.ref);
        return { ...l, orderId: hit?.id, orderLabel: hit ? `#${short(hit.ref)} · ${hit.customer}` : `${l.ref} (procurar no banco)` };
      }
      const s = selected[seq++];
      if (!s) return { ...l, orderLabel: "—", problem: `sem pedido para esta linha — selecione mais pedidos na tabela ou escreva "pedido;código"` };
      return { ...l, orderId: s.id, orderLabel: `#${short(s.ref)} · ${s.customer}` };
    });
  }, [text, selected]);

  const ready = preview.filter((p) => !p.problem);
  const problems = preview.filter((p) => p.problem);

  function submit() {
    if (!ready.length) return;
    const entries: BulkTrackingEntry[] = ready.map((p) => ({ orderId: p.orderId, ref: p.orderId ? undefined : p.ref, code: p.code, carrier: p.carrier || undefined, url: p.url || undefined }));
    start(async () => {
      try {
        setResult(await bulkTrackingAction(entries));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/server action|failed to find|deployment|unexpected response/i.test(msg)) {
          setResult({ ok: false, error: "O sistema foi atualizado enquanto a página estava aberta. Recarregue a página e tente de novo." });
          return;
        }
        setResult({ ok: false, error: msg });
      }
    });
  }

  function importFile(f: File | undefined) {
    if (!f) return;
    f.text().then((t) => setText((prev) => (prev.trim() ? prev.trimEnd() + "\n" + t : t)));
    if (fileRef.current) fileRef.current.value = "";
  }

  function copyTemplate() {
    const body = selected.length ? selected.map((s) => `${short(s.ref)};`).join("\n") : "ad802126;6A12345678901\ncliente@email.com;1Z999AA10123456784;UPS";
    navigator.clipboard?.writeText(`pedido;codigo;transportadora\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <div className="w-full max-w-3xl rounded-3xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div>
            <h2 className="font-heading text-2xl leading-none">Rastreio em lote</h2>
            <p className="mt-1 text-xs text-black/60">
              {selected.length ? (
                <>
                  <b>{selected.length} pedido(s) selecionado(s)</b>: cole um código por linha, na mesma ordem da tabela.
                </>
              ) : (
                <>Nenhum pedido selecionado: escreva uma linha por pedido no formato abaixo.</>
              )}{" "}
              Também aceita <code className="rounded bg-black/5 px-1">pedido;código;transportadora;url</code> (pedido = início do nº, ex. <code className="rounded bg-black/5 px-1">ad802126</code>, ou o e-mail do cliente). Transportadora vazia é detectada pelo código.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full border border-black/15 px-2.5 py-1 text-xs font-semibold hover:bg-surface">
            Fechar
          </button>
        </div>

        {!result || !result.ok ? (
          <div className="px-5 py-4">
            {selected.length > 0 && (
              <ol className="mb-2 flex flex-wrap gap-1 text-[11px] text-black/60">
                {selected.map((s, i) => (
                  <li key={s.id} className="rounded-full bg-black/5 px-2 py-0.5">
                    {i + 1}. #{short(s.ref)} · {s.customer}
                  </li>
                ))}
              </ol>
            )}
            <textarea
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.min(14, Math.max(6, text.split("\n").length + 1))}
              spellCheck={false}
              placeholder={selected.length ? "6A12345678901\n1Z999AA10123456784\nLP00123456789012\n…" : "ad802126;6A12345678901\ncliente@email.com;1Z999AA10123456784;UPS\n34a4b319;LP00123456789012;Cainiao;https://…"}
              className="w-full rounded-2xl border border-black/15 bg-surface/40 px-3 py-2 font-mono text-sm outline-none focus:border-black"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/plain,text/csv" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-black/15 px-3 py-1.5 font-semibold hover:bg-surface">
                📄 Importar CSV / TXT
              </button>
              <button type="button" onClick={copyTemplate} title="Copia um modelo com os pedidos selecionados para preencher no Excel/Sheets" className="rounded-full border border-black/15 px-3 py-1.5 font-semibold hover:bg-surface">
                {copied ? "✓ Copiado" : "⧉ Copiar modelo"}
              </button>
              {text.trim() && (
                <button type="button" onClick={() => setText("")} className="rounded-full px-3 py-1.5 font-semibold text-black/50 hover:bg-surface">
                  Limpar
                </button>
              )}
              <span className="ml-auto text-black/50">
                {preview.length ? `${ready.length} pronto(s)${problems.length ? ` · ${problems.length} com problema` : ""}` : "aguardando colagem…"}
              </span>
            </div>

            {preview.length > 0 && (
              <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-black/10">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface text-left text-[10px] uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Pedido</th>
                      <th className="px-2 py-1.5">Código</th>
                      <th className="px-2 py-1.5">Transportadora</th>
                      <th className="px-2 py-1.5">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {preview.map((p) => (
                      <tr key={p.line} className={p.problem ? "bg-red-50/60" : ""}>
                        <td className="px-2 py-1.5 text-black/40">{p.line}</td>
                        <td className="px-2 py-1.5">{p.orderLabel}</td>
                        <td className="px-2 py-1.5 font-mono">{p.code || "—"}</td>
                        <td className="px-2 py-1.5">{p.carrier || <span className="text-black/40">não identificada</span>}</td>
                        <td className="px-2 py-1.5">{p.problem ? <span className="text-red-700">✗ {p.problem}</span> : <span className="text-green-700">✓ pronto</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result && !result.ok && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{result.error}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-black/50">Cada pedido vira “Enviado” e o cliente recebe o e-mail de rastreio na hora (só na 1ª vez; depois use “Reenviar”).</p>
              <button type="button" onClick={submit} disabled={pending || !ready.length} className="btn-gradient rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {pending ? `Salvando ${ready.length}…` : `Salvar ${ready.length} rastreio(s) e avisar clientes`}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className={`rounded-2xl border px-4 py-3 text-sm ${result.failed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
              <b>
                {result.saved} rastreio(s) salvo(s) · {result.emailsSent} e-mail(s) confirmado(s) pelo provedor
                {result.failed ? ` · ${result.failed} linha(s) com erro` : ""}
              </b>
            </div>
            <ul className="mt-3 max-h-80 divide-y divide-black/5 overflow-auto rounded-2xl border border-black/10 text-xs">
              {result.results.map((r, i) => (
                <li key={i} className="flex items-start gap-2 px-3 py-2">
                  <span className="mt-0.5">{r.ok ? "✅" : "❌"}</span>
                  <div>
                    <div className="font-semibold">
                      {r.orderRef ? `#${short(r.orderRef)}` : r.entry.ref ? r.entry.ref : "—"}
                      {r.customer ? ` · ${r.customer}` : ""} <span className="font-mono font-normal text-black/60">{r.entry.code}</span>
                    </div>
                    <div className={r.ok ? "text-black/70" : "text-red-700"}>{r.message}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setResult(null)} className="rounded-full border border-black/15 px-4 py-2 text-xs font-semibold hover:bg-surface">
                Colar outra lista
              </button>
              <button
                type="button"
                onClick={() => {
                  onDone();
                  onClose();
                }}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
              >
                Concluir e atualizar a tabela
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function short(ref: string): string {
  return ref.length > 12 ? ref.slice(0, 8) : ref;
}
