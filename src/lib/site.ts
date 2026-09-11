// Single source of truth for the public URL of the site.
// Set NEXT_PUBLIC_SITE_URL in Vercel (Production) to the custom domain, e.g. https://www.example.co.uk
// Everything that needs an absolute URL (canonical, Open Graph, robots.txt, sitemap.xml, policies) reads it from here.
const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "vortex-uk.vercel.app";
const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;

export const SITE_URL = withProtocol.replace(/\/+$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
