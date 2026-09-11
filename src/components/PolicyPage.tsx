import type { ReactNode } from "react";
import Link from "next/link";
import AnnouncementBar from "./AnnouncementBar";
import Footer from "./Footer";
import Header from "./Header";
import { company, policyLinks } from "@/data/company";

export default function PolicyPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          <aside className="mb-8 lg:mb-0">
            <div className="sticky top-6 rounded-xl border border-black/10 bg-surface p-4 text-sm">
              <div className="mb-2 font-heading text-lg">Legal</div>
              <ul className="flex flex-col gap-1.5">
                {policyLinks.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className="text-black/70 underline-offset-4 hover:text-black hover:underline">
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          <article className="policy min-w-0">
            <h1 className="font-heading text-4xl sm:text-5xl">{title}</h1>
            <p className="mt-2 text-sm text-black/60">Last updated: {company.lastUpdated}</p>
            {intro && <p className="mt-4 text-base text-black/80">{intro}</p>}
            <div className="mt-6">{children}</div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
