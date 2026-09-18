import Link from "next/link";
import { PAGE_SIZE, customersDirectory, type CustomerFilter, type CustomerSort } from "../../queries";
import { PageTitle, Pagination, fmtMoney } from "../../ui";
import CustomersTable from "./customers-table";

export const dynamic = "force-dynamic";

const FILTERS: { value: CustomerFilter; label: string; hint: string }[] = [
  { value: "todos", label: "Todos", hint: "" },
  { value: "compradores", label: "Compradores", hint: "ao menos 1 pedido pago" },
  { value: "vip", label: "VIP", hint: "2 ou mais pedidos pagos" },
  { value: "carrinho", label: "Carrinho aberto", hint: "abandonaram um carrinho e ainda não compraram" },
  { value: "recusados", label: "Pagamento recusado", hint: "tentaram pagar e o gateway recusou — vale um contato" },
  { value: "leads", label: "Só cadastro", hint: "sem pedido e sem carrinho" },
  { value: "telefone", label: "Com telefone", hint: "dá para chamar no WhatsApp" },
  { value: "novos", label: "Novos 7 dias", hint: "cadastrados na última semana" },
];
const SORTS: { value: CustomerSort; label: string }[] = [
  { value: "atividade", label: "Mais ativos" },
  { value: "gasto", label: "Maior gasto" },
  { value: "pedidos", label: "Mais pedidos" },
  { value: "cadastro", label: "Mais recentes" },
];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; o?: string; page?: string }> }) {
  const { f = "todos", q = "", o = "atividade", page: p = "1" } = await searchParams;
  const filter = (FILTERS.some((x) => x.value === f) ? f : "todos") as CustomerFilter;
  const sort = (SORTS.some((x) => x.value === o) ? o : "atividade") as CustomerSort;
  const page = Math.max(1, Number.parseInt(p, 10) || 1);
  const { rows, count, stats } = await customersDirectory(filter, q, sort, page);
  const current = FILTERS.find((x) => x.value === filter)!;

  const link = (opts: { f?: CustomerFilter; o?: CustomerSort; q?: string }) => {
    const params = new URLSearchParams();
    const ff = opts.f ?? filter;
    const oo = opts.o ?? sort;
    const qq = opts.q ?? q;
    if (ff !== "todos") params.set("f", ff);
    if (oo !== "atividade") params.set("o", oo);
    if (qq) params.set("q", qq);
    const qs = params.toString();
    return `/admin/clientes${qs ? "?" + qs : ""}`;
  };
  const conv = stats.total ? Math.round((stats.buyers / stats.total) * 100) : 0;

  return (
    <>
      <PageTitle title="Clientes" subtitle="Quem comprou, quem deixou carrinho, quem teve pagamento recusado — e o que fazer com cada um." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Clientes" value={stats.total} sub={`${stats.newLast7d} novo(s) em 7 dias · ${stats.emailOptIn} com opt-in de e-mail`} />
        <Link href={link({ f: "compradores" })} className="block">
          <Tile label="Compradores" value={stats.buyers} sub={`${conv}% dos cadastros · ${stats.vip} VIP`} tone="text-green-700" />
        </Link>
        <Tile label="Receita por cliente" value={fmtMoney(stats.revenue)} sub={`ticket médio ${fmtMoney(stats.avgTicket)}`} />
        <Link href={link({ f: "carrinho" })} className="block">
          <Tile label="Carrinho aberto" value={stats.openCarts} sub={`${fmtMoney(stats.openCartsValue)} para recuperar`} tone={stats.openCarts ? "text-amber-700" : ""} highlight={stats.openCarts > 0} />
        </Link>
        <Link href={link({ f: "recusados" })} className="block">
          <Tile label="Pagamento recusado" value={stats.refusedToRecover} sub={stats.refusedToRecover ? "sem compra depois — vale contato" : "ninguém pendente"} tone={stats.refusedToRecover ? "text-red-700" : ""} />
        </Link>
      </div>

      <div className="mb-1 flex flex-wrap gap-1.5">
        {FILTERS.map((x) => {
          const active = x.value === filter;
          return (
            <Link key={x.value} href={link({ f: x.value })} title={x.hint} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}>
              {x.label}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-black/5 text-black/60"}`}>{stats.counts[x.value]}</span>
            </Link>
          );
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-black/50">
          {count} cliente(s){current.hint ? ` · ${current.hint}` : ""}
          {q ? ` · busca por "${q}"` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-black/40">Ordenar</span>
          {SORTS.map((x) => (
            <Link key={x.value} href={link({ o: x.value })} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${x.value === sort ? "bg-black/80 text-white" : "border border-black/10 text-black/60 hover:bg-surface"}`}>
              {x.label}
            </Link>
          ))}
          <form className="ml-2 flex gap-1.5">
            {filter !== "todos" && <input type="hidden" name="f" value={filter} />}
            {sort !== "atividade" && <input type="hidden" name="o" value={sort} />}
            <input name="q" defaultValue={q} placeholder="Nome, e-mail ou telefone" className="w-56 max-w-full rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-xs outline-none focus:border-black" />
            <button type="submit" className="rounded-full bg-black px-3.5 py-1.5 text-xs font-semibold text-white">
              Buscar
            </button>
            {q && (
              <Link href={link({ q: "" })} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
                Limpar
              </Link>
            )}
          </form>
        </div>
      </div>

      <CustomersTable rows={rows} nowIso={new Date().toISOString()} />
      <Pagination base="/admin/clientes" page={page} count={count} pageSize={PAGE_SIZE} extra={link({}).split("?")[1] ?? ""} />
    </>
  );
}

function Tile({ label, value, sub, tone = "", highlight = false }: { label: string; value: string | number; sub?: string; tone?: string; highlight?: boolean }) {
  return (
    <div className={`h-full rounded-2xl border bg-white px-4 py-3 transition-colors ${highlight ? "border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]" : "border-black/10"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-black/50">{sub}</div>}
    </div>
  );
}
