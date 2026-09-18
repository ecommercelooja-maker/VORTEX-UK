import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service_role key — SOMENTE no servidor (route handlers,
 * server components, server actions). Nunca importar em componentes "use client".
 * RLS está ligado em todas as tabelas e não há policies para anon: só este cliente lê/escreve.
 */
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const RETRY_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [400, 1200, 2500];

/**
 * fetch com retentativa para erros transitórios do gateway do Supabase ("Gateway Timeout",
 * 502/503, queda de conexão). O plano Free às vezes demora a responder; sem isto o dashboard
 * mostrava "getStoreSettings: Gateway Timeout" e o webhook do Umpi ficava processado pela metade.
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      const res = await fetch(input, init);
      if (!RETRY_STATUS.has(res.status) || attempt === RETRY_DELAYS_MS.length) return res;
      lastError = new Error(`Supabase ${res.status}`);
      await res.text().catch(() => undefined);
    } catch (e) {
      lastError = e;
      if (attempt === RETRY_DELAYS_MS.length) throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "vortex-crm" }, fetch: fetchWithRetry },
  });
  return client;
}

/** Lança um erro legível quando a query do Supabase falha. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  if (res.data == null) throw new Error(`${ctx}: sem dados`);
  return res.data;
}
