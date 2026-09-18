import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/crm/auth";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { liveSnapshot } from "@/lib/crm/live-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polling da aba "Vendas" do dashboard: devolve os últimos pedidos e o resumo do dia.
 * Protegido pelo mesmo cookie de sessão do /admin (nunca expõe chaves do Supabase).
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "crm_not_configured" }, { status: 503 });
  try {
    const snapshot = await liveSnapshot();
    return NextResponse.json({ ok: true, ...snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[crm] live-orders", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
