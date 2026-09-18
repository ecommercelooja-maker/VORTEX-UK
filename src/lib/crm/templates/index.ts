// Templates de comunicação — funções puras. O idioma segue o locale da loja
// (clientes desta loja são britânicos → "en"; fr/pt-BR/de disponíveis para clientes de outros países e lojas irmãs).
import { formatMoney } from "../money";
import { firstName } from "../normalize";
import type { CartItem, ShippingAddress } from "../types";

export type Lang = "fr" | "pt" | "en" | "de";

export function langFromLocale(locale: string): Lang {
  const l = locale.toLowerCase();
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("en")) return "en";
  if (l.startsWith("de")) return "de";
  return "fr";
}

export interface TemplateContext {
  lang: Lang;
  locale: string;
  currency: string;
  storeName: string;
  siteUrl: string;
  supportEmail?: string | null;
}

export interface AbandonedCartData {
  customerName: string | null;
  items: CartItem[];
  total: number;
  checkoutUrl: string;
  promotion: { active: boolean; isLastDay: boolean; message: string | null; endsAt: Date | null };
}

export interface PurchaseData {
  customerName: string | null;
  orderNumber: string;
  items: CartItem[];
  total: number;
  shippingAddress: ShippingAddress | null;
  orderStatus: string;
}

export interface TrackingData {
  customerName: string | null;
  orderNumber: string;
  trackingCode: string;
  carrier: string | null;
  trackingUrl: string | null;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const T = {
  fr: {
    hello: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    cartSubject: "Votre panier vous attend toujours",
    cartIntro: "vous avez laissé des articles dans votre panier. Ils sont toujours disponibles :",
    cartTotal: "Montant",
    cartButton: "Finaliser ma commande",
    promoLastDay: "Attention : la promotion se termine aujourd'hui.",
    promoActive: "Promotion en cours :",
    cartWhatsApp: (n: string, link: string, lastDay: boolean) =>
      `Bonjour${n ? " " + n : ""} ! Vous avez laissé des articles dans votre panier.${lastDay ? " La promotion se termine aujourd'hui." : ""} Si vous souhaitez en profiter, vous pouvez finaliser votre commande ici : ${link}`,
    purchaseSubject: (o: string) => `Confirmation de votre commande #${o}`,
    purchaseIntro: (o: string) => `merci pour votre achat ! Votre commande #${o} est confirmée.`,
    orderNumber: "Numéro de commande",
    products: "Produits",
    total: "Total",
    shippingTo: "Adresse de livraison",
    status: "Statut de la commande",
    purchaseWhatsApp: (n: string, o: string, total: string) => `Bonjour${n ? " " + n : ""} ! Votre commande #${o} (${total}) est confirmée. Merci pour votre confiance !`,
    trackingSubject: "Votre commande a été expédiée",
    trackingIntro: (o: string) => `votre commande #${o} a été expédiée.`,
    trackingCode: "Numéro de suivi",
    carrier: "Transporteur",
    trackButton: "Suivre ma commande",
    trackingWhatsApp: (n: string, o: string, code: string, url: string) =>
      `Bonjour${n ? " " + n : ""} ! Votre commande #${o} a été expédiée. Numéro de suivi : ${code}.${url ? " Suivez-la ici : " + url : ""}`,
    footer: (store: string) => `Cet e-mail vous a été envoyé par ${store} suite à votre visite sur notre boutique.`,
    statuses: { pending: "En attente", paid: "Payée", processing: "En préparation", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée", refunded: "Remboursée" } as Record<string, string>,
  },
  pt: {
    hello: (n: string) => (n ? `Olá, ${n}!` : "Olá!"),
    cartSubject: "Seu carrinho ainda está esperando por você",
    cartIntro: "você deixou alguns produtos no seu carrinho. Eles ainda estão disponíveis:",
    cartTotal: "Valor",
    cartButton: "Voltar ao checkout",
    promoLastDay: "Atenção: a promoção termina hoje.",
    promoActive: "Promoção ativa:",
    cartWhatsApp: (n: string, link: string, lastDay: boolean) =>
      `Olá${n ? ", " + n : ""}! Você deixou alguns produtos no seu carrinho.${lastDay ? " A promoção termina hoje." : ""} Se ainda quiser aproveitar, você pode finalizar sua compra aqui: ${link}`,
    purchaseSubject: (o: string) => `Confirmação do seu pedido #${o}`,
    purchaseIntro: (o: string) => `obrigado pela sua compra! Seu pedido #${o} foi confirmado.`,
    orderNumber: "Número do pedido",
    products: "Produtos",
    total: "Valor",
    shippingTo: "Endereço de entrega",
    status: "Status do pedido",
    purchaseWhatsApp: (n: string, o: string, total: string) => `Olá${n ? ", " + n : ""}! Seu pedido #${o} (${total}) foi confirmado. Obrigado pela confiança!`,
    trackingSubject: "Seu pedido foi enviado",
    trackingIntro: (o: string) => `seu pedido #${o} foi enviado.`,
    trackingCode: "Código de rastreio",
    carrier: "Transportadora",
    trackButton: "Rastrear pedido",
    trackingWhatsApp: (n: string, o: string, code: string, url: string) =>
      `Olá${n ? ", " + n : ""}! Seu pedido #${o} foi enviado. Código de rastreio: ${code}.${url ? " Acompanhe aqui: " + url : ""}`,
    footer: (store: string) => `Este e-mail foi enviado por ${store} em razão da sua visita à nossa loja.`,
    statuses: { pending: "Pendente", paid: "Pago", processing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado" } as Record<string, string>,
  },
  en: {
    hello: (n: string) => (n ? `Hi ${n},` : "Hi,"),
    cartSubject: "Your basket is still waiting for you",
    cartIntro: "you left some items in your basket. They're still available:",
    cartTotal: "Amount",
    cartButton: "Return to checkout",
    promoLastDay: "Heads up: the promotion ends today.",
    promoActive: "Current promotion:",
    cartWhatsApp: (n: string, link: string, lastDay: boolean) =>
      `Hi${n ? " " + n : ""}! You left some items in your basket.${lastDay ? " The promotion ends today." : ""} If you'd still like them, you can complete your order here: ${link}`,
    purchaseSubject: (o: string) => `Your order #${o} is confirmed`,
    purchaseIntro: (o: string) => `thank you for your purchase! Your order #${o} is confirmed.`,
    orderNumber: "Order number",
    products: "Products",
    total: "Total",
    shippingTo: "Delivery address",
    status: "Order status",
    purchaseWhatsApp: (n: string, o: string, total: string) => `Hi${n ? " " + n : ""}! Your order #${o} (${total}) is confirmed. Thank you!`,
    trackingSubject: "Your order has been shipped",
    trackingIntro: (o: string) => `your order #${o} has been shipped.`,
    trackingCode: "Tracking number",
    carrier: "Carrier",
    trackButton: "Track my order",
    trackingWhatsApp: (n: string, o: string, code: string, url: string) =>
      `Hi${n ? " " + n : ""}! Your order #${o} has been shipped. Tracking number: ${code}.${url ? " Track it here: " + url : ""}`,
    footer: (store: string) => `This e-mail was sent by ${store} following your visit to our shop.`,
    statuses: { pending: "Pending", paid: "Paid", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" } as Record<string, string>,
  },
  de: {
    hello: (n: string) => (n ? `Hallo ${n},` : "Hallo,"),
    cartSubject: "Ihr Warenkorb wartet noch auf Sie",
    cartIntro: "Sie haben Artikel in Ihrem Warenkorb gelassen. Sie sind weiterhin verfügbar:",
    cartTotal: "Betrag",
    cartButton: "Zur Kasse zurückkehren",
    promoLastDay: "Hinweis: Die Aktion endet heute.",
    promoActive: "Aktuelle Aktion:",
    cartWhatsApp: (n: string, link: string, lastDay: boolean) =>
      `Hallo${n ? " " + n : ""}! Sie haben Artikel in Ihrem Warenkorb gelassen.${lastDay ? " Die Aktion endet heute." : ""} Hier können Sie Ihre Bestellung abschließen: ${link}`,
    purchaseSubject: (o: string) => `Bestätigung Ihrer Bestellung #${o}`,
    purchaseIntro: (o: string) => `vielen Dank für Ihren Einkauf! Ihre Bestellung #${o} ist bestätigt.`,
    orderNumber: "Bestellnummer",
    products: "Produkte",
    total: "Gesamt",
    shippingTo: "Lieferadresse",
    status: "Bestellstatus",
    purchaseWhatsApp: (n: string, o: string, total: string) => `Hallo${n ? " " + n : ""}! Ihre Bestellung #${o} (${total}) ist bestätigt. Vielen Dank!`,
    trackingSubject: "Ihre Bestellung wurde versandt",
    trackingIntro: (o: string) => `Ihre Bestellung #${o} wurde versandt.`,
    trackingCode: "Sendungsnummer",
    carrier: "Versanddienstleister",
    trackButton: "Sendung verfolgen",
    trackingWhatsApp: (n: string, o: string, code: string, url: string) =>
      `Hallo${n ? " " + n : ""}! Ihre Bestellung #${o} wurde versandt. Sendungsnummer: ${code}.${url ? " Verfolgen Sie sie hier: " + url : ""}`,
    footer: (store: string) => `Diese E-Mail wurde von ${store} nach Ihrem Besuch in unserem Shop gesendet.`,
    statuses: { pending: "Ausstehend", paid: "Bezahlt", processing: "In Bearbeitung", shipped: "Versandt", delivered: "Zugestellt", cancelled: "Storniert", refunded: "Erstattet" } as Record<string, string>,
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Cores da marca (mesmas do site: globals.css --accent) */
const BRAND = { black: "#000000", lime: "#a8c416", limeSoft: "#f4f9e3", text: "#111111", muted: "#6b6b6b", line: "#e8e8e8", bg: "#f3f3f3" };

/** URL absoluta da logo (public/logo.png do site — lime sobre fundo transparente). */
function logoUrl(ctx: TemplateContext): string {
  return `${ctx.siteUrl.replace(/\/+$/, "")}/logo.png`;
}

/**
 * Moldura comum dos e-mails: cabeçalho preto com a logo VORTEX centralizada e um filete lime,
 * corpo branco arredondado e rodapé discreto. Só tabelas + estilos inline (Gmail/Outlook/Apple Mail).
 */
function layout(ctx: TemplateContext, bodyHtml: string, preheader = ""): string {
  const t = T[ctx.lang];
  const host = ctx.siteUrl.replace(/^https?:\/\//, "");
  return `<!doctype html><html lang="${esc(ctx.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ctx.storeName)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Helvetica,Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.bg};opacity:0">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td align="center" style="background:${BRAND.black};padding:26px 28px 22px"><a href="${esc(ctx.siteUrl)}" style="text-decoration:none;display:inline-block"><img src="${esc(logoUrl(ctx))}" width="160" height="48" alt="${esc(ctx.storeName)}" style="display:block;width:160px;height:auto;border:0;outline:none"></a></td></tr>
<tr><td style="background:${BRAND.lime};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:30px 32px 26px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:18px 32px 22px;background:#fafafa;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6">
<b style="color:${BRAND.text}">${esc(ctx.storeName)}</b> · <a href="${esc(ctx.siteUrl)}" style="color:${BRAND.muted}">${esc(host)}</a>${ctx.supportEmail ? ` · <a href="mailto:${esc(ctx.supportEmail)}" style="color:${BRAND.muted}">${esc(ctx.supportEmail)}</a>` : ""}<br>
${esc(t.footer(ctx.storeName))}
</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsHtml(items: CartItem[], ctx: TemplateContext): string {
  if (!items.length) return "";
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee;white-space:nowrap">${esc(formatMoney(i.total, ctx.currency, ctx.locale))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;font-size:14px">${rows}</table>`;
}

function itemsText(items: CartItem[], ctx: TemplateContext): string {
  return items.map((i) => `- ${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}: ${formatMoney(i.total, ctx.currency, ctx.locale)}`).join("\n");
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto 22px"><tr><td align="center" style="background:${BRAND.lime};border-radius:999px"><a href="${esc(href)}" style="display:inline-block;padding:15px 34px;color:${BRAND.black};text-decoration:none;font-weight:800;font-size:16px;letter-spacing:.01em">${esc(label)} →</a></td></tr></table>`;
}

function addressText(a: ShippingAddress | null): string | null {
  if (!a) return null;
  const line1 = [a.street, a.number].filter(Boolean).join(", ");
  const parts = [line1, a.complement, a.neighborhood, [a.zip, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ---------------------------------------------------------------------------

/**
 * Mensagem de recuperação com oferta (texto definido pela loja em 14/09/2026) para clientes da
 * França (fr) e do Reino Unido (en). Os demais idiomas usam o template padrão abaixo.
 */
const CART_OFFER: Partial<Record<Lang, { subject: string; paragraphs: string[]; cta: string; closing: string }>> = {
  fr: {
    subject: "🎁 Votre panier vous attend !",
    paragraphs: [
      "Vous avez oublié quelque chose ? Votre commande est toujours réservée.",
      "💥 OFFRE EXCLUSIVE : -20 % sur votre prochaine commande si vous finalisez votre paiement immédiatement.",
      "⏰ Cette offre est limitée et peut expirer à tout moment.",
      "👉 Finalisez votre commande maintenant et profitez de votre coupon de 20 %.",
    ],
    cta: "Finaliser ma commande",
    closing: "À très vite ! 🇫🇷",
  },
  en: {
    subject: "🎁 Your cart is waiting for you!",
    paragraphs: [
      "Forgot something? Your items are still reserved for you.",
      "💥 EXCLUSIVE OFFER: 20% OFF your next purchase when you complete your payment right now.",
      "⏰ This offer is limited and may expire at any time.",
      "👉 Complete your order now and claim your 20% OFF coupon.",
    ],
    cta: "Complete my order",
    closing: "See you soon! 🛍️",
  },
};

/** Card do(s) produto(s) do carrinho, com imagem quando o checkout mandou uma. */
function cartItemsCard(items: CartItem[], ctx: TemplateContext): string {
  if (!items.length) return "";
  const rows = items
    .map((i) => {
      // sem imagem no payload do checkout: a loja vende um único produto (VORTEX Z10) → foto oficial do site
      const img = i.image && /^https?:\/\//i.test(i.image) ? i.image : /vortex|z10/i.test(i.name) ? `${ctx.siteUrl.replace(/\/+$/, "")}/produto/01.jpg` : null;
      return `<tr>
${img ? `<td width="72" valign="top" style="padding:12px 14px 12px 0"><img src="${esc(img)}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid ${BRAND.line}"></td>` : ""}
<td valign="middle" style="padding:12px 0;font-size:15px;line-height:1.4"><b>${esc(i.name)}</b>${i.quantity > 1 ? `<br><span style="color:${BRAND.muted};font-size:13px">× ${i.quantity}</span>` : ""}</td>
<td align="right" valign="middle" style="padding:12px 0 12px 12px;white-space:nowrap;font-weight:700;font-size:15px">${esc(formatMoney(i.total, ctx.currency, ctx.locale))}</td>
</tr>`;
    })
    .join(`<tr><td colspan="3" style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0">&nbsp;</td></tr>`);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 6px;border:1px solid ${BRAND.line};border-radius:14px;padding:4px 16px">${rows}</table>`;
}

function abandonedCartOfferEmail(ctx: TemplateContext, d: AbandonedCartData, offer: NonNullable<(typeof CART_OFFER)[Lang]>): EmailTemplate {
  const t = T[ctx.lang];
  const name = firstName(d.customerName);
  const total = formatMoney(d.total, ctx.currency, ctx.locale);
  const [intro, offerLine, urgency, nudge] = offer.paragraphs;
  const pct = (offerLine.match(/-?\s?(\d{1,2})\s?%/) ?? [])[1] ?? "20";
  const html = layout(
    ctx,
    `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-.01em">${esc(offer.subject)}</h1>` +
      `<p style="margin:0 0 10px">${esc(t.hello(name))}</p>` +
      `<p style="margin:0 0 18px;color:#333">${esc(intro)}</p>` +
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px"><tr>
<td style="background:${BRAND.limeSoft};border-left:5px solid ${BRAND.lime};border-radius:12px;padding:16px 18px">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td valign="middle" style="padding-right:16px"><span style="display:inline-block;background:${BRAND.black};color:${BRAND.lime};font-weight:900;font-size:26px;line-height:1;padding:12px 14px;border-radius:12px;white-space:nowrap">-${esc(pct)}${ctx.lang === "fr" ? "&nbsp;" : ""}%</span></td>
<td valign="middle" style="font-size:15px;line-height:1.45"><b>${esc(offerLine)}</b><br><span style="color:#8a6d00;font-size:13px">${esc(urgency)}</span></td>
</tr></table>
</td></tr></table>` +
      cartItemsCard(d.items, ctx) +
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:10px 2px 0;font-size:15px;color:${BRAND.muted}">${esc(t.cartTotal)}</td><td align="right" style="padding:10px 2px 0;font-size:20px;font-weight:800">${esc(total)}</td></tr></table>` +
      button(d.checkoutUrl, offer.cta) +
      `<p style="margin:0 0 18px;text-align:center;color:#333;font-size:14px">${esc(nudge)}</p>` +
      `<p style="margin:0;color:${BRAND.muted};font-size:14px">${esc(offer.closing)}</p>`,
    intro,
  );
  const text = [offer.subject, "", name ? t.hello(name) : "", ...offer.paragraphs.flatMap((p) => [p, ""]), itemsText(d.items, ctx), `${t.cartTotal}: ${total}`, "", `${offer.cta}: ${d.checkoutUrl}`, "", offer.closing]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
  return { subject: offer.subject, html, text };
}

export function abandonedCartEmail(ctx: TemplateContext, d: AbandonedCartData): EmailTemplate {
  const offer = CART_OFFER[ctx.lang];
  if (offer) return abandonedCartOfferEmail(ctx, d, offer);
  const t = T[ctx.lang];
  const name = firstName(d.customerName);
  const total = formatMoney(d.total, ctx.currency, ctx.locale);
  const promoLines: string[] = [];
  if (d.promotion.active) {
    if (d.promotion.message) promoLines.push(`${t.promoActive} ${d.promotion.message}`);
    // urgência SOMENTE quando a promoção realmente termina hoje
    if (d.promotion.isLastDay) promoLines.push(t.promoLastDay);
  }
  const html = layout(
    ctx,
    `<p>${esc(t.hello(name))}</p><p>${esc(t.cartIntro)}</p>${itemsHtml(d.items, ctx)}<p><b>${esc(t.cartTotal)}:</b> ${esc(total)}</p>${promoLines.map((l) => `<p style="color:#b45309;font-weight:600">${esc(l)}</p>`).join("")}${button(d.checkoutUrl, t.cartButton)}`,
  );
  const text = [t.hello(name), "", t.cartIntro, itemsText(d.items, ctx), `${t.cartTotal}: ${total}`, ...promoLines, "", `${t.cartButton}: ${d.checkoutUrl}`].join("\n");
  return { subject: t.cartSubject, html, text };
}

export function abandonedCartWhatsApp(ctx: TemplateContext, d: AbandonedCartData): string {
  const offer = CART_OFFER[ctx.lang];
  if (offer) return [offer.subject, "", ...offer.paragraphs, "", `${offer.cta}: ${d.checkoutUrl}`, "", offer.closing].join("\n");
  return T[ctx.lang].cartWhatsApp(firstName(d.customerName), d.checkoutUrl, d.promotion.active && d.promotion.isLastDay);
}

export function purchaseConfirmationEmail(ctx: TemplateContext, d: PurchaseData): EmailTemplate {
  const t = T[ctx.lang];
  const name = firstName(d.customerName);
  const total = formatMoney(d.total, ctx.currency, ctx.locale);
  const addr = addressText(d.shippingAddress);
  const status = t.statuses[d.orderStatus] || d.orderStatus;
  const html = layout(
    ctx,
    `<p>${esc(t.hello(name))}</p><p>${esc(t.purchaseIntro(d.orderNumber))}</p><p><b>${esc(t.orderNumber)}:</b> #${esc(d.orderNumber)}</p><p><b>${esc(t.products)}:</b></p>${itemsHtml(d.items, ctx)}<p><b>${esc(t.total)}:</b> ${esc(total)}</p>${addr ? `<p><b>${esc(t.shippingTo)}:</b><br>${esc(addr)}</p>` : ""}<p><b>${esc(t.status)}:</b> ${esc(status)}</p>`,
  );
  const text = [t.hello(name), "", t.purchaseIntro(d.orderNumber), `${t.orderNumber}: #${d.orderNumber}`, `${t.products}:`, itemsText(d.items, ctx), `${t.total}: ${total}`, addr ? `${t.shippingTo}: ${addr}` : "", `${t.status}: ${status}`].filter(Boolean).join("\n");
  return { subject: t.purchaseSubject(d.orderNumber), html, text };
}

export function purchaseConfirmationWhatsApp(ctx: TemplateContext, d: PurchaseData): string {
  return T[ctx.lang].purchaseWhatsApp(firstName(d.customerName), d.orderNumber, formatMoney(d.total, ctx.currency, ctx.locale));
}

export function trackingEmail(ctx: TemplateContext, d: TrackingData): EmailTemplate {
  const t = T[ctx.lang];
  const name = firstName(d.customerName);
  const html = layout(
    ctx,
    `<p>${esc(t.hello(name))}</p><p>${esc(t.trackingIntro(d.orderNumber))}</p><p><b>${esc(t.trackingCode)}:</b><br><span style="font-size:18px;font-family:monospace">${esc(d.trackingCode)}</span></p>${d.carrier ? `<p><b>${esc(t.carrier)}:</b> ${esc(d.carrier)}</p>` : ""}${d.trackingUrl ? button(d.trackingUrl, t.trackButton) : ""}`,
  );
  const text = [t.hello(name), "", t.trackingIntro(d.orderNumber), `${t.trackingCode}: ${d.trackingCode}`, d.carrier ? `${t.carrier}: ${d.carrier}` : "", d.trackingUrl ? `${t.trackButton}: ${d.trackingUrl}` : ""].filter(Boolean).join("\n");
  return { subject: t.trackingSubject, html, text };
}

export function trackingWhatsApp(ctx: TemplateContext, d: TrackingData): string {
  return T[ctx.lang].trackingWhatsApp(firstName(d.customerName), d.orderNumber, d.trackingCode, d.trackingUrl || "");
}

export interface ManualEmailData {
  subject: string;
  /** Texto simples; parágrafos separados por linha em branco. */
  body: string;
}

/** E-mail manual (operador / assistente de I.A.): texto simples dentro do layout da loja. */
export function manualEmail(ctx: TemplateContext, d: ManualEmailData): EmailTemplate {
  const paragraphs = d.body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return { subject: d.subject.trim() || ctx.storeName, html: layout(ctx, paragraphs), text: d.body.trim() };
}
