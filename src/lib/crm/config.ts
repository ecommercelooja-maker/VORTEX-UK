// Configuração do CRM/e-commerce desta loja.
// Tudo que é segredo vem de variáveis de ambiente (nunca vai para o frontend).
// Este arquivo é seguro para importar em qualquer lugar: só expõe valores públicos.

/** Identificador da loja. Cada uma das 3 lojas tem o seu; o dashboard central usa este ID para separar os dados. */
export const STORE_ID = (process.env.STORE_ID || "vortex_uk").trim();
export const STORE_NAME = (process.env.STORE_NAME || "VORTEX UK").trim();
/** Locale dos clientes desta loja: define o idioma dos e-mails/mensagens enviados a eles. */
export const STORE_LOCALE = (process.env.STORE_LOCALE || "en-GB").trim();
export const STORE_CURRENCY = (process.env.STORE_CURRENCY || "GBP").trim().toUpperCase();
/** País padrão para normalizar telefones sem DDI (FR, GB, DE, BR...). */
export const DEFAULT_PHONE_COUNTRY = (process.env.DEFAULT_PHONE_COUNTRY || "GB").trim().toUpperCase();

/** Tempo sem atividade para um carrinho ser considerado abandonado (fallback; editável no dashboard). */
export const ABANDONED_CART_TIMEOUT_MINUTES = intEnv("ABANDONED_CART_TIMEOUT_MINUTES", 30);
/** Janela em que uma automação igual (mesmo carrinho + tipo + canal) não pode se repetir. */
export const AUTOMATION_DEDUPE_HOURS = intEnv("AUTOMATION_DEDUPE_HOURS", 24);
/** Carrinhos abandonados mais antigos que isso viram "expired". */
export const CART_EXPIRE_DAYS = intEnv("CART_EXPIRE_DAYS", 30);

/** Promoção (fallback via env; editável no dashboard em Configurações). */
export const PROMOTION_ACTIVE = boolEnv("PROMOTION_ACTIVE", false);
export const PROMOTION_START_AT = process.env.PROMOTION_START_AT || null;
export const PROMOTION_END_AT = process.env.PROMOTION_END_AT || null;
export const PROMOTION_MESSAGE = process.env.PROMOTION_MESSAGE || null;

/** Checkouts brasileiros (Umpi) normalmente enviam valores em centavos. */
export const CHECKOUT_AMOUNTS_IN_CENTS = boolEnv("CHECKOUT_AMOUNTS_IN_CENTS", true);

function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function boolEnv(name: string, fallback: boolean): boolean {
  const v = (process.env[name] || "").trim().toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
