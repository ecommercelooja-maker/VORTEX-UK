import { getStoreSettings } from "@/lib/crm/settings";
import { getPromotionState } from "@/lib/crm/promotion";
import { STORE_CURRENCY, STORE_ID, STORE_LOCALE, STORE_NAME } from "@/lib/crm/config";
import { SITE_URL } from "@/lib/site";
import { Card, Notice, PageTitle, fmtDate } from "../../ui";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getStoreSettings();
  const promo = getPromotionState(settings);
  return (
    <>
      <PageTitle title="Configurações" subtitle="Regras de abandono, duplicidade e promoção desta loja (salvas no Supabase)." />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card title="Regras">
          <SettingsForm settings={settings} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Promoção agora">
            <Notice tone={promo.active ? (promo.isLastDay ? "warn" : "ok") : "error"}>
              {promo.active ? (promo.isLastDay ? "Ativa — ÚLTIMO DIA (as mensagens de recuperação incluem urgência)." : "Ativa — sem urgência nas mensagens (não é o último dia).") : "Inativa — as mensagens não mencionam promoção."}
              {promo.endsAt && <div className="mt-1 text-xs">Termina em {fmtDate(promo.endsAt.toISOString())} (Europe/London).</div>}
            </Notice>
          </Card>
          <Card title="Identidade da loja">
            <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
              <dt className="text-black/50">STORE_ID</dt>
              <dd className="font-mono">{STORE_ID}</dd>
              <dt className="text-black/50">Nome</dt>
              <dd>{STORE_NAME}</dd>
              <dt className="text-black/50">Locale / moeda</dt>
              <dd>
                {STORE_LOCALE} / {STORE_CURRENCY}
              </dd>
              <dt className="text-black/50">Site</dt>
              <dd className="break-all">{SITE_URL}</dd>
              <dt className="text-black/50">Webhook Umpi</dt>
              <dd className="break-all font-mono text-xs">{SITE_URL}/api/webhooks/umpi?token=&lt;WEBHOOK_SECRET&gt;</dd>
            </dl>
            <p className="mt-3 text-xs text-black/50">Definidos por variáveis de ambiente (Vercel → Settings → Environment Variables).</p>
          </Card>
        </div>
      </div>
    </>
  );
}
