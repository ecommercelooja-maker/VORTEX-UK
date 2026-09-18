"use client";

import { useEffect } from "react";

/**
 * Tela de erro do dashboard (error boundary do App Router). Em vez da tela branca "Application error",
 * mostra o motivo e oferece tentar de novo. Causas comuns: Supabase lento (Gateway Timeout) ou a guia
 * aberta antes de um deploy novo (server action antiga) — nesse caso recarregar resolve.
 */
export default function AdminError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => {
    console.error("[admin] erro na página", error);
  }, [error]);
  const msg = error?.message || "erro desconhecido";
  const stale = /server action|failed to find|deployment|Failed to fetch/i.test(msg);
  const slow = /timeout|gateway|502|503|504|fetch failed/i.test(msg);
  const tryAgain = retry ?? reset ?? (() => window.location.reload());
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
      <h1 className="font-heading text-3xl">Algo deu errado</h1>
      <p className="mt-2 text-sm">
        {stale
          ? "A página ficou aberta durante uma atualização do sistema. Recarregue para pegar a versão nova."
          : slow
            ? "O banco de dados (Supabase) demorou para responder. Isso acontece no plano gratuito quando ele está \"acordando\"; tente de novo em alguns segundos."
            : "Ocorreu um erro inesperado ao carregar esta página."}
      </p>
      <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-white/70 p-3 text-xs text-red-800">
        {msg}
        {error?.digest ? `\n(digest ${error.digest})` : ""}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => tryAgain()} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/80">
          Tentar de novo
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-black/20 bg-white px-4 py-2 text-sm font-semibold hover:bg-surface">
          Recarregar a página
        </button>
      </div>
    </div>
  );
}
