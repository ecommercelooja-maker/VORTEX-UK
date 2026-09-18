"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Atualiza a página do servidor (router.refresh) a cada N segundos enquanto a guia está visível,
 * com botão manual e relógio "atualizado há X s". Usado na Visão geral.
 */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const clockTimer = setInterval(() => setNowMs(Date.now()), 1000);
    const refresh = () => {
      if (document.hidden) return;
      startTransition(() => router.refresh());
      setLast(Date.now());
    };
    const timer = setInterval(refresh, seconds * 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clockTimer);
    };
  }, [router, seconds]);

  const agoS = last && nowMs ? Math.max(0, Math.floor((nowMs - last) / 1000)) : null;
  return (
    <button
      type="button"
      onClick={() => {
        startTransition(() => router.refresh());
        setLast(Date.now());
      }}
      className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-surface"
      title={`Atualiza sozinho a cada ${seconds} s`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${pending ? "animate-pulse bg-amber-500" : "bg-green-500"}`} />
      {pending ? "Atualizando…" : agoS === null ? `Auto ${seconds} s` : `Atualizado há ${agoS} s`}
    </button>
  );
}
