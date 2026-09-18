// Adaptador do webhook do Umpi Checkout -> evento normalizado.
// Função pura (sem acesso a banco). A documentação oficial
// (https://developers.umpi.com.br/webhook-reference/introduction) documenta os eventos
// CHECKOUT_ABANDONED, PAYMENT_PENDING, PAYMENT_PAID, PAYMENT_REFUSED, CHARGEBACK e
// TRACKING_FOUND, mas NÃO documenta os campos de cliente/valores. Por isso a extração é
// defensiva: tenta vários caminhos plausíveis e o payload bruto fica salvo em webhook_events
// para ajustar o mapeamento com um payload real.
import { fromCheckoutAmount } from "../money";
import type { CartItem, ShippingAddress } from "../types";

export type CheckoutEventKind = "checkout_abandoned" | "payment_pending" | "payment_paid" | "payment_refused" | "chargeback" | "tracking_found" | "unknown";

export interface NormalizedCheckoutEvent {
  provider: "umpi";
  kind: CheckoutEventKind;
  rawEvent: string | null;
  externalOrderId: string | null;
  externalCartId: string | null;
  customer: { name: string | null; email: string | null; phone: string | null; acceptsMarketing: boolean | null };
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  checkoutUrl: string | null;
  shippingAddress: ShippingAddress | null;
  tracking: { code: string | null; carrier: string | null; url: string | null; status: string | null };
  utm: Record<string, string>;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Lê o primeiro valor não vazio entre vários caminhos "a.b.c". */
function pick(root: unknown, paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = root;
    for (const seg of p.split(".")) {
      if (!isObj(cur)) {
        cur = undefined;
        break;
      }
      cur = cur[seg];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const CUSTOMER_ROOTS = ["transaction.customer", "transaction.Customer", "transaction.TransactionCustomer", "customer", "Customer", "transaction.client", "client", "transaction.buyer", "buyer", "transaction"];

function customerField(root: unknown, names: string[]): string | null {
  const paths: string[] = [];
  for (const r of CUSTOMER_ROOTS) for (const n of names) paths.push(`${r}.${n}`);
  for (const n of names) paths.push(n);
  return str(pick(root, paths));
}

function mapKind(event: string | null, status: string | null): CheckoutEventKind {
  const e = (event || "").toUpperCase();
  const s = (status || "").toUpperCase();
  if (e.includes("ABANDON") || s.includes("ABANDON")) return "checkout_abandoned";
  if (e === "PAYMENT_PAID" || e.includes("PAID") || e.includes("APPROVED") || s === "PAID" || s === "APPROVED") return "payment_paid";
  if (e.includes("PENDING") || s === "PENDING" || s === "PEDING" || s === "WAITING") return "payment_pending";
  if (e.includes("REFUSED") || e.includes("DECLINED") || s === "REFUSED" || s === "DECLINED") return "payment_refused";
  if (e.includes("CHARGEBACK") || e.includes("REFUND") || s.includes("CHARGEBACK") || s.includes("REFUND")) return "chargeback";
  if (e.includes("TRACKING")) return "tracking_found";
  return "unknown";
}

function mapItems(root: unknown, inCents: boolean): CartItem[] {
  const raw = pick(root, ["transaction.TransactionItem", "transaction.items", "transaction.Items", "items", "Items", "products", "transaction.products", "cart.items", "transaction.cart.items"]);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObj)
    .map((i) => {
      const quantity = Number(pick(i, ["quantity", "qty", "amount"])) || 1;
      const price = fromCheckoutAmount(pick(i, ["price", "unitPrice", "unit_price", "value"]), inCents);
      const totalRaw = pick(i, ["total", "totalPrice", "total_price", "subtotal"]);
      const total = totalRaw != null ? fromCheckoutAmount(totalRaw, inCents) : Math.round(price * quantity * 100) / 100;
      return {
        id: str(pick(i, ["id", "productId", "product_id", "sku", "variantId"])),
        name: str(pick(i, ["name", "title", "productName", "product_name"])) || "Produto",
        quantity,
        price,
        total,
        image: str(pick(i, ["image", "imageUrl", "image_url", "thumbnail"])),
      };
    });
}

function mapAddress(root: unknown): ShippingAddress | null {
  const a = pick(root, ["transaction.TransactionShipping", "transaction.shipping", "transaction.shippingAddress", "transaction.address", "shipping", "shippingAddress", "address", "customer.address", "transaction.customer.address"]);
  if (!isObj(a)) return null;
  const addr: ShippingAddress = {
    street: str(pick(a, ["street", "address1", "address", "line1"])),
    number: str(pick(a, ["streetNumber", "number", "addressNumber"])),
    complement: str(pick(a, ["complement", "address2", "line2"])),
    neighborhood: str(pick(a, ["neighborhood", "district"])),
    city: str(pick(a, ["city"])),
    state: str(pick(a, ["state", "province", "region"])),
    country: str(pick(a, ["country", "countryCode"])),
    zip: str(pick(a, ["zipCode", "zip", "postalCode", "postal_code", "cep"])),
  };
  return Object.values(addr).some(Boolean) ? addr : null;
}

export function normalizeUmpiPayload(payload: unknown, opts: { amountsInCents: boolean }): NormalizedCheckoutEvent {
  const root = isObj(payload) ? payload : {};
  const rawEvent = str(pick(root, ["event", "type", "eventType", "event_type"]));
  const status = str(pick(root, ["transaction.status", "status", "payment.status", "paymentStatus"]));
  const kind = mapKind(rawEvent, status);
  const inCents = opts.amountsInCents;

  const externalOrderId = str(pick(root, ["transaction.id", "transactionId", "transaction_id", "order.id", "orderId", "order_id", "id"]));
  const externalCartId = str(pick(root, ["checkout.id", "checkoutId", "checkout_id", "cart.id", "cartId", "cart_id", "transaction.checkoutId", "transaction.cartId"])) || externalOrderId;

  const acceptsRaw = pick(root, ["transaction.customer.acceptsMarketing", "customer.acceptsMarketing", "customer.accepts_marketing", "acceptsMarketing", "marketingOptIn", "customer.marketingOptIn"]);
  const acceptsMarketing = typeof acceptsRaw === "boolean" ? acceptsRaw : acceptsRaw == null ? null : ["true", "1", "yes"].includes(String(acceptsRaw).toLowerCase());

  const firstName = customerField(root, ["firstName", "first_name"]);
  const lastName = customerField(root, ["lastName", "last_name"]);
  const name = customerField(root, ["name", "fullName", "full_name", "customerName", "customer_name"]) || [firstName, lastName].filter(Boolean).join(" ") || str(pick(root, ["transaction.TransactionCard.holderName"]));

  const items = mapItems(root, inCents);
  const itemsSum = items.reduce((s, i) => s + i.total, 0);
  const subtotalRaw = pick(root, ["transaction.subtotal", "transaction.subTotal", "subtotal", "subTotal", "transaction.amounts.subtotal"]);
  const discountRaw = pick(root, ["transaction.discount", "discount", "transaction.discountAmount", "discountAmount", "transaction.amounts.discount"]);
  const shippingRaw = pick(root, ["transaction.shippingAmount", "transaction.shippingCost", "transaction.freight", "shippingAmount", "shippingCost", "freight", "transaction.amounts.shipping", "transaction.TransactionShipping.price", "transaction.TransactionShipping.amount"]);
  const totalRaw = pick(root, ["transaction.total", "transaction.amount", "transaction.totalAmount", "total", "amount", "totalAmount", "transaction.amounts.total"]);
  const subtotal = subtotalRaw != null ? fromCheckoutAmount(subtotalRaw, inCents) : Math.round(itemsSum * 100) / 100;
  const discount = discountRaw != null ? fromCheckoutAmount(discountRaw, inCents) : 0;
  const shipping = shippingRaw != null ? fromCheckoutAmount(shippingRaw, inCents) : 0;
  const total = totalRaw != null ? fromCheckoutAmount(totalRaw, inCents) : Math.round((subtotal - discount + shipping) * 100) / 100;

  const paidAtRaw = str(pick(root, ["transaction.paidAt", "paidAt", "paid_at", "transaction.paid_at"]));
  const paidAt = paidAtRaw && !Number.isNaN(new Date(paidAtRaw).getTime()) ? new Date(paidAtRaw).toISOString() : null;

  const hasCard = isObj(pick(root, ["transaction.TransactionCard"]));
  const hasPix = isObj(pick(root, ["transaction.TransactionPix"]));
  const paymentMethod = str(pick(root, ["transaction.paymentMethod", "paymentMethod", "payment_method", "transaction.payment.method"])) || (hasCard ? "card" : hasPix ? "pix" : null);

  const utm: Record<string, string> = {};
  const tr = pick(root, ["tracking", "transaction.tracking"]);
  if (isObj(tr)) for (const [k, v] of Object.entries(tr)) if (typeof v === "string" && v && k.toLowerCase().startsWith("utm")) utm[k] = v;

  return {
    provider: "umpi",
    kind,
    rawEvent,
    externalOrderId,
    externalCartId,
    customer: {
      name,
      email: customerField(root, ["email", "customerEmail", "customer_email"]),
      phone: customerField(root, ["phone", "phoneNumber", "phone_number", "mobile", "cellphone", "whatsapp", "customerPhone"]),
      acceptsMarketing,
    },
    items,
    subtotal,
    discount,
    shipping,
    total,
    currency: str(pick(root, ["transaction.currency", "currency", "transaction.currencyCode"]))?.toUpperCase() ?? null,
    paidAt,
    paymentMethod,
    checkoutUrl: str(pick(root, ["checkoutUrl", "checkout_url", "transaction.checkoutUrl", "transaction.checkout_url", "url", "recoveryUrl", "recovery_url", "transaction.recoveryUrl", "abandonedCheckoutUrl"])),
    shippingAddress: mapAddress(root),
    utm,
    tracking: {
      code: str(pick(root, ["transaction.trackingCode", "trackingCode", "tracking_code", "transaction.tracking.code", "tracking.code", "transaction.TransactionTracking.code", "transaction.TransactionShipping.trackingCode"])),
      carrier: str(pick(root, ["transaction.trackingCarrier", "trackingCarrier", "carrier", "transaction.tracking.carrier", "tracking.carrier", "transaction.TransactionTracking.carrier", "transaction.TransactionShipping.carrier"])),
      url: str(pick(root, ["transaction.trackingUrl", "trackingUrl", "tracking_url", "transaction.tracking.url", "tracking.url", "transaction.TransactionTracking.url"])),
      status: str(pick(root, ["transaction.trackingStatus", "trackingStatus", "transaction.tracking.status", "tracking.status"])),
    },
  };
}
