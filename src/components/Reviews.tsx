"use client";
import Image from "next/image";
import { useState } from "react";
import { reviewSummary } from "@/data/product";
import reviewsData from "@/data/reviews.json";
import { Stars } from "./Icons";

type Review = { name: string; stars: number; text: string; images: string[] };
const reviews = reviewsData as Review[];

const PAGE = 16;
const CLAMP = 140;
type Filter = "all" | "with" | "without";

function Verified() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-dark text-white" title="Verified purchase" aria-label="Verified purchase">
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.text.length > CLAMP;
  const text = open || !long ? r.text : r.text.slice(0, CLAMP).trimEnd() + "…";
  return (
    <li className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      {r.images.length > 0 && (
        <div className={`grid gap-0.5 ${r.images.length > 1 ? "grid-cols-2" : ""}`}>
          {r.images.map((src) => (
            <div key={src} className="relative aspect-[4/5]">
              <Image src={src} alt={`Photo submitted by ${r.name}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-4">
        <Stars value={r.stars} color="text-[#f5a623]" />
        <div className="flex items-center gap-1.5 text-sm font-bold">
          {r.name}
          <Verified />
        </div>
        <p className="text-sm leading-relaxed text-black/75">{text}</p>
        {long && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-xs font-semibold text-black/60 underline underline-offset-2 hover:text-black">
            {open ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </li>
  );
}

export default function Reviews() {
  const [stars, setStars] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);

  const list = reviews.filter(
    (r) =>
      (stars === null || r.stars === stars) &&
      (filter === "all" || (filter === "with" ? r.images.length > 0 : r.images.length === 0)),
  );

  const photos = reviews.flatMap((r) => r.images);

  return (
    <section id="reviews" className="border-t border-black/10 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="font-heading text-center text-4xl sm:text-5xl">Customer reviews</h2>

        <div className="mx-auto mt-8 grid max-w-3xl gap-8 rounded-2xl border border-black/10 bg-white p-6 md:grid-cols-[200px_1fr]">
          <div className="text-center">
            <div className="font-heading text-7xl leading-none">{reviewSummary.average}</div>
            <div className="mt-2 flex justify-center">
              <Stars value={reviewSummary.average} className="h-6 w-6" color="text-[#f5a623]" />
            </div>
            <div className="mt-1 text-sm text-black/60">Based on {reviewSummary.total} reviews</div>
          </div>
          <div className="flex flex-col justify-center gap-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = reviewSummary.distribution[n] ?? 0;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setStars(stars === n ? null : n);
                    setShown(PAGE);
                  }}
                  className={`flex items-center gap-3 text-sm ${stars === n ? "font-bold" : ""}`}
                  aria-pressed={stars === n}
                >
                  <span className="w-3">{n}</span>
                  <svg viewBox="0 0 28 28" className="h-3.5 w-3.5 text-[#f5a623]" fill="currentColor" aria-hidden="true">
                    <path d="M12.701 3.908c.532-1.078 2.069-1.078 2.6 0l2.692 5.452l6.017.875c1.19.173 1.664 1.634.804 2.473l-4.355 4.244l1.028 5.993c.204 1.185-1.04 2.088-2.103 1.529l-5.382-2.83l-5.382 2.83c-1.064.559-2.307-.344-2.104-1.529l1.028-5.993l-4.355-4.244c-.86-.839-.385-2.3.804-2.473l6.017-.875z" />
                  </svg>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/10">
                    <span className="block h-full rounded-full bg-[#f5a623]" style={{ width: `${(c / reviewSummary.total) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-black/60">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/60">Customer photos</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((src) => (
              <div key={src} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-28">
                <Image src={src} alt="Customer photo" fill sizes="112px" className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold text-white">
            Write a review
          </button>
          <div className="flex gap-2 text-sm">
            {(["all", "with", "without"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setShown(PAGE);
                }}
                className={`rounded-full px-3 py-1 ${filter === f ? "btn-gradient text-white" : "bg-white"}`}
              >
                {f === "all" ? "All" : f === "with" ? "With images" : "Without images"}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-4">
          {list.slice(0, shown).map((r, i) => (
            <ReviewCard key={`${r.name}-${i}`} r={r} />
          ))}
        </ul>

        <div className="mt-2 text-center text-sm text-black/60">
          {Math.min(shown, list.length)} of {list.length} reviews
        </div>
        {shown < list.length && (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setShown((s) => s + PAGE)} className="btn-gradient rounded-full px-6 py-2.5 text-sm font-semibold text-white">
              Load more
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
