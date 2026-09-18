"use client";
import { useActionState } from "react";
import { loginAction, type ActionResult } from "../actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="text-sm font-semibold">
        Senha
        <input type="password" name="password" required autoFocus className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2.5 outline-none focus:border-black" />
      </label>
      {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-gradient rounded-full py-2.5 font-bold text-white disabled:opacity-70">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
