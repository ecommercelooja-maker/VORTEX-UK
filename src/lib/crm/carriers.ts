/**
 * Transportadoras: detecção pelo formato do código de rastreio, URL pública de rastreamento
 * e parser da colagem em lote ("um código por linha" ou "pedido;código;transportadora;url").
 * Sem dependência de servidor — usado no painel (cliente) e nas actions (servidor).
 */

export interface CarrierInfo {
  /** nome exibido/gravado em orders.tracking_carrier */
  name: string;
  /** monta a URL pública de rastreamento para um código */
  url: (code: string) => string;
}

const enc = encodeURIComponent;

/** Transportadoras conhecidas (nome → URL). A lista alimenta o autocomplete do formulário. */
export const CARRIERS: Record<string, CarrierInfo> = {
  "Royal Mail": { name: "Royal Mail", url: (c) => `https://www.royalmail.com/track-your-item#/tracking-results/${enc(c)}` },
  Parcelforce: { name: "Parcelforce", url: (c) => `https://www.parcelforce.com/track-trace?trackNumber=${enc(c)}` },
  Evri: { name: "Evri", url: (c) => `https://www.evri.com/track/parcel/${enc(c)}` },
  DPD: { name: "DPD", url: (c) => `https://track.dpd.co.uk/search?reference=${enc(c)}` },
  Yodel: { name: "Yodel", url: (c) => `https://www.yodel.co.uk/tracking/${enc(c)}` },
  DHL: { name: "DHL", url: (c) => `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${enc(c)}` },
  UPS: { name: "UPS", url: (c) => `https://www.ups.com/track?loc=en_GB&tracknum=${enc(c)}` },
  FedEx: { name: "FedEx", url: (c) => `https://www.fedex.com/fedextrack/?trknbr=${enc(c)}` },
  GLS: { name: "GLS", url: (c) => `https://gls-group.com/GROUP/en/parcel-tracking?match=${enc(c)}` },
  Cainiao: { name: "Cainiao", url: (c) => `https://global.cainiao.com/detail.htm?mailNoList=${enc(c)}` },
  "Yanwen / YunExpress": { name: "Yanwen / YunExpress", url: (c) => `https://www.yuntrack.com/parcelTracking?id=${enc(c)}` },
  "4PX": { name: "4PX", url: (c) => `https://track.4px.com/#/result/0/${enc(c)}` },
  "China Post": { name: "China Post", url: (c) => `https://t.17track.net/en#nums=${enc(c)}` },
  Correios: { name: "Correios", url: (c) => `https://rastreamento.correios.com.br/app/index.php?objetos=${enc(c)}` },
  Outra: { name: "Outra", url: (c) => `https://t.17track.net/en#nums=${enc(c)}` },
};

export const CARRIER_NAMES = Object.keys(CARRIERS);

/** URL universal (17TRACK) quando a transportadora é desconhecida. */
export function universalTrackingUrl(code: string): string {
  return `https://t.17track.net/en#nums=${enc(code)}`;
}

/** Normaliza um código colado: remove espaços internos, traços soltos e deixa em maiúsculas. */
export function normalizeTrackingCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Detecta a transportadora pelo formato do código. Só formatos inequívocos:
 * códigos só de dígitos (DPD, Yodel, GLS, FedEx…) se confundem e ficam sem detecção.
 */
export function detectCarrier(codeRaw: string): CarrierInfo | null {
  const code = normalizeTrackingCode(codeRaw);
  if (!code) return null;
  if (/^1Z[0-9A-Z]{16}$/.test(code)) return CARRIERS.UPS;
  if (/^[A-Z]{2}\d{9}CN$/.test(code)) return CARRIERS["China Post"];
  if (/^[A-Z]{2}\d{9}GB$/.test(code)) return CARRIERS["Royal Mail"];
  if (/^[HT]\d{2}[A-Z0-9]{13}$/.test(code)) return CARRIERS.Evri;
  if (/^(LP|LX|LY|LZ|LC|CNBR)\d{12,18}[A-Z]{0,2}$/.test(code)) return CARRIERS.Cainiao;
  if (/^YT\d{16}$/.test(code)) return CARRIERS["Yanwen / YunExpress"];
  if (/^4PX\d{12,20}[A-Z]{0,4}$/.test(code)) return CARRIERS["4PX"];
  if (/^JD\d{18}$/.test(code)) return CARRIERS.DHL;
  if (/^\d{10}$/.test(code)) return CARRIERS.DHL; // DHL Express
  if (/^[A-Z]{2}\d{9}BR$/.test(code)) return CARRIERS.Correios;
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) return CARRIERS.Outra; // padrão postal UPU S10 de outro país
  return null;
}

/** Resolve nome digitado (ex.: "royal mail", "yun express") para a transportadora conhecida. */
export function matchCarrierName(input: string | null | undefined): CarrierInfo | null {
  const s = (input ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return null;
  for (const c of Object.values(CARRIERS)) {
    const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key === s || key.includes(s) || s.includes(key)) return c;
    if (c.name === "Yanwen / YunExpress" && /(yanwen|yun|yunexpress)/.test(s)) return c;
    if (c.name === "Royal Mail" && /(royalmail|rm)$/.test(s)) return c;
    if (c.name === "Evri" && /hermes/.test(s)) return c;
  }
  return null;
}

/** Monta a URL de rastreio para o par (transportadora, código); cai no 17TRACK se não souber. */
export function trackingUrlFor(carrier: string | null | undefined, code: string): string {
  const c = matchCarrierName(carrier) ?? detectCarrier(code);
  return c ? c.url(normalizeTrackingCode(code)) : universalTrackingUrl(normalizeTrackingCode(code));
}

// ---------------------------------------------------------------------------
// Colagem em lote
// ---------------------------------------------------------------------------
export interface BulkLine {
  /** número da linha no texto (1-based) */
  line: number;
  /** referência ao pedido (uuid, início do nº, e-mail) — vazia quando a linha só tem o código */
  ref: string;
  code: string;
  carrier: string;
  url: string;
  /** motivo, quando a linha não pôde ser interpretada */
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Z0-9-]{6,40}$/i;

function looksLikeRef(t: string): boolean {
  return UUID_RE.test(t) || EMAIL_RE.test(t) || /^#/.test(t) || /^[0-9a-f]{6,12}$/i.test(t);
}

/**
 * Interpreta o texto colado. Aceita:
 *   - um código por linha (associado, na ordem, aos pedidos selecionados);
 *   - `pedido;código`, `pedido;código;transportadora`, `pedido;código;transportadora;url`
 *     (separadores: `;`, `,`, tab ou 2+ espaços). "pedido" = uuid, início do nº (#ad802126) ou e-mail do cliente.
 * Linhas vazias e cabeçalhos ("pedido;codigo…") são ignorados.
 */
export function parseBulkTracking(text: string): BulkLine[] {
  const out: BulkLine[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const s = raw.trim();
    if (!s) return;
    if (i === 0 && /^(pedido|order|ref|n[ºo]|e-?mail)/i.test(s) && /(c[oó]digo|code|rastreio|tracking)/i.test(s)) return; // cabeçalho
    const parts = s.split(/\t|;|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    const entry: BulkLine = { line: i + 1, ref: "", code: "", carrier: "", url: "" };
    const rest: string[] = [];
    for (const p of parts) {
      if (/^https?:\/\//i.test(p) && !entry.url) entry.url = p;
      else if (!entry.ref && looksLikeRef(p) && !detectCarrier(p)) entry.ref = p.replace(/^#/, "");
      else rest.push(p);
    }
    // entre o que sobrou: o token com cara de código vira o código; o resto é transportadora
    const codeIdx = rest.findIndex((p) => detectCarrier(p) !== null);
    const idx = codeIdx >= 0 ? codeIdx : rest.findIndex((p) => CODE_RE.test(p) && !matchCarrierName(p));
    if (idx >= 0) {
      entry.code = normalizeTrackingCode(rest[idx]);
      rest.splice(idx, 1);
    }
    if (rest.length) entry.carrier = rest.join(" ");
    if (!entry.code) entry.error = "não achei um código de rastreio nesta linha";
    else if (!entry.carrier) entry.carrier = detectCarrier(entry.code)?.name ?? "";
    out.push(entry);
  });
  return out;
}
