// Normalização de contatos — funções puras (sem dependências de servidor).

const COUNTRY_CODES: Record<string, string> = { FR: "33", GB: "44", UK: "44", DE: "49", BR: "55", PT: "351", ES: "34", IT: "39", BE: "32", CH: "41", NL: "31", US: "1" };

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  // acentos/marcas combinantes e caracteres invisíveis colados por engano (ex.: "́joana@…") derrubam o envio no Resend (422 non-ASCII):
  // decompõe (é → e + acento), remove as marcas e os invisíveis; se ainda sobrar algo fora do ASCII visível, o endereço é inválido
  const v = input.normalize("NFKD").replace(/[̀-ͯ​-‍⁠﻿]/g, "").trim().toLowerCase();
  if (!v || v.length > 254) return null;
  if (/[^\x21-\x7e]/.test(v)) return null;
  // validação pragmática (RFC completo é desnecessário aqui)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return null;
  return v;
}

/**
 * Converte um telefone para E.164 (+447911123456). Regras:
 * - remove tudo que não é dígito (mantém o "+" inicial);
 * - "00" no início vira "+";
 * - número nacional começando com 0 (FR/GB/DE) perde o 0 e recebe o DDI do país padrão;
 * - número sem DDI e sem 0 recebe o DDI do país padrão.
 */
export function normalizePhone(input: unknown, defaultCountry = "GB"): string | null {
  if (input == null) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  const plus = raw.startsWith("+") || raw.startsWith("00");
  raw = raw.replace(/^00/, "").replace(/\D/g, "");
  if (!raw) return null;
  const cc = COUNTRY_CODES[defaultCountry.toUpperCase()] || "44";
  let digits: string;
  if (plus) {
    digits = raw;
  } else if (raw.startsWith("0") && raw.length >= 9 && raw.length <= 11) {
    digits = cc + raw.replace(/^0+/, "");
  } else if (raw.startsWith(cc) && raw.length >= 11) {
    digits = raw;
  } else if (raw.length >= 8 && raw.length <= 11) {
    // número nacional sem DDI (FR 9, GB 10, BR 10-11 dígitos)
    digits = cc + raw;
  } else {
    digits = raw;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

export function normalizeName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 120) : null;
}

/** Primeiro nome para saudação ("Olá, Marie!"). */
export function firstName(name: string | null | undefined, fallback = ""): string {
  if (!name) return fallback;
  const f = name.trim().split(/\s+/)[0] || "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1) : fallback;
}
