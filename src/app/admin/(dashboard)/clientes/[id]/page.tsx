import Link from "next/link";
import { notFound } from "next/navigation";
import { customerDetail } from "../../../queries";
import { AUTOMATION_STATUS_LABEL, AUTOMATION_TYPE_LABEL, Badge, CART_STATUS_LABEL, Card, EVENT_LABEL, ORDER_STATUS_LABEL, PageTitle, StatusBadge, Table, Td, fmtDate, fmtMoney } from "../../../ui";
import ManualContactForm from "./manual-contact-form";

export const dynamic = "force-dynamic";

type TimelineItem = { at: string; label: string; detail?: string; tone: "gray" | "green" | "yellow" | "red" | "blue"; href?: string };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await customerDetail(id);
  if (!d) notFound();
  const { customer, orders, carts, events, automations } = d;

  // Timeline completa: eventos do cliente + automações (pendentes/falhas também aparecem)
  const timeline: TimelineItem[] = [
    ...events.map((e) => ({
      at: e.created_at,
      label: EVENT_LABEL[e.event_type] ?? e.event_type,
      detail: eventDetail(e.event_type, e.metadata),
      tone: toneFor(e.event_type),
      href: e.order_id ? `/admin/pedidos/${e.order_id}` : undefined,
    })),
    ...automations
      .filter((a) => a.status !== "sent" && a.status !== "delivered") // enviadas já aparecem como email_sent/whatsapp_sent
      .map((a) => ({
        at: a.created_at,
        label: `${AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type} (${a.channel}) — ${AUTOMATION_STATUS_LABEL[a.status]?.label ?? a.status}`,
        detail: a.error_message ?? undefined,
        tone: (a.status === "failed" ? "red" : a.status === "cancelled" ? "gray" : "yellow") as TimelineItem["tone"],
      })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      <PageTitle
        title={customer.name ?? "(sem nome)"}
        subtitle={`Cliente desde ${fmtDate(customer.created_at)}`}
        actions={
          <Link href={`/admin/assistente?cliente=${customer.id}`} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-black/80">
            ✦ Escrever e-mail com I.A.
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Card title="Contato">
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
              <dt className="text-black/50">E-mail</dt>
              <dd className="break-all">{customer.email ?? "—"} {customer.email_verified && <Badge tone="green">verificado</Badge>}</dd>
              <dt className="text-black/50">Telefone</dt>
              <dd>{customer.phone ?? "—"} {customer.phone_verified && <Badge tone="green">verificado</Badge>}</dd>
              <dt className="text-black/50">WhatsApp</dt>
              <dd>{customer.whatsapp ?? "—"}</dd>
              <dt className="text-black/50">Marketing</dt>
              <dd className="text-xs">
                e-mail: {customer.marketing_email_opt_in ? "sim" : "não"} · WhatsApp: {customer.marketing_whatsapp_opt_in ? "sim" : "não"} · SMS: {customer.marketing_sms_opt_in ? "sim" : "não"}
              </dd>
              <dt className="text-black/50">Pedidos</dt>
              <dd>{customer.total_orders}</dd>
              <dt className="text-black/50">Total gasto</dt>
              <dd>{fmtMoney(customer.total_spent)}</dd>
              <dt className="text-black/50">Última compra</dt>
              <dd>{fmtDate(customer.last_order_at)}</dd>
              <dt className="text-black/50">Última interação</dt>
              <dd>{fmtDate(customer.last_activity_at)}</dd>
            </dl>
          </Card>
          <Card title="Registrar contato manual">
            <ManualContactForm customerId={customer.id} />
          </Card>
          <Card title="Pedidos">
            {orders.length === 0 ? (
              <p className="text-sm text-black/50">Nenhum pedido.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/pedidos/${o.id}`} className="font-semibold underline-offset-2 hover:underline">
                      #{o.external_order_id}
                    </Link>
                    <span className="text-black/60">{fmtMoney(o.total, o.currency)}</span>
                    <StatusBadge map={ORDER_STATUS_LABEL} value={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Carrinhos">
            {carts.length === 0 ? (
              <p className="text-sm text-black/50">Nenhum carrinho.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {carts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.product_summary ?? "—"}</span>
                    <span className="text-black/60">{fmtMoney(c.total, c.currency)}</span>
                    <StatusBadge map={CART_STATUS_LABEL} value={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Timeline">
          {timeline.length === 0 ? (
            <p className="text-sm text-black/50">Sem eventos ainda.</p>
          ) : (
            <ol className="relative ml-2 border-l border-black/10 pl-5">
              {timeline.map((t, i) => (
                <li key={i} className="relative mb-4">
                  <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${dot(t.tone)}`} />
                  <div className="text-xs text-black/50">{fmtDate(t.at)}</div>
                  <div className="text-sm font-semibold">
                    {t.href ? (
                      <Link href={t.href} className="underline-offset-2 hover:underline">
                        {t.label}
                      </Link>
                    ) : (
                      t.label
                    )}
                  </div>
                  {t.detail && <div className="text-xs text-black/60">{t.detail}</div>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
      <div className="mt-6">
        <Card title="Automações deste cliente">
          <Table head={["Criada", "Tipo", "Canal", "Status", "Destinatário", "Enviada", "Erro"]} empty="Nenhuma automação.">
            {automations
              .slice()
              .reverse()
              .map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap">{fmtDate(a.created_at)}</Td>
                  <Td>{AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type}</Td>
                  <Td>{a.channel}</Td>
                  <Td>
                    <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
                  </Td>
                  <Td>{a.recipient ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(a.sent_at)}</Td>
                  <Td className="text-xs text-red-700">{a.error_message ?? ""}</Td>
                </tr>
              ))}
          </Table>
        </Card>
      </div>
    </>
  );
}

function toneFor(type: string): TimelineItem["tone"] {
  if (["purchase", "payment_confirmed", "cart_recovered", "order_delivered", "customer_created"].includes(type)) return "green";
  if (["checkout_abandoned", "payment_refused"].includes(type)) return "yellow";
  if (["refund"].includes(type)) return "red";
  if (type.startsWith("email_") || type.startsWith("whatsapp_") || type.startsWith("tracking") || type === "order_shipped") return "blue";
  return "gray";
}

function dot(tone: TimelineItem["tone"]): string {
  return { green: "bg-green-500", yellow: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500", gray: "bg-black/30" }[tone];
}

function eventDetail(type: string, m: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof m.product_summary === "string") parts.push(m.product_summary);
  if (typeof m.total === "number") parts.push(fmtMoney(m.total));
  if (typeof m.subject === "string") parts.push(`"${m.subject}"`);
  if (typeof m.code === "string") parts.push(`código ${m.code}`);
  if (typeof m.channel === "string" && type === "manual_contact") parts.push(`via ${m.channel}`);
  if (typeof m.note === "string" && m.note) parts.push(m.note);
  if (typeof m.source === "string") parts.push(`origem: ${m.source}`);
  if (typeof m.external_order_id === "string") parts.push(`pedido #${m.external_order_id}`);
  return parts.length ? parts.join(" · ") : undefined;
}
