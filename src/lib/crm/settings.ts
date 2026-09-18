import "server-only";
import { getSupabaseAdmin } from "./supabase";
import {
  ABANDONED_CART_TIMEOUT_MINUTES,
  AUTOMATION_DEDUPE_HOURS,
  CART_EXPIRE_DAYS,
  PROMOTION_ACTIVE,
  PROMOTION_END_AT,
  PROMOTION_MESSAGE,
  PROMOTION_START_AT,
  STORE_CURRENCY,
  STORE_ID,
  STORE_LOCALE,
  STORE_NAME,
} from "./config";
import { SITE_HOST } from "@/lib/site";
import type { StoreSettings } from "./types";
import { getPromotionState, type PromotionState } from "./promotion";

let storeEnsured = false;

/** Garante que a loja existe na tabela `stores` (dado real desta loja, não fictício). */
export async function ensureStore(): Promise<void> {
  if (storeEnsured) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("stores")
    .upsert({ id: STORE_ID, name: STORE_NAME, domain: SITE_HOST, currency: STORE_CURRENCY, locale: STORE_LOCALE }, { onConflict: "id" });
  if (error) throw new Error(`ensureStore: ${error.message}`);
  storeEnsured = true;
}

export function defaultSettings(): StoreSettings {
  return {
    store_id: STORE_ID,
    abandoned_cart_timeout_minutes: ABANDONED_CART_TIMEOUT_MINUTES,
    cart_expire_days: CART_EXPIRE_DAYS,
    automation_dedupe_hours: AUTOMATION_DEDUPE_HOURS,
    promotion_active: PROMOTION_ACTIVE,
    promotion_start_at: PROMOTION_START_AT,
    promotion_end_at: PROMOTION_END_AT,
    promotion_message: PROMOTION_MESSAGE,
  };
}

/** Configurações da loja: linha em `store_settings` (dashboard) com fallback para as env vars. */
export async function getStoreSettings(): Promise<StoreSettings> {
  await ensureStore();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("store_settings").select("*").eq("store_id", STORE_ID).maybeSingle();
  if (error) throw new Error(`getStoreSettings: ${error.message}`);
  if (!data) return defaultSettings();
  return data as StoreSettings;
}

export async function saveStoreSettings(patch: Partial<Omit<StoreSettings, "store_id">>): Promise<StoreSettings> {
  await ensureStore();
  const sb = getSupabaseAdmin();
  const current = await getStoreSettings();
  const next = { ...current, ...patch, store_id: STORE_ID };
  const { data, error } = await sb.from("store_settings").upsert(next, { onConflict: "store_id" }).select("*").single();
  if (error) throw new Error(`saveStoreSettings: ${error.message}`);
  return data as StoreSettings;
}

export async function getPromotion(): Promise<PromotionState> {
  const s = await getStoreSettings();
  return getPromotionState(s);
}
