import { liveSnapshot } from "@/lib/crm/live-orders";
import { PageTitle } from "../../ui";
import LiveOrders from "./live-orders";

export const dynamic = "force-dynamic";

/** Aba "Ao vivo": vendas em tempo real (render inicial no servidor + polling no navegador). */
export default async function LiveOrdersPage() {
  const initial = await liveSnapshot();
  return (
    <>
      <PageTitle title="Vendas ao vivo" subtitle="Aprovações, recusas, taxa de aprovação e tendências — tudo atualiza sozinho, sem recarregar a página." />
      <LiveOrders initial={initial} />
    </>
  );
}
