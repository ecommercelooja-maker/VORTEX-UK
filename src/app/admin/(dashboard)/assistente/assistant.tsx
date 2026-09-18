"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assistantChatAction, searchCustomersAction, sendAssistantEmailAction, type ActionResult } from "../../actions";
import type { AiDraft, AiMessage } from "@/lib/crm/ai";
import type { CustomerPick } from "../../queries";

export interface AssistantCustomer {
  id: string;
  name: string | null;
  email: string | null;
  orders: number;
  lastOrder: string | null;
  abandonedCarts: number;
  lastActivity: string;
}

type ChatItem = { role: "user" | "assistant"; text: string; history: string };

const QUICK = [
  { label: "Confirmar recebimento", prompt: "Escreva um e-mail perguntando se o cliente recebeu o pedido e se está satisfeito com o produto." },
  { label: "Avisar atraso", prompt: "Escreva um e-mail avisando que a entrega do pedido vai atrasar alguns dias, pedindo desculpas e passando o rastreio se houver." },
  { label: "Recuperar carrinho", prompt: "Escreva um e-mail amigável lembrando o cliente do carrinho abandonado, com o link do checkout, sem inventar desconto." },
  { label: "Responder reclamação", prompt: "O cliente reclamou. Escreva um e-mail empático, pedindo detalhes/fotos do problema e explicando a garantia de 60 dias." },
  { label: "Enviar rastreio", prompt: "Escreva um e-mail informando o código de rastreio do último pedido e como acompanhar." },
];

export default function Assistant({ configured, customer }: { configured: boolean; customer: AssistantCustomer | null }) {
  const router = useRouter();
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<ActionResult | null>(null);
  const [thinking, startThinking] = useTransition();
  const [sending, startSending] = useTransition();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerPick[]>([]);
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, thinking]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  // Busca de cliente (debounce simples, disparada pelo input)
  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const seq = ++searchSeq.current;
    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchCustomersAction(value);
        if (seq === searchSeq.current) setResults(r);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
  }

  function pickCustomer(id: string) {
    searchSeq.current++;
    setSearch("");
    setResults([]);
    setChat([]);
    setDraft(null);
    setSendResult(null);
    setError(null);
    router.push(`/admin/assistente?cliente=${id}`);
  }

  function send(prompt: string) {
    const text = prompt.trim();
    if (!text || thinking) return;
    setError(null);
    setSendResult(null);
    const next: ChatItem[] = [...chat, { role: "user", text, history: text }];
    setChat(next);
    setInput("");
    startThinking(async () => {
      const messages: AiMessage[] = next.map((m) => ({ role: m.role, content: m.history }));
      const r = await assistantChatAction(customer?.id ?? null, messages);
      if (!r.ok) {
        setError(r.error);
        setChat(chat);
        setInput(text);
        return;
      }
      const history = r.turn.draft ? `${r.turn.reply}\n\n[Rascunho atual]\nAssunto: ${r.turn.draft.subject}\n\n${r.turn.draft.body}` : r.turn.reply;
      setChat([...next, { role: "assistant", text: r.turn.reply, history }]);
      if (r.turn.draft) setDraft(r.turn.draft);
    });
  }

  function sendEmail() {
    if (!customer || !draft || sending) return;
    if (!window.confirm(`Enviar este e-mail agora para ${customer.email}?`)) return;
    startSending(async () => {
      const r = await sendAssistantEmailAction(customer.id, draft.subject, draft.body);
      setSendResult(r);
      if (r.ok) {
        setChat((c) => [...c, { role: "assistant", text: r.message ?? "E-mail enviado.", history: `(operador enviou o e-mail: ${r.message ?? "ok"})` }]);
      }
    });
  }

  const canSend = Boolean(configured && customer?.email && draft?.subject && draft?.body && !sending);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      {/* Coluna esquerda: cliente + conversa */}
      <section className="flex min-h-[560px] flex-col rounded-2xl border border-black/10 bg-white">
        <div className="border-b border-black/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-black/50">Cliente</div>
              {customer ? (
                <>
                  <div className="font-semibold">{customer.name ?? "(sem nome)"}</div>
                  <div className="text-sm text-black/60">{customer.email ?? "sem e-mail — não é possível enviar"}</div>
                  <div className="mt-1 text-xs text-black/50">
                    {customer.orders} pedido(s){customer.lastOrder ? ` · último: ${customer.lastOrder}` : ""} · {customer.abandonedCarts} carrinho(s) abandonado(s) · última atividade {customer.lastActivity}
                  </div>
                </>
              ) : (
                <div className="text-sm text-black/60">Nenhum cliente selecionado. Busque abaixo ou abra a ficha de um cliente e clique em “Escrever e-mail com I.A.”.</div>
              )}
            </div>
            {customer && (
              <button type="button" onClick={() => router.push("/admin/assistente")} className="rounded-full border border-black/20 px-3 py-1 text-xs font-semibold hover:bg-surface">
                Trocar cliente
              </button>
            )}
          </div>
          <div className="relative mt-3">
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={customer ? "Trocar para outro cliente (nome, e-mail ou telefone)" : "Buscar cliente por nome, e-mail ou telefone"}
              className="w-full rounded-full border border-black/20 px-4 py-2 text-sm"
            />
            {(results.length > 0 || searching) && (
              <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-black/10 bg-white shadow-lg">
                {searching && results.length === 0 && <li className="px-4 py-2 text-xs text-black/50">Buscando…</li>}
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickCustomer(c.id)} className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-surface">
                      <span className="text-sm font-semibold">{c.name ?? "(sem nome)"}</span>
                      <span className="text-xs text-black/60">
                        {c.email ?? "sem e-mail"} · {c.total_orders} pedido(s)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {chat.length === 0 && (
            <div className="text-sm text-black/60">
              <p className="mb-2">Exemplos do que você pode pedir:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button key={q.label} type="button" disabled={!configured || thinking} onClick={() => send(q.prompt)} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-50">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "ml-auto bg-black text-white" : "bg-surface"}`}>
              {m.text}
            </div>
          ))}
          {thinking && <div className="max-w-[92%] rounded-2xl bg-surface px-4 py-2.5 text-sm text-black/50">Escrevendo…</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-black/10 p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            disabled={!configured}
            placeholder={configured ? "Ex.: avise que o pedido sai amanhã e peça desculpas pela demora" : "Configure ANTHROPIC_API_KEY para usar a assistente"}
            className="flex-1 resize-none rounded-xl border border-black/20 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={!configured || thinking || !input.trim()} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {thinking ? "…" : "Pedir"}
          </button>
        </form>
      </section>

      {/* Coluna direita: rascunho editável + envio */}
      <section className="flex min-h-[560px] flex-col rounded-2xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-2xl">Rascunho do e-mail</h2>
          {draft && (
            <button type="button" onClick={() => setDraft(null)} className="text-xs text-black/50 hover:text-black">
              Limpar
            </button>
          )}
        </div>
        {!draft ? (
          <p className="text-sm text-black/50">O e-mail redigido pela assistente aparece aqui. Você pode editar o texto antes de enviar.</p>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-black/50">
              Assunto
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm font-normal normal-case tracking-normal" />
            </label>
            <label className="flex flex-1 flex-col text-xs font-semibold uppercase tracking-wide text-black/50">
              Mensagem
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="mt-1 min-h-[320px] flex-1 rounded-xl border border-black/20 px-3 py-2 font-sans text-sm font-normal normal-case leading-relaxed tracking-normal" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={sendEmail} disabled={!canSend} className="rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                {sending ? "Enviando…" : customer?.email ? `Enviar para ${customer.email}` : "Selecione um cliente com e-mail"}
              </button>
              <span className="text-xs text-black/50">Vai com o layout padrão da loja e fica registrado na aba Mensagens enviadas.</span>
            </div>
            {sendResult && <p className={`text-sm ${sendResult.ok ? "text-green-700" : "text-red-700"}`}>{sendResult.ok ? sendResult.message : sendResult.error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
