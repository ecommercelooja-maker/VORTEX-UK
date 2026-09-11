import type { MetadataRoute } from "next";
import { policyLinks } from "@/data/company";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vortex-uk.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL + "/", lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...policyLinks.map((p) => ({ url: SITE_URL + p.href, lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
