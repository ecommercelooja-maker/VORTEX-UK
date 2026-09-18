import Link from "next/link";
import { PAGE_SIZE, cartStats, listCarts, type CartFilter } from "../../queries";
import { PageTitle, Pagination, fmtMoney } from "../../ui";
import ActionButton from "../../action-button";
import { runCartsNowAction } from "../../actions";
import CartsTable, { type CartRowView } from "./carts-table";
import { templateContext } from "@/lib/crm/automations";
import { abandonedCartWhatsApp, type TemplateContext } from "@/lib/crm/templates";
import { langForCountry, resolveCountry } from "@/lib/crm/country";
import { getStoreSettings } from "@/lib/crm/settings";
import { getPromotionState } from "@/lib/crm/promotion";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const FILTERS: { value: CartFilter; label: string; hint: string }[] = [
  { value: "com_contato", label: "Com contato", hint: "abandonados com e-mail ou telefone — os que dá para recuperar" },
  { value: "novos", label: "Sem nenhuma ação", hint: "abandonados que ainda não receberam mensagem nem contato" },
  { value: "automacao", label: "Já contatados", hint: "receberam ao menos uma mensagem automática" },
  { value: "nao_recuperados", label: "Todos abandonados", hint: "inclui anônimos" },
  { value: "recuperados", label: "Recuperados", hint: "viraram pedido pago" },
  { value: "ativos", label: "Ativos", hint: "ainda dentro do timeout" },
  { value: "expirados", label: "Expirados", hint: "" },
  { value: "todos", label: "Tudo", hint: "" },
];

export default async function CartsPage({ searchParams }: { searchParams: Promise<{ f?: string; page?: string }> }) {
  const { f = "com_contato", page: p = "1" } = await searchParams;
  const filter = (FILTERS.some((x) => x.value === f) ? f : "com_contato") as CartFilter;
  const page = Math.max(1, Number.parseInt(p, 10) || 1);
  const [{ rows, count }, stats, settings] = await Promise.all([listCarts(filter, page), cartStats(), getStoreSettings()]);
  const promotion = getPromotionState(settings);

  // Texto de WhatsApp pronto (idioma pelo país do cliente) para o botão wa.me
  const view: CartRowView[] = rows.map((r) => {
    const country = r.contact_email || r.contact_phone ? resolveCountry({ phone: r.contact_phone, whatsapp: r.contact_phone, email: r.contact_email }) : null;
    const ctx: TemplateContext = { ...templateContext, lang: langForCountry(country, templateContext.lang) };
    const wa_text = r.contact_phone
      ? abandonedCartWhatsApp(ctx, { customerName: r.contact_name, items: r.items ?? [], total: Number(r.total) || 0, checkoutUrl: r.checkout_url || `${SITE_URL}/`, promotion })
      : null;
    return { ...r, wa_text, country };
  });
  const current = FILTERS.find((x) => x.value === filter)!;

  return (
    <>
      <PageTitle
        title="Carrinhos abandonados"
        subtitle="Selecione, envie o e-mail de recuperação com um clique, abra o WhatsApp com a mensagem pronta e marque o que já foi feito."
        actions={<ActionButton action={runCartsNowAction} label="Processar carrinhos agora" pendingLabel="Processando…" />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Em aberto" value={stats.open} sub={fmtMoney(stats.openValue)} />
        <Tile label="Com contato" value={stats.withContact} sub={`${fmtMoney(stats.withContactValue)} recuperáveis`} tone="text-blue-700" />
        <Tile label="Sem nenhuma ação" value={stats.noAction} sub="com contato e sem mensagem" tone={stats.noAction ? "text-amber-700" : ""} />
        <Tile label="Recuperados" value={stats.recovered7d} sub={`7 dias · ${stats.recovered30d} em 30 dias`} tone="text-green-700" />
        <Tile label="E-mails enviados" value={stats.emailsSent7d} sub="recuperação · 7 dias" />
      </div>

      <div className="mb-1 flex flex-wrap gap-1.5">
        {FILTERS.map((o) => {
          const active = o.value === filter;
          return (
            <Link key={o.value} href={o.value === "com_contato" ? "/admin/carrinhos" : `/admin/carrinhos?f=${o.value}`} title={o.hint} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}>
              {o.label}
            </Link>
          );
        })}
      </div>
      <p className="mb-3 text-xs text-black/50">
        {count} carrinho(s) · {current.hint || current.label}. Anônimos (sem e-mail nem telefone) não podem ser contatados: o Umpi só envia o e-mail quando o cliente preenche a primeira etapa.
      </p>

      <CartsTable rows={view} nowIso={new Date().toISOString()} />
      <Pagination base="/admin/carrinhos" page={page} count={count} pageSize={PAGE_SIZE} extra={`f=${filter}`} />
    </>
  );
}

function Tile({ label, value, sub, tone = "" }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-black/50">{sub}</div>}
    </div>
  );
}
