"use client";
import Link from "next/link";
import { footer } from "@/data/product";
import { company, policyLinks } from "@/data/company";
import { PaymentIcon } from "./Icons";

export default function Footer() {
  return (
    <footer className="mt-10 bg-black pb-24 text-sm text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <h2 className="font-heading text-2xl">{footer.serviceTitle}</h2>
          <p className="mt-3 text-white/70">{company.legalName}</p>
          <p className="text-white/70">{company.registeredOffice}</p>
          <p className="mt-1 text-white/70">
            E-mail:{" "}
            <a href={`mailto:${company.email}`} className="underline hover:text-white">
              {company.email}
            </a>
          </p>
          <p className="mt-1 text-white/70">{company.serviceHours}</p>
        </div>
        <div>
          <h2 className="font-heading text-2xl">{footer.policiesTitle}</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-white/70">
            {policyLinks.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="hover:text-white hover:underline">
                  {p.label}
                </Link>
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
          <p className="mt-2 text-xs text-white/50">
            By subscribing you agree to receive marketing e-mails from {company.tradingName}. You can unsubscribe at any time. See our{" "}
            <Link href="/privacy-policy" className="underline hover:text-white">
              privacy policy
            </Link>
            .
          </p>
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
          {footer.copyright} · {footer.reseller} · Company no. {company.companyNumber}
        </div>
      </div>
    </footer>
  );
}
