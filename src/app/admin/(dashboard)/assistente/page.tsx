import Link from "next/link";
import { customerDetail } from "../../queries";
import { Card, Notice, PageTitle, fmtDate, fmtMoney } from "../../ui";
import { AI_MODEL, isAiConfigured } from "@/lib/crm/ai";
import { STORE_LOCALE } from "@/lib/crm/config";
import { langFromLocale } from "@/lib/crm/templates";
import Assistant from "./assistant";

export const dynamic = "force-dynamic";
/** As respostas do modelo podem levar mais de 10 s: dá folga às server actions desta página. */
export const maxDuration = 60;

const LANG_LABEL: Record<string, string> = { fr: "francês", pt: "português", en: "inglês", de: "alemão" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const detail = cliente ? await customerDetail(cliente) : null;
  const lang = LANG_LABEL[langFromLocale(STORE_LOCALE)] ?? STORE_LOCALE;

  return (
    <>
      <PageTitle
        title="Assistente I.A."
        subtitle={`Descreva em português o que você quer dizer ao cliente; a assistente redige o e-mail em ${lang} com os dados reais do pedido. Nada é enviado sem o seu clique em "Enviar".`}
        actions={
          <Link href="/admin/mensagens" className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
            Ver mensagens enviadas
          </Link>
        }
      />

      {!isAiConfigured() && (
        <div className="mb-4">
          <Notice tone="warn">
            A assistente ainda não está ativa: defina a variável <code>ANTHROPIC_API_KEY</code> (chave da Anthropic) na Vercel → Settings → Environment Variables (Production) e faça
            redeploy. Modelo padrão: <code>{AI_MODEL}</code>.
          </Notice>
        </div>
      )}

      {cliente && !detail && (
        <div className="mb-4">
          <Notice tone="error">Cliente não encontrado.</Notice>
        </div>
      )}

      <Assistant
        configured={isAiConfigured()}
        customer={
          detail
            ? {
                id: detail.customer.id,
                name: detail.customer.name,
                email: detail.customer.email,
                orders: detail.orders.length,
                lastOrder: detail.orders[0]
                  ? `#${detail.orders[0].external_order_id} · ${fmtMoney(detail.orders[0].total, detail.orders[0].currency)} · ${detail.orders[0].status}${detail.orders[0].tracking_code ? ` · rastreio ${detail.orders[0].tracking_code}` : ""}`
                  : null,
                abandonedCarts: detail.carts.filter((c) => c.status === "abandoned").length,
                lastActivity: fmtDate(detail.customer.last_activity_at),
              }
            : null
        }
      />

      {detail && (
        <div className="mt-6">
          <Card title="Contexto que a assistente enxerga">
            <p className="text-sm text-black/60">
              Pedidos, carrinhos, rastreio, mensagens já enviadas e eventos deste cliente. Para ver tudo, abra a{" "}
              <Link href={`/admin/clientes/${detail.customer.id}`} className="underline">
                ficha do cliente
              </Link>
              .
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
