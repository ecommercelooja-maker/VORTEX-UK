import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/crm/auth";
import { STORE_NAME } from "@/lib/crm/config";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: `Entrar · CRM ${STORE_NAME}`, robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (isAdminConfigured() && (await isAdminAuthenticated())) redirect("/admin");
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6">
        <h1 className="font-heading text-3xl">{STORE_NAME} · CRM</h1>
        <p className="mt-1 text-sm text-black/60">Área restrita. Informe a senha do dashboard.</p>
        {!isAdminConfigured() ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Defina <code>ADMIN_PASSWORD</code> e <code>ADMIN_SESSION_SECRET</code> nas variáveis de ambiente para habilitar o acesso.
          </p>
        ) : (
          <LoginForm next={next ?? ""} />
        )}
      </div>
    </div>
  );
}
