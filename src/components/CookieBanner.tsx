"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/*
 * Cookie consent banner (UK GDPR + PECR). Non-essential cookies are OFF until the visitor
 * opts in. Consent is passed to Google tags through Consent Mode v2 (gtag "consent" commands),
 * so Google Analytics / Google Ads only set cookies after "Accept all" or a custom choice.
 */

const KEY = "vortex-uk-consent";
type Consent = { analytics: boolean; advertising: boolean; date: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function applyConsent(c: Consent) {
  const granted = (v: boolean) => (v ? "granted" : "denied");
  gtag("consent", "update", {
    analytics_storage: granted(c.analytics),
    ad_storage: granted(c.advertising),
    ad_user_data: granted(c.advertising),
    ad_personalization: granted(c.advertising),
  });
}

function read(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    // Default: everything non-essential denied until the visitor chooses.
    gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    });
    const saved = read();
    if (saved) applyConsent(saved);
    else setOpen(true);

    const reopen = () => {
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener("open-cookie-settings", reopen);
    return () => window.removeEventListener("open-cookie-settings", reopen);
  }, []);

  const save = (c: Omit<Consent, "date">) => {
    const consent = { ...c, date: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(consent));
    } catch {}
    applyConsent(consent);
    setOpen(false);
    setCustom(false);
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie preferences" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-5 text-sm shadow-2xl">
        <h2 className="font-heading text-2xl">We use cookies</h2>
        <p className="mt-2 text-black/75">
          We use strictly necessary cookies to make this site work. With your consent we also use analytics cookies (Google Analytics) to
          understand how the site is used, and advertising cookies (Google Ads) to measure our campaigns and show relevant offers. You can
          change your mind at any time. Read our{" "}
          <Link href="/cookie-policy" className="underline">
            cookie policy
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="underline">
            privacy policy
          </Link>
          .
        </p>

        {custom && (
          <div className="mt-4 grid gap-2 rounded-xl bg-surface p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <b>Strictly necessary</b> — always on (security, basket, your cookie choice)
              </span>
              <input type="checkbox" checked disabled className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>
                <b>Analytics</b> — Google Analytics, anonymous usage statistics
              </span>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>
                <b>Advertising</b> — Google Ads conversion measurement and remarketing
              </span>
              <input type="checkbox" checked={advertising} onChange={(e) => setAdvertising(e.target.checked)} className="h-4 w-4" />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => save({ analytics: true, advertising: true })} className="btn-gradient rounded-full px-5 py-2.5 font-bold text-white">
            Accept all
          </button>
          <button type="button" onClick={() => save({ analytics: false, advertising: false })} className="rounded-full border border-black/30 px-5 py-2.5 font-bold">
            Reject non-essential
          </button>
          {custom ? (
            <button type="button" onClick={() => save({ analytics, advertising })} className="rounded-full border border-black/30 px-5 py-2.5 font-bold">
              Save my choices
            </button>
          ) : (
            <button type="button" onClick={() => setCustom(true)} className="rounded-full px-5 py-2.5 font-semibold underline underline-offset-4">
              Manage preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
