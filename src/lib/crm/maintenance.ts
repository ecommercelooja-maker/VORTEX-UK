import "server-only";
import { isSupabaseConfigured } from "./supabase";
import { processAbandonedCarts } from "./carts";
import { processPendingAutomations } from "./automations";

/**
 * "Cron de bolso": além do cron da Vercel (que no plano Hobby roda só 1×/dia), o tráfego
 * normal da loja (page views e webhooks) dispara a manutenção no máximo a cada
 * MAINTENANCE_INTERVAL_MS por instância, depois que a resposta já foi enviada (after()).
 * Tudo que roda aqui é idempotente, então execuções extras não causam duplicidade.
 */
const MAINTENANCE_INTERVAL_MS = 10 * 60 * 1000;
let lastRun = 0;
let running = false;

export async function runMaintenanceIfDue(reason: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const now = Date.now();
  if (running || now - lastRun < MAINTENANCE_INTERVAL_MS) return;
  running = true;
  lastRun = now;
  try {
    const carts = await processAbandonedCarts();
    const autos = await processPendingAutomations();
    if (carts.abandoned || carts.automations || autos.processed) {
      console.log("[crm] maintenance", reason, { carts: { checked: carts.checked, abandoned: carts.abandoned, recovered: carts.recovered, automations: carts.automations }, autos });
    }
  } catch (e) {
    console.error("[crm] maintenance", reason, e);
  } finally {
    running = false;
  }
}
