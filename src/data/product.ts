// Sales page content for the VORTEX Z10 — UK edition (British English).
// Adapted from the French page vortex-mobilite.com/products/vortex-z10.

/** Checkout link. Used by every buy button. Replace with the UK checkout URL when ready. */
export const CHECKOUT_URL = "#buy";

export const product = {
  title: "VORTEX Z10 2x2, app-connected electric scooter.",
  vendor: "VORTEX",
  price: "£84.90",
  comparePrice: "£174.90",
  discountLabel: "Save 51%",
  rating: 4.9,
  reviewCount: 312,
  bullets: [
    "In stock — dispatched immediately.",
    "Free express delivery across the UK",
    "60-day money-back guarantee",
  ],
  gallery: Array.from({ length: 7 }, (_, i) => `/produto/${String(i + 1).padStart(2, "0")}.jpg`),
  guarantees: ["Free UK delivery", "Secure payment", "Limited stock"],
  ctaLabel: "ADD TO BASKET",
  stickyCtaLabel: "BUY NOW",
};

export const announcements = [
  { icon: "box", text: "FREE UK DELIVERY" },
  { icon: "storefront", text: "UP TO 70% OFF" },
];

export const nav = [
  "Get started",
  "Electric mobility",
  "Scooter accessories",
  "Safety on the move",
  "Style & essentials",
  "Power & charging",
];

export const trust = {
  label: "VERIFIED",
  score: "4.8 out of 5",
  basedOn: "Based on 2,595 reviews",
  grade: "Excellent",
};

export const deliverySteps = [
  { icon: "cart", label: "Ordered", minDays: 0, maxDays: 0 },
  { icon: "truck", label: "Order ready", minDays: 2, maxDays: 3 },
  { icon: "gift", label: "Delivered", minDays: 6, maxDays: 7 },
];

export const reviewSummary = {
  average: 4.9,
  total: 312,
  distribution: { 5: 295, 4: 8, 3: 5, 2: 3, 1: 1 } as Record<number, number>,
};

// The 312 customer reviews live in src/data/reviews.json (name, stars, text, photos).

export const footer = {
  serviceTitle: "CUSTOMER SERVICE",
  address: "Vortex UK · London, United Kingdom",
  email: "support@vortexuk.co.uk",
  policiesTitle: "POLICIES",
  policies: [
    "Legal notice",
    "Privacy policy",
    "Refund policy",
    "Shipping policy",
    "Terms of service",
  ],
  newsletterTitle: "Subscribe to our newsletter",
  newsletterText: "Get exclusive offers, news and special discounts straight to your inbox.",
  paymentTitle: "Payment methods",
  payments: ["Mastercard", "Visa", "Diners Club", "Discover"],
  copyright: "© 2026, Vortex UK",
  reseller: "Authorised reseller",
};
