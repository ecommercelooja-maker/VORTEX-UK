"use client";

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))}
      className="btn-gradient rounded-full px-5 py-2.5 text-sm font-bold text-white"
    >
      Manage cookie preferences
    </button>
  );
}
