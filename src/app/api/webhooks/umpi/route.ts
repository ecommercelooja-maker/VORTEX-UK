import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { runMaintenanceIfDue } from "@/lib/crm/maintenance";
import { timingSafeEqual } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { handleUmpiWebhook } from "@/lib/crm/webhook";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Webhook do Umpi Checkout. Os webhooks do Umpi não têm assinatura, então a URL cadastrada
 * no painel do Umpi deve conter o segredo:  https://SEU-DOMINIO/api/webhooks/umpi?token=WEBHOOK_SECRET
 * (também aceito no header `x-webhook-token`). Sem token válido: 401.
 */
function tokenOk(req: NextRequest): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const given = req.nextUrl.searchParams.get("token") || req.headers.get("x-webhook-token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "crm_not_configured" }, { status: 503 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  try {
    const outcome = await handleUmpiWebhook(payload);
    after(() => runMaintenanceIfDue("webhook"));
    // 200 mesmo em "ignored"/"error": o payload já está salvo em webhook_events para análise;
    // devolver 5xx faria o Umpi reenviar o mesmo evento indefinidamente.
    return NextResponse.json({ ok: outcome.status !== "error", ...outcome });
  } catch (e) {
    console.error("[crm] umpi webhook", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // verificação rápida de configuração (sem expor segredos)
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, provider: "umpi", supabase: isSupabaseConfigured() });
}
