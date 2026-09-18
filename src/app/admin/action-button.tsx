"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/** Botão que executa uma server action e mostra o resultado inline. */
export default function ActionButton({
  action,
  label,
  pendingLabel,
  confirm,
  className = "rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-60",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            try {
              setResult(await action());
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (/server action|failed to find|deployment|unexpected response/i.test(msg)) {
                setResult({ ok: false, error: "O sistema foi atualizado enquanto a página estava aberta. Recarregando…" });
                setTimeout(() => window.location.reload(), 1200);
                return;
              }
              setResult({ ok: false, error: msg });
            }
          });
        }}
      >
        {pending ? pendingLabel ?? "…" : label}
      </button>
      {result && <span className={`max-w-md text-[11px] ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.ok ? result.message ?? "OK" : result.error}</span>}
    </span>
  );
}
