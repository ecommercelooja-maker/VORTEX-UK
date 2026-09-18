import Link from "next/link";
import { PAGE_SIZE, listOrders, orderStats, type OrderFilter } from "../../queries";
import { PageTitle, Pagination, fmtMoney } from "../../ui";
import OrdersTable, { type OrderRowView } from "./orders-table";
import { resolveCountry } from "@/lib/crm/country";

export const dynamic = "force-dynamic";

const FILTERS: { value: OrderFilter; label: string; hint: string }[] = [
  { value: "todos", label: "Todos", hint: "" },
  { value: "a_enviar", label: "A enviar", hint: "pagos ou em preparação, ainda sem código de rastreio" },
  { value: "paid", label: "Pagos", hint: "pagamento confirmado" },
  { value: "processing", label: "Em preparação", hint: "" },
  { value: "shipped", label: "Enviados", hint: "com rastreio, a caminho" },
  { value: "delivered", label: "Entregues", hint: "" },
  { value: "pending", label: "Aguardando pagamento", hint: "" },
  { value: "refused", label: "Recusados", hint: "pagamento recusado pelo gateway" },
  { value: "cancelled", label: "Cancelados", hint: "" },
  { value: "refunded", label: "Reembolsados", hint: "" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; page?: string }> }) {
  const { s = "todos", q = "", page: p = "1" } = await searchParams;
  const legacy = s === "sem_rastreio" ? "a_enviar" : s;
  const status = (FILTERS.some((x) => x.value === legacy) ? legacy : "todos") as OrderFilter;
  const page = Math.max(1, Number.parseInt(p, 10) || 1);
  const [{ rows, count }, stats] = await Promise.all([listOrders(status, q, page), orderStats()]);

  const view: OrderRowView[] = rows.map((o) => ({
    ...o,
    country: o.customer_email || o.customer_phone ? resolveCountry({ phone: o.customer_phone, whatsapp: null, email: o.customer_email }, [o]) : null,
  }));
  const current = FILTERS.find((x) => x.value === status)!;
  const link = (f: OrderFilter) => {
    const params = new URLSearchParams();
    if (f !== "todos") params.set("s", f);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/pedidos${qs ? "?" + qs : ""}`;
  };
  const avgShip = stats.avgHoursToShip == null ? null : stats.avgHoursToShip < 48 ? `${Math.round(stats.avgHoursToShip)} h` : `${(stats.avgHoursToShip / 24).toFixed(1)} d`;

  return (
    <>
      <PageTitle title="Pedidos e rastreio" subtitle="Cole vários códigos de uma vez, cadastre direto na linha e veja se o cliente foi avisado de verdade." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Link href={link("a_enviar")} className="block">
          <Tile label="A enviar" value={stats.counts.a_enviar} sub={`${fmtMoney(stats.toShipValue)} · pagos sem rastreio`} tone={stats.counts.a_enviar ? "text-amber-700" : "text-green-700"} highlight={stats.counts.a_enviar > 0} />
        </Link>
        <Tile label="Vendas 30 dias" value={fmtMoney(stats.paidRevenue30d)} sub={`${stats.paidCount30d} pedido(s) pago(s)`} />
        <Tile label="Hoje" value={stats.paidToday} sub={`pago(s) · ${stats.refusedToday} recusado(s)`} tone={stats.refusedToday > stats.paidToday ? "text-red-700" : "text-green-700"} />
        <Link href={link("shipped")} className="block">
          <Tile label="Em trânsito" value={stats.shippedAwaiting} sub={stats.notNotified ? `⚠ ${stats.notNotified} sem aviso ao cliente` : "clientes avisados"} tone={stats.notNotified ? "text-amber-700" : ""} />
        </Link>
        <Tile label="Entregues 30 dias" value={stats.delivered30d} sub={avgShip ? `pagamento → envio em média ${avgShip}` : "sem envios ainda"} tone="text-green-700" />
      </div>

      <div className="mb-1 flex flex-wrap gap-1.5">
        {FILTERS.map((o) => {
          const active = o.value === status;
          const n = stats.counts[o.value];
          return (
            <Link key={o.value} href={link(o.value)} title={o.hint} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-black text-white" : "border border-black/15 hover:bg-surface"}`}>
              {o.label}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-black/5 text-black/60"}`}>{n}</span>
            </Link>
          );
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-black/50">
          {count} pedido(s){current.hint ? ` · ${current.hint}` : ""}
          {q ? ` · busca por "${q}"` : ""}
        </p>
        <form className="flex gap-1.5">
          {status !== "todos" && <input type="hidden" name="s" value={status} />}
          <input name="q" defaultValue={q} placeholder="Nº do pedido, cliente, e-mail, telefone ou rastreio" className="w-72 max-w-full rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-xs outline-none focus:border-black" />
          <button type="submit" className="rounded-full bg-black px-3.5 py-1.5 text-xs font-semibold text-white">
            Buscar
          </button>
          {q && (
            <Link href={link(status)} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-surface">
              Limpar
            </Link>
          )}
        </form>
      </div>

      <OrdersTable rows={view} nowIso={new Date().toISOString()} />
      <Pagination base="/admin/pedidos" page={page} count={count} pageSize={PAGE_SIZE} extra={`s=${status}${q ? "&q=" + encodeURIComponent(q) : ""}`} />
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
