import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/crm/auth";
import { isSupabaseConfigured } from "@/lib/crm/supabase";
import { STORE_ID, STORE_NAME } from "@/lib/crm/config";
import { logoutAction } from "../actions";
import { Notice } from "../ui";

export const metadata: Metadata = { title: `CRM · ${STORE_NAME}`, robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/vendas", label: "🔴 Ao vivo" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/carrinhos", label: "Carrinhos abandonados" },
  { href: "/admin/pedidos", label: "Pedidos e rastreio" },
  { href: "/admin/automacoes", label: "Automações" },
  { href: "/admin/mensagens", label: "Mensagens enviadas" },
  { href: "/admin/assistente", label: "Assistente I.A." },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAdminConfigured() || !(await isAdminAuthenticated())) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-surface text-black">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-heading text-2xl">{STORE_NAME}</span>
            <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-semibold text-white">CRM · {STORE_ID}</span>
          </div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 font-semibold text-black/70 hover:bg-surface hover:text-black">
                {n.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button type="submit" className="rounded-full px-3 py-1.5 text-black/50 hover:text-black">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {!isSupabaseConfigured() ? (
          <Notice tone="error">
            Supabase não configurado. Defina <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> (servidor) e execute a migration em{" "}
            <code>supabase/migrations/20260911120000_crm.sql</code>.
          </Notice>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
