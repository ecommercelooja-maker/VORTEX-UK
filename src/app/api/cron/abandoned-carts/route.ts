import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "../_auth";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { processAbandonedCarts } from "@/lib/crm/carts";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cron: identifica carrinhos abandonados (após o timeout) e agenda/envia as recuperações. */
async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "crm_not_configured" }, { status: 503 });
  try {
    const result = await processAbandonedCarts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[crm] cron abandoned-carts", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
