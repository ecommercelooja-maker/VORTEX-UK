"use client";
import { useActionState } from "react";
import { saveSettingsAction, type ActionResult } from "../../actions";
import type { StoreSettings } from "@/lib/crm/types";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSettingsAction, null);
  const field = "mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal outline-none focus:border-black";
  return (
    <form action={action} className="grid gap-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="font-semibold">
          Timeout de abandono (min)
          <input name="abandoned_cart_timeout_minutes" type="number" min={5} max={10080} defaultValue={settings.abandoned_cart_timeout_minutes} className={field} />
        </label>
        <label className="font-semibold">
          Janela anti-duplicidade (h)
          <input name="automation_dedupe_hours" type="number" min={1} max={720} defaultValue={settings.automation_dedupe_hours} className={field} />
        </label>
        <label className="font-semibold">
          Expirar carrinhos após (dias)
          <input name="cart_expire_days" type="number" min={1} max={365} defaultValue={settings.cart_expire_days} className={field} />
        </label>
      </div>
      <fieldset className="rounded-xl border border-black/10 p-4">
        <legend className="px-1 font-heading text-xl">Promoção</legend>
        <label className="flex items-center gap-2 font-semibold">
          <input name="promotion_active" type="checkbox" defaultChecked={settings.promotion_active} className="h-4 w-4" />
          Promoção ativa
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="font-semibold">
            Início
            <input name="promotion_start_at" type="datetime-local" defaultValue={toLocalInput(settings.promotion_start_at)} className={field} />
          </label>
          <label className="font-semibold">
            Fim
            <input name="promotion_end_at" type="datetime-local" defaultValue={toLocalInput(settings.promotion_end_at)} className={field} />
          </label>
        </div>
        <label className="mt-3 block font-semibold">
          Mensagem da promoção (aparece nos e-mails de recuperação)
          <input name="promotion_message" defaultValue={settings.promotion_message ?? ""} placeholder="Ex.: Save 51% on the VORTEX Z10, free express delivery" className={field} />
        </label>
        <p className="mt-2 text-xs text-black/50">&quot;Último dia&quot; nunca é fixo: a urgência só entra nas mensagens quando a data de fim cai no dia de hoje.</p>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-gradient rounded-full px-6 py-2.5 font-bold text-white disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state && <span className={`text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.ok ? state.message : state.error}</span>}
      </div>
    </form>
  );
}
