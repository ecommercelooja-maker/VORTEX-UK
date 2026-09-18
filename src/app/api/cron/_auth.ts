import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Cron da Vercel envia `Authorization: Bearer $CRON_SECRET`; schedulers externos podem usar `?token=`. */
export function cronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : req.nextUrl.searchParams.get("token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
