import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_PHONE_COUNTRY, STORE_ID } from "./config";
import type { Lang } from "./templates";
import type { Customer, Order } from "./types";

/**
 * País do cliente (ISO-2), usado para escolher o idioma da mensagem de recuperação.
 * Ordem de confiança: endereço de entrega do último pedido → DDI do telefone → domínio do e-mail → país padrão da loja.
 */
const PHONE_PREFIX: [string, string][] = [
  ["+33", "FR"],
  ["+44", "GB"],
  ["+49", "DE"],
  ["+32", "BE"],
  ["+41", "CH"],
  ["+352", "LU"],
  ["+377", "MC"],
  ["+351", "PT"],
  ["+34", "ES"],
  ["+39", "IT"],
  ["+353", "IE"],
  ["+43", "AT"],
  ["+31", "NL"],
  ["+55", "BR"],
  ["+1", "US"],
];

const EMAIL_TLD: Record<string, string> = { fr: "FR", uk: "GB", de: "DE", be: "BE", ch: "CH", lu: "LU", pt: "PT", es: "ES", it: "IT", ie: "IE", at: "AT", nl: "NL", br: "BR" };

const COUNTRY_NAMES: Record<string, string> = {
  france: "FR",
  fr: "FR",
  fra: "FR",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  gbr: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "royaume-uni": "GB",
  germany: "DE",
  deutschland: "DE",
  allemagne: "DE",
  de: "DE",
  deu: "DE",
  belgium: "BE",
  belgique: "BE",
  be: "BE",
  switzerland: "CH",
  suisse: "CH",
  ch: "CH",
  luxembourg: "LU",
  lu: "LU",
  monaco: "MC",
  mc: "MC",
};

export function normalizeCountry(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (COUNTRY_NAMES[s]) return COUNTRY_NAMES[s];
  if (/^[a-z]{2}$/.test(s)) return s.toUpperCase();
  return null;
}

export function countryFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const p = phone.replace(/[\s-]/g, "");
  for (const [prefix, cc] of PHONE_PREFIX) if (p.startsWith(prefix)) return cc;
  return null;
}

export function countryFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const m = email.toLowerCase().match(/\.([a-z]{2})$/);
  if (!m) return null;
  return EMAIL_TLD[m[1]] ?? null;
}

export function countryFromOrders(orders: Pick<Order, "shipping_address" | "created_at">[]): string | null {
  const sorted = orders.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const o of sorted) {
    const c = normalizeCountry(o.shipping_address?.country ?? null);
    if (c) return c;
  }
  return null;
}

/** Decide o país sem acesso ao banco (quando os pedidos já foram carregados). */
export function resolveCountry(customer: Pick<Customer, "phone" | "whatsapp" | "email">, orders: Pick<Order, "shipping_address" | "created_at">[] = []): string {
  return countryFromOrders(orders) ?? countryFromPhone(customer.phone ?? customer.whatsapp) ?? countryFromEmail(customer.email) ?? DEFAULT_PHONE_COUNTRY;
}

/** Decide o país consultando os pedidos do cliente nesta loja. */
export async function detectCustomerCountry(customer: Customer): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("orders").select("shipping_address,created_at").eq("store_id", STORE_ID).eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(5);
  return resolveCountry(customer, (data ?? []) as Pick<Order, "shipping_address" | "created_at">[]);
}

/** Idioma da mensagem a partir do país: França → francês, Reino Unido/Irlanda → inglês, Alemanha/Áustria/Suíça → alemão, Brasil/Portugal → português. */
export function langForCountry(country: string | null, fallback: Lang): Lang {
  switch ((country ?? "").toUpperCase()) {
    case "FR":
    case "BE":
    case "LU":
    case "MC":
      return "fr";
    case "GB":
    case "IE":
    case "US":
      return "en";
    case "DE":
    case "AT":
      return "de";
    case "BR":
    case "PT":
      return "pt";
    default:
      return fallback;
  }
}
