import Link from "next/link";
import type { ReactNode } from "react";
import { PAGE_SIZE, customersReached, listMessages, messageStats } from "../../queries";
import { AUTOMATION_STATUS_LABEL, AUTOMATION_TYPE_LABEL, Badge, PageTitle, Pagination, Stat, StatusBadge, Table, Td, fmtDate } from "../../ui";
import ActionButton from "../../action-button";
import { retryAutomationAction } from "../../actions";
import { ChannelBadge, messagePreview } from "./ui";

export const dynamic = "force-dynamic";

const CHANNELS = [
  { value: "todos", label: "Todos os canais" },
  { value: "email", label: "✉️ E-mail" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "sms", label: "📱 SMS" },
];
const TYPES = [
  { value: "todos", label: "Todos os tipos" },
  { value: "abandoned_cart", label: "Carrinho abandonado" },
  { value: "purchase_confirmation", label: "Confirmação de compra" },
  { value: "tracking_notification", label: "Rastreio" },
  { value: "promotion_reminder", label: "Promoção" },
  { value: "manual_followup", label: "Manual / I.A." },
];
const STATUSES = [
  { value: "sent", label: "Enviadas" },
  { value: "todos", label: "Todas" },
  { value: "failed", label: "Falhas" },
  { value: "pending", label: "Pendentes" },
  { value: "cancelled", label: "Canceladas" },
];

type Params = { v?: string; c?: string; t?: string; s?: string; q?: string; page?: string };

function href(p: Params): string {
  const sp = new URLSearchParams();
  if (p.v === "clientes") sp.set("v", "clientes");
  if (p.c && p.c !== "todos") sp.set("c", p.c);
  if (p.t && p.t !== "todos") sp.set("t", p.t);
  if (p.s && p.s !== "sent") sp.set("s", p.s);
  if (p.q) sp.set("q", p.q);
  const s = sp.toString();
  return s ? `/admin/mensagens?${s}` : "/admin/mensagens";
}

function Pill({ active, href: h, children }: { active: boolean; href: string; children: ReactNode }) {
  return (
    <Link href={h} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}>
      {children}
    </Link>
  );
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const view = sp.v === "clientes" ? "clientes" : "mensagens";
  const channel = CHANNELS.some((x) => x.value === sp.c) ? sp.c! : "todos";
  const type = TYPES.some((x) => x.value === sp.t) ? sp.t! : "todos";
  const status = STATUSES.some((x) => x.value === sp.s) ? sp.s! : "sent";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const cur: Params = { v: view, c: channel, t: type, s: status, q };

  const [stats, list, byCustomer] = await Promise.all([
    messageStats(),
    view === "mensagens" ? listMessages({ channel, type, status, q }, page) : Promise.resolve({ rows: [], count: 0 }),
    view === "clientes" ? customersReached(q) : Promise.resolve([]),
  ]);
  const extra = new URLSearchParams();
  if (channel !== "todos") extra.set("c", channel);
  if (type !== "todos") extra.set("t", type);
  if (status !== "sent") extra.set("s", status);
  if (q) extra.set("q", q);

  return (
    <>
      <PageTitle
        title="Mensagens enviadas"
        subtitle="Tudo que a loja mandou aos clientes por e-mail, WhatsApp ou SMS: quem recebeu, quando, por qual canal e o conteúdo exato."
        actions={
          <Link href="/admin/assistente" className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-black/80">
            ✦ Escrever mensagem com I.A.
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Mensagens enviadas" value={stats.sentTotal} hint={`${stats.sent7d} nos últimos 7 dias`} />
        <Stat label="Clientes alcançados" value={stats.customersReached} hint="receberam ao menos uma mensagem" />
        <Stat label="✉️ E-mail" value={stats.byChannel.email ?? 0} hint="enviados" />
        <Stat label="💬 WhatsApp · 📱 SMS" value={(stats.byChannel.whatsapp ?? 0) + (stats.byChannel.sms ?? 0)} hint={stats.byChannel.whatsapp || stats.byChannel.sms ? "enviados" : "sem integração ainda"} />
        <Stat label="Falhas" value={stats.failed} hint={stats.pending ? `${stats.pending} pendentes` : "nenhuma pendente"} />
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 rounded-full bg-surface p-1">
            <Pill active={view === "mensagens"} href={href({ ...cur, v: "mensagens" })}>
              Por mensagem
            </Pill>
            <Pill active={view === "clientes"} href={href({ ...cur, v: "clientes" })}>
              Por cliente
            </Pill>
          </div>
          <form action="/admin/mensagens" className="flex gap-2">
            {view === "clientes" && <input type="hidden" name="v" value="clientes" />}
            {channel !== "todos" && <input type="hidden" name="c" value={channel} />}
            {type !== "todos" && <input type="hidden" name="t" value={type} />}
            {status !== "sent" && <input type="hidden" name="s" value={status} />}
            <input name="q" defaultValue={q} placeholder="Buscar por e-mail, telefone ou assunto" className="w-72 rounded-full border border-black/20 px-4 py-1.5 text-sm" />
            <button type="submit" className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
              Buscar
            </button>
          </form>
        </div>
        {view === "mensagens" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((o) => (
                <Pill key={o.value} active={o.value === channel} href={href({ ...cur, c: o.value })}>
                  {o.label}
                </Pill>
              ))}
              <span className="mx-1 border-l border-black/10" />
              {STATUSES.map((o) => (
                <Pill key={o.value} active={o.value === status} href={href({ ...cur, s: o.value })}>
                  {o.label}
                </Pill>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((o) => (
                <Pill key={o.value} active={o.value === type} href={href({ ...cur, t: o.value })}>
                  {o.label}
                </Pill>
              ))}
            </div>
          </>
        )}
      </div>

      {view === "mensagens" ? (
        <>
          <Table head={["Enviada", "Cliente", "Canal", "Tipo", "Mensagem", "Status", "Ações"]} empty="Nenhuma mensagem com esses filtros.">
            {list.rows.map((a) => (
              <tr key={a.id} className="hover:bg-surface/60">
                <Td className="whitespace-nowrap">
                  <Link href={`/admin/mensagens/${a.id}`} className="underline-offset-2 hover:underline">
                    {fmtDate(a.sent_at ?? a.created_at)}
                  </Link>
                </Td>
                <Td className="break-all">
                  {a.customer_id ? (
                    <Link href={`/admin/clientes/${a.customer_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {a.customer?.name ?? a.recipient ?? "cliente"}
                    </Link>
                  ) : (
                    <span className="font-semibold">{a.recipient ?? "—"}</span>
                  )}
                  {a.customer?.name && a.recipient && <div className="text-xs text-black/50">{a.recipient}</div>}
                </Td>
                <Td>
                  <ChannelBadge channel={a.channel} />
                </Td>
                <Td>
                  {AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type}
                  {a.metadata?.source === "ai_assistant" && <span className="ml-1 rounded-full bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">I.A.</span>}
                  {typeof a.metadata?.country === "string" && <div className="text-[11px] text-black/50">país {a.metadata.country}</div>}
                </Td>
                <Td className="max-w-[360px]">
                  <Link href={`/admin/mensagens/${a.id}`} className="block underline-offset-2 hover:underline">
                    <span className="font-semibold">{a.subject ?? (typeof a.metadata?.subject === "string" ? a.metadata.subject : "")}</span>
                    <span className="block truncate text-xs text-black/60">{messagePreview(a)}</span>
                  </Link>
                </Td>
                <Td>
                  <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
                  {a.error_message && <div className="max-w-[200px] text-[11px] text-red-700">{a.error_message}</div>}
                </Td>
                <Td className="whitespace-nowrap">
                  <Link href={`/admin/mensagens/${a.id}`} className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
                    Ver mensagem
                  </Link>{" "}
                  {a.status === "failed" && <ActionButton action={retryAutomationAction.bind(null, a.id)} label="Reprocessar" pendingLabel="…" />}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination base="/admin/mensagens" page={page} count={list.count} pageSize={PAGE_SIZE} extra={extra.toString()} />
        </>
      ) : (
        <Table head={["Cliente", "Contato", "Mensagens recebidas", "Canais", "O que já recebeu", "Última mensagem", "Ações"]} empty="Nenhum cliente recebeu mensagem ainda.">
          {byCustomer.map((c) => (
            <tr key={c.customer.id} className="hover:bg-surface/60">
              <Td>
                <Link href={`/admin/clientes/${c.customer.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {c.customer.name ?? "(sem nome)"}
                </Link>
                <div className="text-[11px] text-black/50">primeira em {fmtDate(c.first_at)}</div>
              </Td>
              <Td className="break-all text-xs">
                {c.customer.email && <div>{c.customer.email}</div>}
                {(c.customer.whatsapp ?? c.customer.phone) && <div className="text-black/60">{c.customer.whatsapp ?? c.customer.phone}</div>}
              </Td>
              <Td className="text-lg font-bold">{c.total}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(c.byChannel).map(([ch, n]) => (
                    <ChannelBadge key={ch} channel={ch} count={n} />
                  ))}
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.types.map((t) => (
                    <Badge key={t}>{AUTOMATION_TYPE_LABEL[t] ?? t}</Badge>
                  ))}
                </div>
              </Td>
              <Td className="max-w-[300px]">
                <Link href={`/admin/mensagens/${c.last.id}`} className="block underline-offset-2 hover:underline">
                  <span className="whitespace-nowrap text-xs text-black/50">{fmtDate(c.last.sent_at ?? c.last.created_at)}</span>
                  <span className="block truncate text-sm">{c.last.subject ?? messagePreview(c.last)}</span>
                </Link>
              </Td>
              <Td className="whitespace-nowrap">
                <Link href={`/admin/mensagens?q=${encodeURIComponent(c.customer.email ?? c.customer.phone ?? "")}`} className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
                  Ver todas
                </Link>{" "}
                <Link href={`/admin/assistente?cliente=${c.customer.id}`} className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
                  ✦ Escrever
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
