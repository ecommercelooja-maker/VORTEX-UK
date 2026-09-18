import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { runMaintenanceIfDue } from "@/lib/crm/maintenance";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { ensureStore } from "@/lib/crm/settings";
import { logEvent } from "@/lib/crm/events";
import { attachContactToSessionCart, upsertSiteCart } from "@/lib/crm/carts";
import { findOrCreateCustomer, touchCustomer } from "@/lib/crm/customers";
import { SITE_URL } from "@/lib/site";
import type { CartItem } from "@/lib/crm/types";

export const runtime = "nodejs";

/**
 * Endpoint público de tracking da loja (chamado pelo componente CrmTracker e pelo formulário
 * de newsletter). Usa a service_role no servidor; o navegador nunca vê chaves do Supabase.
 * Eventos aceitos: page_view, product_view, add_to_cart, checkout_started, contact_captured.
 */
const ALLOWED = new Set(["page_view", "product_view", "add_to_cart", "checkout_started", "contact_captured"]);

interface TrackBody {
  type?: string;
  session_id?: string;
  path?: string;
  items?: CartItem[];
  product_summary?: string;
  subtotal?: number;
  total?: number;
  checkout_url?: string;
  contact?: { name?: string; email?: string; phone?: string; marketing_email_opt_in?: boolean; marketing_whatsapp_opt_in?: boolean };
  metadata?: Record<string, unknown>;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // sendBeacon/keepalive sem origin em alguns navegadores
  try {
    const o = new URL(origin);
    if (o.hostname === "localhost" || o.hostname === "127.0.0.1") return true;
    const site = new URL(SITE_URL);
    return o.hostname === site.hostname || o.hostname === "www." + site.hostname || o.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function cleanItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .slice(0, 20)
    .map((i) => {
      const quantity = Math.max(1, Math.min(99, Number(i.quantity) || 1));
      const price = Math.max(0, Number(i.price) || 0);
      return { id: typeof i.id === "string" ? i.id.slice(0, 80) : null, name: String(i.name ?? "Produto").slice(0, 200), quantity, price, total: Math.round(price * quantity * 100) / 100, image: typeof i.image === "string" ? i.image.slice(0, 500) : null };
    });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, reason: "crm_disabled" }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });

  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const type = String(body.type ?? "");
  const session_id = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
  if (!ALLOWED.has(type) || !/^[A-Za-z0-9_-]{8,64}$/.test(session_id)) {
    return NextResponse.json({ ok: false, reason: "invalid_event" }, { status: 400 });
  }

  after(() => runMaintenanceIfDue("track"));
  try {
    await ensureStore();
    const metadata: Record<string, unknown> = { ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}), path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined, ua: req.headers.get("user-agent")?.slice(0, 200) };

    if (type === "contact_captured") {
      const c = body.contact ?? {};
      const customer = await findOrCreateCustomer({ ...c, session_id, source: String(metadata.source ?? "site") });
      if (!customer) return NextResponse.json({ ok: false, reason: "invalid_contact" }, { status: 400 });
      await logEvent({ event_type: "contact_captured", customer_id: customer.id, session_id, metadata });
      // vincula o carrinho ativo da sessão ao cliente, se existir (não cria carrinho vazio)
      await attachContactToSessionCart(session_id, customer).catch(() => null);
      return NextResponse.json({ ok: true });
    }

    if (type === "add_to_cart" || type === "checkout_started") {
      const items = cleanItems(body.items);
      const cart = await upsertSiteCart({
        session_id,
        items: items.length ? items : undefined,
        product_summary: typeof body.product_summary === "string" ? body.product_summary.slice(0, 300) : undefined,
        subtotal: typeof body.subtotal === "number" ? body.subtotal : undefined,
        total: typeof body.total === "number" ? body.total : undefined,
        checkout_url: typeof body.checkout_url === "string" ? body.checkout_url.slice(0, 500) : undefined,
        contact: body.contact ?? null,
      });
      if (cart.customer_id) await touchCustomer(cart.customer_id);
      await logEvent({ event_type: type, customer_id: cart.customer_id, cart_id: cart.id, session_id, metadata: { ...metadata, total: cart.total } });
      return NextResponse.json({ ok: true, cart_id: cart.id });
    }

    // page_view / product_view: anônimos (sem cliente) até que a sessão informe contato
    await logEvent({ event_type: type as "page_view" | "product_view", session_id, metadata });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[crm] track", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
