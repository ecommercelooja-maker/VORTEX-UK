import Link from "next/link";
import { notFound } from "next/navigation";
import { messageDetail } from "../../../queries";
import { AUTOMATION_STATUS_LABEL, AUTOMATION_TYPE_LABEL, Badge, Card, Notice, PageTitle, StatusBadge, Table, Td, fmtDate, fmtMoney } from "../../../ui";
import ActionButton from "../../../action-button";
import { retryAutomationAction } from "../../../actions";
import { renderAutomationMessage } from "@/lib/crm/automations";
import { ChannelBadge, messagePreview } from "../ui";

export const dynamic = "force-dynamic";

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await messageDetail(id);
  if (!d) notFound();
  const { message: a, order, cart, history } = d;
  const isEmail = a.channel === "email";

  // Conteúdo: o que foi realmente enviado (metadata.body_*) ou, para registros antigos, reconstruído do template atual.
  let html = typeof a.metadata?.body_html === "string" ? a.metadata.body_html : null;
  let text = typeof a.metadata?.body_text === "string" ? a.metadata.body_text : typeof a.metadata?.text === "string" ? a.metadata.text : null;
  let subject = a.subject ?? (typeof a.metadata?.subject === "string" ? a.metadata.subject : null);
  let reconstructed = false;
  let renderError: string | null = null;
  if (!html && !text) {
    try {
      const msg = await renderAutomationMessage(a);
      if ("subject" in msg) {
        html = msg.html;
        subject = subject ?? msg.subject;
      }
      text = msg.text;
      reconstructed = true;
    } catch (e) {
      renderError = e instanceof Error ? e.message : String(e);
    }
  }
  const country = typeof a.metadata?.country === "string" ? a.metadata.country : null;
  const lang = typeof a.metadata?.lang === "string" ? a.metadata.lang : null;
  const title = subject ?? (text ? text.split("\n")[0].slice(0, 80) : "(sem assunto)");

  return (
    <>
      <PageTitle
        title={title}
        subtitle={`${AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type} · ${a.sent_at ? `enviada em ${fmtDate(a.sent_at)}` : `criada em ${fmtDate(a.created_at)}`}`}
        actions={
          <>
            <ChannelBadge channel={a.channel} />
            <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
            {a.status === "failed" && <ActionButton action={retryAutomationAction.bind(null, a.id)} label="Reprocessar" pendingLabel="…" />}
            <Link href="/admin/mensagens" className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
              ← Mensagens enviadas
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-4">
          <Card title="Detalhes">
            <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
              <dt className="text-black/50">Para</dt>
              <dd className="break-all">
                {a.customer_id ? (
                  <Link href={`/admin/clientes/${a.customer_id}`} className="font-semibold underline-offset-2 hover:underline">
                    {a.customer?.name ?? "cliente"}
                  </Link>
                ) : (
                  "—"
                )}
                <div className="text-xs text-black/60">{a.recipient ?? a.customer?.email ?? "—"}</div>
              </dd>
              <dt className="text-black/50">Canal</dt>
              <dd>
                <ChannelBadge channel={a.channel} />
              </dd>
              <dt className="text-black/50">Tipo</dt>
              <dd>
                {AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type} {a.metadata?.source === "ai_assistant" && <Badge tone="blue">redigida com I.A.</Badge>}
              </dd>
              {(country || lang) && (
                <>
                  <dt className="text-black/50">País / idioma</dt>
                  <dd>
                    {country ?? "—"} · {lang ?? "—"}
                  </dd>
                </>
              )}
              <dt className="text-black/50">Status</dt>
              <dd>
                <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
              </dd>
              <dt className="text-black/50">Criada</dt>
              <dd>{fmtDate(a.created_at)}</dd>
              <dt className="text-black/50">Enviada</dt>
              <dd>{fmtDate(a.sent_at)}</dd>
              <dt className="text-black/50">Tentativas</dt>
              <dd>{a.attempts}</dd>
              <dt className="text-black/50">Provedor</dt>
              <dd className="break-all text-xs">
                {a.provider ?? "—"}
                {a.provider_message_id && <div className="text-black/50">id {a.provider_message_id}</div>}
              </dd>
              {a.error_message && (
                <>
                  <dt className="text-black/50">Erro</dt>
                  <dd className="text-xs text-red-700">{a.error_message}</dd>
                </>
              )}
            </dl>
          </Card>
          {order && (
            <Card title="Pedido relacionado">
              <Link href={`/admin/pedidos/${order.id}`} className="font-semibold underline-offset-2 hover:underline">
                #{order.external_order_id}
              </Link>
              <div className="text-sm text-black/60">
                {fmtMoney(order.total, order.currency)} · {order.status}
                {order.tracking_code && ` · rastreio ${order.tracking_code}`}
              </div>
            </Card>
          )}
          {cart && (
            <Card title="Carrinho relacionado">
              <div className="text-sm">{cart.product_summary ?? "—"}</div>
              <div className="text-sm text-black/60">
                {fmtMoney(cart.total, cart.currency)} · {cart.status}
              </div>
            </Card>
          )}
          {a.customer_id && (
            <Link href={`/admin/assistente?cliente=${a.customer_id}`} className="rounded-full bg-black px-4 py-2 text-center text-xs font-semibold text-white hover:bg-black/80">
              ✦ Escrever nova mensagem com I.A.
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {reconstructed && (
            <Notice tone="warn">
              Esta mensagem foi enviada antes de o sistema guardar o conteúdo exato; a visualização abaixo foi reconstruída a partir do template atual com os dados do cliente.
            </Notice>
          )}
          {renderError && <Notice tone="error">Não foi possível reconstruir o conteúdo: {renderError}</Notice>}
          {isEmail && html && (
            <Card title="Como o cliente viu (e-mail)">
              <div className="overflow-hidden rounded-xl border border-black/10 bg-[#f3f3f3]">
                <iframe title="Pré-visualização do e-mail" srcDoc={html} sandbox="" className="h-[720px] w-full" />
              </div>
            </Card>
          )}
          {!isEmail && text && (
            <Card title={`Como o cliente viu (${a.channel === "whatsapp" ? "WhatsApp" : "SMS"})`}>
              <div className="rounded-2xl bg-[#e7ffdb] p-4 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">{text}</div>
            </Card>
          )}
          {isEmail && text && (
            <Card title="Versão em texto">
              <pre className="whitespace-pre-wrap rounded-xl bg-surface p-4 font-sans text-sm leading-relaxed">{text}</pre>
            </Card>
          )}
          {!html && !text && !renderError && <Notice tone="warn">Sem conteúdo registrado para esta mensagem (ainda não foi enviada).</Notice>}

          {history.length > 0 && (
            <Card title="Outras mensagens para este cliente">
              <Table head={["Quando", "Canal", "Tipo", "Mensagem", "Status"]}>
                {history.map((h) => (
                  <tr key={h.id}>
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/mensagens/${h.id}`} className="underline-offset-2 hover:underline">
                        {fmtDate(h.sent_at ?? h.created_at)}
                      </Link>
                    </Td>
                    <Td>
                      <ChannelBadge channel={h.channel} />
                    </Td>
                    <Td>{AUTOMATION_TYPE_LABEL[h.automation_type] ?? h.automation_type}</Td>
                    <Td className="max-w-[300px] truncate text-xs">{h.subject ?? messagePreview(h)}</Td>
                    <Td>
                      <StatusBadge map={AUTOMATION_STATUS_LABEL} value={h.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
