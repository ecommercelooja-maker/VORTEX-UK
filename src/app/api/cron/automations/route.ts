import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "../_auth";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { processPendingAutomations } from "@/lib/crm/automations";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cron: envia automações pendentes (e-mail/WhatsApp) que ainda não foram processadas. */
async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "crm_not_configured" }, { status: 503 });
  try {
    const result = await processPendingAutomations();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[crm] cron automations", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
