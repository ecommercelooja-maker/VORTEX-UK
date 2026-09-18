import Link from "next/link";
import { PAGE_SIZE, listAutomations } from "../../queries";
import { AUTOMATION_STATUS_LABEL, AUTOMATION_TYPE_LABEL, FilterTabs, PageTitle, Pagination, StatusBadge, Table, Td, fmtDate } from "../../ui";
import ActionButton from "../../action-button";
import { retryAutomationAction, runAutomationsNowAction } from "../../actions";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "sent", label: "Enviadas" },
  { value: "failed", label: "Falhas" },
  { value: "cancelled", label: "Canceladas" },
];

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ s?: string; page?: string }> }) {
  const { s = "todos", page: p = "1" } = await searchParams;
  const status = FILTERS.some((x) => x.value === s) ? s : "todos";
  const page = Math.max(1, Number.parseInt(p, 10) || 1);
  const { rows, count } = await listAutomations(status, page);

  return (
    <>
      <PageTitle title="Automações" subtitle="E-mails e mensagens gerados pelo sistema (recuperação, confirmação, rastreio)." actions={<ActionButton action={runAutomationsNowAction} label="Enviar pendentes agora" pendingLabel="Enviando…" />} />
      <FilterTabs base="/admin/automacoes" param="s" current={status} options={FILTERS} />
      <Table head={["Criada", "Tipo", "Canal", "Cliente", "Destinatário", "Status", "Enviada", "Erro / detalhe", "Ações"]}>
        {rows.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap">{fmtDate(a.created_at)}</Td>
            <Td>{AUTOMATION_TYPE_LABEL[a.automation_type] ?? a.automation_type}</Td>
            <Td>{a.channel}</Td>
            <Td>
              {a.customer_id ? (
                <Link href={`/admin/clientes/${a.customer_id}`} className="underline-offset-2 hover:underline">
                  {a.customer?.name ?? a.customer?.email ?? "cliente"}
                </Link>
              ) : (
                "—"
              )}
            </Td>
            <Td className="break-all">{a.recipient ?? "—"}</Td>
            <Td>
              <StatusBadge map={AUTOMATION_STATUS_LABEL} value={a.status} />
            </Td>
            <Td className="whitespace-nowrap">{fmtDate(a.sent_at)}</Td>
            <Td className="max-w-[260px] text-xs text-black/60">{a.error_message ?? a.subject ?? ""}</Td>
            <Td>{a.status === "failed" && <ActionButton action={retryAutomationAction.bind(null, a.id)} label="Reprocessar" pendingLabel="…" />}</Td>
          </tr>
        ))}
      </Table>
      <Pagination base="/admin/automacoes" page={page} count={count} pageSize={PAGE_SIZE} extra={`s=${status}`} />
    </>
  );
}
