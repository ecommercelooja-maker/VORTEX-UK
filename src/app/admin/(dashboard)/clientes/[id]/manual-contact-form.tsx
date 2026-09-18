"use client";
import { useActionState } from "react";
import { logManualContactAction, type ActionResult } from "../../../actions";

export default function ManualContactForm({ customerId, cartId, orderId }: { customerId: string; cartId?: string; orderId?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(logManualContactAction, null);
  return (
    <form action={action} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="customer_id" value={customerId} />
      {cartId && <input type="hidden" name="cart_id" value={cartId} />}
      {orderId && <input type="hidden" name="order_id" value={orderId} />}
      <select name="channel" className="rounded-xl border border-black/20 px-3 py-2">
        <option value="whatsapp">WhatsApp</option>
        <option value="phone">Telefone</option>
        <option value="email">E-mail</option>
        <option value="other">Outro</option>
      </select>
      <textarea name="note" rows={2} placeholder="Observação (opcional)" className="rounded-xl border border-black/20 px-3 py-2" />
      <button type="submit" disabled={pending} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando…" : "Registrar contato"}
      </button>
      {state && <p className={`text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}
