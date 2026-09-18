"use client";
import { useEffect } from "react";
import { CHECKOUT_URL, product } from "@/data/product";

/*
 * Tracking de comportamento para o CRM (primeira parte, sem cookies de terceiros).
 * - page_view / product_view: SÓ com consentimento de analytics no banner de cookies (UK GDPR + PECR).
 * - add_to_cart / checkout_started: registrados ao clicar num botão de compra — necessários ao
 *   serviço (recuperação do basket), listados como "strictly necessary (basket)" na cookie policy.
 * O identificador de sessão fica no localStorage e nunca contém dados pessoais.
 * Nenhuma chave do Supabase chega ao navegador: tudo passa por /api/crm/track.
 */
const SESSION_KEY = "vortex-crm-session";
const CONSENT_KEY = "vortex-uk-consent";

export function getCrmSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "nostorage-" + Math.random().toString(36).slice(2, 14);
  }
}

function analyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? Boolean((JSON.parse(raw) as { analytics?: boolean }).analytics) : false;
  } catch {
    return false;
  }
}

export function crmTrack(payload: Record<string, unknown>, keepalive = false): void {
  try {
    const body = JSON.stringify({ session_id: getCrmSessionId(), path: location.pathname, ...payload });
    if (keepalive && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/crm/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/crm/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive });
  } catch {
    /* tracking nunca pode quebrar a página */
  }
}

function priceNumber(label: string): number {
  const n = Number.parseFloat(label.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function CrmTracker() {
  useEffect(() => {
    if (analyticsConsent()) {
      crmTrack({ type: "page_view" });
      if (location.pathname === "/") crmTrack({ type: "product_view", metadata: { product: product.title } });
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.getAttribute("href") !== CHECKOUT_URL) return;
      const qty = Math.max(1, Number.parseInt(a.dataset.qty || "1", 10) || 1);
      const price = priceNumber(product.price);
      const items = [{ id: "vortex-z10", name: product.title, quantity: qty, price, total: Math.round(price * qty * 100) / 100, image: product.gallery[0] }];
      const common = { items, product_summary: `${qty > 1 ? qty + "× " : ""}${product.title}`, subtotal: items[0].total, total: items[0].total, checkout_url: CHECKOUT_URL };
      crmTrack({ type: "add_to_cart", ...common, metadata: { cta: a.id || a.textContent?.trim().slice(0, 40) } }, true);
      crmTrack({ type: "checkout_started", ...common }, true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
