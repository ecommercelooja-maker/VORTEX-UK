"use client";
import { useState, useTransition } from "react";
import { updateOrderStatusAction, updateTrackingStatusAction, type ActionResult } from "../../../actions";

const ORDER = [
  ["pending", "Pendente"],
  ["paid", "Pago"],
  ["processing", "Em preparação"],
  ["shipped", "Enviado"],
  ["delivered", "Entregue"],
  ["cancelled", "Cancelado"],
  ["refunded", "Reembolsado"],
];
const TRACKING = [
  ["", "—"],
  ["label_created", "Etiqueta criada"],
  ["shipped", "Enviado"],
  ["in_transit", "Em trânsito"],
  ["out_for_delivery", "Saiu para entrega"],
  ["delivered", "Entregue"],
  ["exception", "Ocorrência"],
];

export default function StatusControls({ orderId, status, trackingStatus }: { orderId: string; status: string; trackingStatus: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="font-semibold">
        Status do pedido
        <select
          defaultValue={status}
          disabled={pending}
          onChange={(e) => start(async () => setMsg(await updateOrderStatusAction(orderId, e.target.value)))}
          className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal"
        >
          {ORDER.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="font-semibold">
        Status do rastreio
        <select
          defaultValue={trackingStatus ?? ""}
          disabled={pending}
          onChange={(e) => e.target.value && start(async () => setMsg(await updateTrackingStatusAction(orderId, e.target.value)))}
          className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 font-normal"
        >
          {TRACKING.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {msg && <p className={`text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.ok ? msg.message : msg.error}</p>}
      <p className="text-[11px] text-black/50">Preparado para APIs de rastreamento: hoje a atualização é manual; nenhuma integração fictícia foi criada.</p>
    </div>
  );
}
