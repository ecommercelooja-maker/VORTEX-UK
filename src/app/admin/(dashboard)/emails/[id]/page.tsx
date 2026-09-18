import { redirect } from "next/navigation";

export default async function EmailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/mensagens/${id}`);
}
