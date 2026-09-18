// Formatação de valores — função pura, usada em templates e no dashboard.

export function formatMoney(value: number | string | null | undefined, currency = "GBP", locale = "en-GB"): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${currency}`;
  }
}

/** Converte um valor vindo do checkout (possivelmente em centavos) para unidades monetárias. */
export function fromCheckoutAmount(raw: unknown, inCents: boolean): number {
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return inCents && Number.isInteger(n) ? Math.round(n) / 100 : Math.round(n * 100) / 100;
}
