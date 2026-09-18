import Link from "next/link";
import { notFound } from "next/navigation";
import { orderDetail } from "../../../queries";
import { AUTOMATION_STATUS_LABEL, AUTOMATION_TYPE_LABEL, Badge, Card, EVENT_LABEL, ORDER_STATUS_LABEL, PageTitle, StatusBadge, TRACKING_STATUS_LABEL, Table, Td, fmtDate, fmtMoney } from "../../../ui";
import TrackingForm from "./tracking-form";
import StatusControls from "./status-controls";
import ActionButton from "../../../action-button";
import { resendTrackingAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await orderDetail(id);
  if (!d) notFound();
  const { order, customer, automations, events } = d;
  const addr = order.shipping_address;

  return (
    <>
      <PageTitle
        title={`Pedido #${order.external_order_id}`}
        subtitle={`Criado em ${fmtDate(order.created_at)} · ${order.provider}`}
        actions={
          <>
            <StatusBadge map={ORDER_STATUS_LABEL} value={order.status} />
            <Badge tone={order.payment_status === "paid" ? "green" : order.payment_status === "pending" ? "yellow" : "red"}>pagamento: {order.payment_status}</Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Cliente">
          {customer ? (
            <dl className="text-sm">
              <dd>
                <Link href={`/admin/clientes/${customer.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {customer.name ?? order.customer_name ?? "(sem nome)"}
                </Link>
              </dd>
              <dd className="break-all text-black/70">{customer.email ?? "—"}</dd>
              <dd className="text-black/70">{customer.phone ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-sm text-black/50">{order.customer_name ?? "Sem cliente vinculado"}</p>
          )}
          {addr && (
            <div className="mt-3 text-sm">
              <div className="text-xs font-semibold uppercase text-black/50">Endereço de entrega</div>
              <div>{[addr.street, addr.number].filter(Boolean).join(", ")}</div>
              {addr.complement && <div>{addr.complement}</div>}
              <div>{[addr.zip, addr.city, addr.state].filter(Boolean).join(" ")}</div>
              <div>{addr.country}</div>
            </div>
          )}
        </Card>

        <Card title="Itens">
          <ul className="flex flex-col gap-1.5 text-sm">
            {(order.items ?? []).map((i, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span>
                  {i.quantity}× {i.name}
                </span>
                <span>{fmtMoney(i.total, order.currency)}</span>
              </li>
            ))}
            {(order.items ?? []).length === 0 && <li className="text-black/50">Itens não informados pelo checkout.</li>}
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 border-t border-black/10 pt-3 text-sm">
            <dt className="text-black/50">Subtotal</dt>
            <dd className="text-right">{fmtMoney(order.subtotal, order.currency)}</dd>
            <dt className="text-black/50">Desconto</dt>
            <dd className="text-right">− {fmtMoney(order.discount, order.currency)}</dd>
            <dt className="text-black/50">Frete</dt>
            <dd className="text-right">{fmtMoney(order.shipping, order.currency)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{fmtMoney(order.total, order.currency)}</dd>
            <dt className="text-black/50">Pago em</dt>
            <dd className="text-right">{fmtDate(order.payment_confirmed_at)}</dd>
            <dt className="text-black/50">Método</dt>
            <dd className="text-right">{order.payment_method ?? "—"}</dd>
          </dl>
        </Card>

        <Card title="Status">
          <StatusControls orderId={order.id} status={order.status} trackingStatus={order.tracking_status} />
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-black/60">
            <dt>Enviado em</dt>
            <dd>{fmtDate(order.shipped_at)}</dd>
            <dt>Previsão de entrega</dt>
            <dd>{fmtDate(order.estimated_delivery_at, false)}</dd>
            <dt>Entregue em</dt>
            <dd>{fmtDate(order.delivered_at)}</dd>
            <dt>Status do rastreio</dt>
            <dd>{order.tracking_status ? TRACKING_STATUS_LABEL[order.tracking_status] : "—"}</dd>
            <dt>Atualizado em</dt>
            <dd>{fmtDate(order.tracking_status_updated_at)}</dd>
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={order.tracking_code ? "Rastreio" : "ADICIONAR RASTREIO"}>
          {order.tracking_code && (
            <div className="mb-4 rounded-xl bg-surface p-3 text-sm">
              <div>
                <span className="text-black/50">Código:</span> <span className="font-mono font-semibold">{order.tracking_code}</span>
              </div>
              <div>
                <span className="text-black/50">Transportadora:</span> {order.tracking_carrier ?? "—"}
              </div>
              <div className="break-all">
                <span className="text-black/50">URL:</span>{" "}
                {order.tracking_url ? (
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="underline">
                    {order.tracking_url}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div className="mt-1 text-xs text-black/60">
                Cadastrado em {fmtDate(order.tracking_added_at)} ·{" "}
                {order.tracking_notification_sent ? `enviado ao cliente em ${fmtDate(order.tracking_sent_at)}` : "ainda não enviado ao cliente"}
              </div>
              <div className="mt-2">
                <ActionButton action={resendTrackingAction.bind(null, order.id)} label="REENVIAR RASTREIO" pendingLabel="Reenviando…" confirm="Reenviar a notificação de rastreio para o cliente?" className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-60" />
              </div>
            </div>
          )}
          <TrackingForm orderId={order.id} code={order.tracking_code} carrier={order.tracking_carrier} url={order.tracking_url} estimated={order.estimated_delivery_at} />
          <p className="mt-3 text-xs text-black/50">
            Ao salvar pela primeira vez, o cliente recebe automaticamente o e-mail &quot;Seu pedido foi enviado&quot; (e WhatsApp, quando houver integração). Atualizar o código depois não reenvia; use REENVIAR RASTREIO.
          </p>
        </Card>

        <Card title="Comunicações deste pedido">
          <Table head={["Criada", "Tipo", "Canal", "Status", "Enviada", "Erro"]} empty="Nenhuma automação para este pedido.">
            {automations.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap">{fmtDate(a.created_at)}</Td>
                <Td>{AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type}</Td>
                <Td>{a.channel}</Td>
                <Td>
                  <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
                </Td>
                <Td className="whitespace-nowrap">{fmtDate(a.sent_at)}</Td>
                <Td className="text-xs text-red-700">{a.error_message ?? ""}</Td>
              </tr>
            ))}
          </Table>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-black/60">
            {events.map((e) => (
              <li key={e.id}>
                {fmtDate(e.created_at)} — {EVENT_LABEL[e.event_type] ?? e.event_type}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
