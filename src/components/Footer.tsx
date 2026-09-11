"use client";
import { footer } from "@/data/product";
import { PaymentIcon } from "./Icons";

export default function Footer() {
  return (
    <footer className="mt-10 bg-black pb-24 text-sm text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <h2 className="font-heading text-2xl">{footer.serviceTitle}</h2>
          <p className="mt-3 text-white/70">{footer.address}</p>
          <p className="mt-1 text-white/70">
            E-mail:{" "}
            <a href={`mailto:${footer.email}`} className="underline hover:text-white">
              {footer.email}
            </a>
          </p>
        </div>
        <div>
          <h2 className="font-heading text-2xl">{footer.policiesTitle}</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-white/70">
            {footer.policies.map((p) => (
              <li key={p}>
                <a href="#" className="hover:text-white hover:underline">
                  {p}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-2xl">{footer.newsletterTitle}</h2>
          <p className="mt-3 text-white/70">{footer.newsletterText}</p>
          <form className="mt-4 flex overflow-hidden rounded-full border border-white/30 bg-white" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="E-mail"
              aria-label="E-mail"
              className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-black outline-none"
            />
            <button type="submit" className="btn-gradient px-5 text-xs font-bold text-white">
              SUBSCRIBE
            </button>
          </form>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 border-t border-white/10 px-4 py-6 text-xs text-white/60 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <span className="mr-2 font-semibold text-white/80">{footer.paymentTitle}</span>
          {footer.payments.map((p) => (
            <PaymentIcon key={p} name={p} />
          ))}
        </div>
        <div>
          {footer.copyright} · {footer.reseller}
        </div>
      </div>
    </footer>
  );
}
