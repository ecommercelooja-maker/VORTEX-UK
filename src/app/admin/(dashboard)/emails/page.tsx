import { redirect } from "next/navigation";

/** A aba "E-mails" virou "Mensagens enviadas" (e-mail + WhatsApp + SMS). Mantém links antigos funcionando. */
export default async function EmailsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) q.set(k, v);
  if (!q.has("c")) q.set("c", "email");
  redirect(`/admin/mensagens?${q.toString()}`);
}
