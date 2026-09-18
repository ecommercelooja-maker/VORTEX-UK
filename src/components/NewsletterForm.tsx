"use client";
import { useState } from "react";
import { getCrmSessionId } from "./CrmTracker";

/*
 * Formulário de newsletter do rodapé (antes era decorativo). Agora registra o contato no CRM
 * com consentimento de marketing por e-mail (texto de consentimento logo abaixo do campo).
 * Mesmo visual de antes; só acrescenta a mensagem de confirmação/erro.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/crm/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact_captured",
          session_id: getCrmSessionId(),
          path: location.pathname,
          contact: { email, marketing_email_opt_in: true },
          metadata: { source: "newsletter" },
        }),
      });
      setState(res.ok ? "done" : "error");
      if (res.ok) setEmail("");
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <form className="mt-4 flex overflow-hidden rounded-full border border-white/30 bg-white" onSubmit={submit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          aria-label="E-mail"
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-black outline-none"
        />
        <button type="submit" disabled={state === "sending"} className="btn-gradient px-5 text-xs font-bold text-white disabled:opacity-70">
          SUBSCRIBE
        </button>
      </form>
      {state === "done" && (
        <p className="mt-2 text-xs text-accent" role="status">
          Thank you! You&apos;re subscribed.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-xs text-red-300" role="alert">
          We couldn&apos;t save your e-mail just now. Please try again.
        </p>
      )}
    </>
  );
}

