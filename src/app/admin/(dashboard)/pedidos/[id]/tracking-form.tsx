"use client";
import { useActionState } from "react";
import { addTrackingAction, type ActionResult } from "../../../actions";

const CARRIERS = ["Royal Mail", "Parcelforce", "Evri", "DPD", "Yodel", "DHL", "UPS", "FedEx", "GLS", "Correios", "Outra"];

export default function TrackingForm({ orderId, code, carrier, url, estimated }: { orderId: string; code: string | null; carrier: string | null; url: string | null; estimated: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addTrackingAction, null);
  return (
    <form action={action} className="grid gap-3 text-sm">
      <input type="hidden" name="order_id" value={orderId} />
      <label className="font-semibold">
        Código de rastreio
        <input name="code" required defaultValue={code ?? ""} placeholder="Ex.: 6A12345678901" className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-mono font-normal outline-none focus:border-black" />
      </label>
      <label className="font-semibold">
        Transportadora
        <input name="carrier" list="carriers" defaultValue={carrier ?? ""} placeholder="Ex.: Royal Mail" className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal outline-none focus:border-black" />
        <datalist id="carriers">
          {CARRIERS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="font-semibold">
        URL de rastreamento
        <input name="url" type="url" defaultValue={url ?? ""} placeholder="https://www.royalmail.com/track-your-item…" className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal outline-none focus:border-black" />
      </label>
      <label className="font-semibold">
        Previsão de entrega (opcional)
        <input name="estimated_delivery_at" type="date" defaultValue={estimated ? estimated.slice(0, 10) : ""} className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal outline-none focus:border-black" />
      </label>
      <button type="submit" disabled={pending} className="btn-gradient rounded-full py-2.5 font-bold text-white disabled:opacity-60">
        {pending ? "Salvando…" : code ? "ATUALIZAR RASTREIO" : "SALVAR E NOTIFICAR CLIENTE"}
      </button>
      {state && <p className={`whitespace-pre-line text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}
