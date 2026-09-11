import { SITE_URL } from "@/lib/site";

// Legal identity used across the policy pages and the footer.
// Fill in the bracketed placeholders before going live — UK law (Companies Act 2006,
// E-Commerce Regulations 2002) and Google Merchant/Ads policies require them to be accurate.

export const company = {
  tradingName: "Vortex UK",
  legalName: "[Legal company name] Ltd",
  companyNumber: "[Company number]",
  vatNumber: "[VAT number, if registered]",
  icoNumber: "[ICO registration number]",
  registeredOffice: "[Registered office address], London, United Kingdom",
  email: "support@vortexuk.co.uk",
  phone: "[Customer service phone number]",
  website: SITE_URL,
  serviceHours: "Monday to Friday, 9am to 5pm (UK time)",
  lastUpdated: "11 September 2026",
};

export const policyLinks = [
  { label: "Legal notice", href: "/legal-notice" },
  { label: "Privacy policy", href: "/privacy-policy" },
  { label: "Cookie policy", href: "/cookie-policy" },
  { label: "Terms of service", href: "/terms-of-service" },
  { label: "Refund policy", href: "/refund-policy" },
  { label: "Shipping policy", href: "/shipping-policy" },
];
