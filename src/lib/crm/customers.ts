import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_PHONE_COUNTRY, STORE_ID } from "./config";
import { normalizeEmail, normalizeName, normalizePhone } from "./normalize";
import { logEvent } from "./events";
import type { Customer } from "./types";

export interface ContactInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  whatsapp?: unknown;
  /** só define opt-in quando true/false explícito; undefined não altera */
  marketing_email_opt_in?: boolean;
  marketing_whatsapp_opt_in?: boolean;
  marketing_sms_opt_in?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  source?: string;
  session_id?: string | null;
}

export interface NormalizedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
}

export function normalizeContact(input: ContactInput): NormalizedContact {
  const phone = normalizePhone(input.phone, DEFAULT_PHONE_COUNTRY);
  const whatsapp = normalizePhone(input.whatsapp, DEFAULT_PHONE_COUNTRY) ?? phone;
  return { name: normalizeName(input.name), email: normalizeEmail(input.email), phone: phone ?? whatsapp, whatsapp };
}

/**
 * Localiza um cliente existente por e-mail e/ou telefone (nesta loja) ou cria um novo.
 * Evita duplicidade: e-mail e telefone são únicos por loja (índices parciais no banco).
 * Nunca armazena senha, cartão ou dados financeiros.
 */
export async function findOrCreateCustomer(input: ContactInput): Promise<Customer | null> {
  const c = normalizeContact(input);
  if (!c.email && !c.phone) return null;
  const sb = getSupabaseAdmin();

  let existing: Customer | null = null;
  if (c.email) {
    const { data } = await sb.from("customers").select("*").eq("store_id", STORE_ID).eq("email", c.email).maybeSingle();
    existing = (data as Customer | null) ?? null;
  }
  if (!existing && c.phone) {
    const { data } = await sb.from("customers").select("*").eq("store_id", STORE_ID).eq("phone", c.phone).maybeSingle();
    existing = (data as Customer | null) ?? null;
  }

  const now = new Date().toISOString();
  if (existing) {
    const patch: Partial<Customer> = { last_activity_at: now };
    if (c.name && !existing.name) patch.name = c.name;
    if (c.email && !existing.email) patch.email = c.email;
    if (c.phone && !existing.phone) patch.phone = c.phone;
    if (c.whatsapp && !existing.whatsapp) patch.whatsapp = c.whatsapp;
    // consentimento: só muda quando informado explicitamente
    if (input.marketing_email_opt_in !== undefined) patch.marketing_email_opt_in = input.marketing_email_opt_in;
    if (input.marketing_whatsapp_opt_in !== undefined) patch.marketing_whatsapp_opt_in = input.marketing_whatsapp_opt_in;
    if (input.marketing_sms_opt_in !== undefined) patch.marketing_sms_opt_in = input.marketing_sms_opt_in;
    if (input.email_verified) patch.email_verified = true;
    if (input.phone_verified) patch.phone_verified = true;
    const { data, error } = await sb.from("customers").update(patch).eq("id", existing.id).select("*").single();
    if (error) {
      // conflito raro (e-mail/telefone já usados por outro cliente): mantém o registro existente
      console.error("[crm] customer update", error.message);
      return existing;
    }
    return data as Customer;
  }

  const { data, error } = await sb
    .from("customers")
    .insert({
      store_id: STORE_ID,
      name: c.name,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      marketing_email_opt_in: input.marketing_email_opt_in ?? false,
      marketing_whatsapp_opt_in: input.marketing_whatsapp_opt_in ?? false,
      marketing_sms_opt_in: input.marketing_sms_opt_in ?? false,
      email_verified: input.email_verified ?? false,
      phone_verified: input.phone_verified ?? false,
      last_activity_at: now,
    })
    .select("*")
    .single();
  if (error) {
    // corrida: outro processo criou o mesmo cliente entre o select e o insert
    if (error.code === "23505") return findOrCreateCustomer({ ...input, marketing_email_opt_in: undefined });
    throw new Error(`findOrCreateCustomer: ${error.message}`);
  }
  const created = data as Customer;
  await logEvent({
    event_type: "customer_created",
    customer_id: created.id,
    session_id: input.session_id ?? null,
    metadata: { source: input.source ?? "unknown" },
  });
  return created;
}

export async function touchCustomer(customerId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", customerId);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("customers").select("*").eq("id", id).eq("store_id", STORE_ID).maybeSingle();
  return (data as Customer | null) ?? null;
}
