import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { STORE_ID } from "./config";
import type { CustomerEventType } from "./types";

export interface LogEventInput {
  event_type: CustomerEventType;
  customer_id?: string | null;
  cart_id?: string | null;
  order_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
}

/** Registra um evento na timeline do cliente (customer_events). Nunca lança: falha de log não pode quebrar o fluxo. */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("customer_events").insert({
      store_id: STORE_ID,
      event_type: input.event_type,
      customer_id: input.customer_id ?? null,
      cart_id: input.cart_id ?? null,
      order_id: input.order_id ?? null,
      session_id: input.session_id ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[crm] logEvent", input.event_type, error.message);
  } catch (e) {
    console.error("[crm] logEvent", input.event_type, e);
  }
}
