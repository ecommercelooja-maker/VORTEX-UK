import Image from "next/image";
import type { ReactNode } from "react";
import { CHECKOUT_URL } from "@/data/product";

/*
 * Product description rebuilt as HTML (the original French page used images with baked-in text).
 * Same 11 blocks, same order, written in British English with UK units (mph / miles).
 */

const IMG = (n: number) => `/produto/${String(n).padStart(2, "0")}.jpg`;

function Photo({ n, alt, className = "" }: { n: number; alt: string; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-2xl bg-white ${className}`}>
      <Image src={IMG(n)} alt={alt} fill sizes="(min-width: 896px) 448px, 100vw" className="object-cover" />
    </div>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase leading-tight tracking-wide">{children}</li>;
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="text-center">
      <div className="font-heading text-2xl leading-none text-accent">{big}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide">{small}</div>
    </div>
  );
}

export default function Description() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10" aria-label="Product description">
      {/* 1 — Exclusive offer */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] text-white">
        <div className="grid items-center gap-6 p-6 sm:grid-cols-[1fr_1.4fr] sm:p-10">
          <div className="font-heading text-6xl tracking-wide text-accent sm:text-7xl">VORTEX</div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/80">Exclusive Vortex offer</div>
            <h2 className="font-heading mt-2 text-4xl leading-none sm:text-5xl">
              <span className="text-accent">10% off</span> your first order
            </h2>
            <p className="mt-3 text-sm text-white/80">Buy today and enjoy an exclusive discount for new customers.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold">
              <span className="rounded bg-white px-2 py-1 text-[#1a1f71]">VISA</span>
              <span className="rounded bg-white px-2 py-1 text-black">Mastercard</span>
              <span className="rounded bg-[#2e77bc] px-2 py-1">AMEX</span>
              <span className="rounded bg-white px-2 py-1 text-black">G Pay</span>
              <span className="text-white/80">🔒 100% secure payment</span>
              <span className="ml-auto rounded-full bg-accent px-3 py-2 font-heading text-xl leading-none text-black">-10%</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-3 text-center text-xs font-semibold sm:text-sm">
          100% secure payment • Free delivery across the UK • Official 3-year warranty
          <div className="mt-1 text-[11px] font-normal text-white/50">The discount is applied automatically to your first order.</div>
        </div>
      </div>

      {/* 2 — Hero */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] text-white">
        <div className="p-6 text-center sm:p-10">
          <div className="font-heading text-lg tracking-widest text-white/70">VORTEX Z10</div>
          <h2 className="font-heading mt-1 text-5xl leading-none sm:text-6xl">VORTEX Z10</h2>
          <div className="font-heading mt-2 text-5xl leading-none text-accent sm:text-7xl">UP TO 4,000 W</div>
          <div className="font-heading mt-2 text-2xl text-white/90 sm:text-3xl">UP TO 40 MPH (65 KM/H) · DUAL MOTOR AWD</div>
        </div>
        <Photo n={1} alt="VORTEX Z10 electric scooter, front three-quarter view" className="mx-auto max-w-lg rounded-none" />
        <div className="p-6 text-center sm:p-8">
          <p className="font-heading text-2xl sm:text-3xl">The high-performance all-terrain electric scooter.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-10 gap-y-2 border-t border-white/10 pt-4 text-xs font-bold uppercase tracking-wider text-white/80">
            <span>Free delivery across the UK</span>
            <span>3-year warranty</span>
          </div>
        </div>
      </div>

      {/* 3 — Power */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] p-6 text-white sm:p-10">
        <h2 className="font-heading text-center text-4xl leading-none sm:text-5xl">
          <span className="text-accent">4,000 W</span> of peak power
        </h2>
        <Photo n={3} alt="VORTEX Z10 side view showing both wheel motors" className="mt-6" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat big="2" small="Dual motor" />
          <Stat big="AWD" small="All-wheel drive" />
          <Stat big="2,000 W" small="Rated power" />
          <Stat big="40%" small="Max gradient" />
        </div>
        <p className="mt-6 text-center font-heading text-xl tracking-wide sm:text-2xl">Power built to go further.</p>
      </div>

      {/* 4 — Range */}
      <div className="overflow-hidden rounded-xl bg-[#f3f6e8] p-6 text-black sm:p-10">
        <h2 className="font-heading text-center text-4xl leading-none sm:text-5xl">
          Up to <span className="text-accent-dark">75 miles</span> of range
        </h2>
        <p className="mt-2 text-center text-sm font-semibold">60 V · 25 Ah · 1,500 Wh (120 km)</p>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
          <Photo n={4} alt="VORTEX Z10 with folded handlebar" />
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center justify-between rounded-full bg-white px-4 py-3 shadow-sm">
              <span className="font-semibold uppercase">Eco</span>
              <span>
                up to <b className="text-accent-dark">75 mi</b> (120 km)
              </span>
            </li>
            <li className="flex items-center justify-between rounded-full bg-white px-4 py-3 shadow-sm">
              <span className="font-semibold uppercase">Normal</span>
              <span>
                up to <b className="text-accent-dark">56 mi</b> (90 km)
              </span>
            </li>
            <li className="flex items-center justify-between rounded-full bg-white px-4 py-3 shadow-sm">
              <span className="font-semibold uppercase">Sport</span>
              <span>
                <b className="text-accent-dark">37–43 mi</b> (60–70 km)
              </span>
            </li>
            <li className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-black/70">
              🔌 Charging: 6 to 7 hours · dual charging port
            </li>
          </ul>
        </div>
        <p className="mt-6 text-center font-heading text-2xl sm:text-3xl">More distance. Fewer limits.</p>
      </div>

      {/* 5 — Terrain */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] p-6 text-white sm:p-10">
        <h2 className="font-heading text-4xl leading-none sm:text-5xl">
          Built for <span className="text-accent">rough terrain.</span>
        </h2>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
          <Photo n={2} alt="VORTEX Z10 front view with dual suspension" />
          <ul className="grid gap-2">
            <Callout>11&quot; tubeless all-terrain tyres</Callout>
            <Callout>Dual inverted hydraulic front suspension</Callout>
            <Callout>Adjustable hydraulic rear suspension</Callout>
            <Callout>Wide longboard-style deck</Callout>
          </ul>
        </div>
        <p className="mt-6 text-center font-heading text-2xl tracking-wider sm:text-3xl">Grip • Stability • Comfort</p>
      </div>

      {/* 6 — Control */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] p-6 text-white sm:p-10">
        <h2 className="font-heading text-center text-4xl leading-none sm:text-5xl">Stay in control</h2>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
          <ul className="grid gap-2 sm:order-1">
            <Callout>Hydraulic disc brakes, front + rear</Callout>
            <Callout>Smart E-ABS</Callout>
            <Callout>Twin front headlights</Callout>
            <Callout>360° LED lighting</Callout>
            <Callout>Built-in indicators</Callout>
            <Callout>Rear light</Callout>
          </ul>
          <Photo n={7} alt="VORTEX Z10 rear view with brake light on" />
        </div>
      </div>

      {/* 7 — Connected */}
      <div className="overflow-hidden rounded-xl bg-[#eef1f4] p-6 text-black sm:p-10">
        <h2 className="font-heading text-4xl leading-none sm:text-5xl">
          More than a scooter.
          <br />A connected system.
        </h2>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
          <ul className="grid grid-cols-1 gap-2 text-sm font-bold uppercase tracking-wide">
            {[
              "4\" colour LCD display",
              "Bluetooth",
              "Mobile app",
              "Built-in GPS",
              "Remote lock",
              "Real-time telemetry",
              "NFC unlock",
              "Built-in alarm",
              "Anti-theft tracking",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dark text-white">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Photo n={6} alt="VORTEX Z10 seen from above, display and NFC key fob" />
        </div>
      </div>

      {/* 8 — Freedom */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] text-white">
        <div className="p-6 text-center sm:p-10">
          <h2 className="font-heading text-4xl leading-none sm:text-5xl">Your journey. Your freedom.</h2>
          <p className="font-heading mt-2 text-2xl tracking-widest text-white/80">City • Road • Off-road</p>
        </div>
        <Photo n={5} alt="VORTEX Z10 folded, side view" className="mx-auto max-w-lg rounded-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
          <div className="flex gap-3">
            {[
              ["40 mph", "top speed"],
              ["75 mi", "range"],
              ["AWD", "dual motor"],
            ].map(([b, s]) => (
              <div key={b} className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-black">
                <span className="font-heading text-xl leading-none">{b}</span>
                <span className="text-[10px] font-semibold uppercase">{s}</span>
              </div>
            ))}
          </div>
          <span className="rounded bg-white px-3 py-2 text-sm font-bold text-black">
            3-year <b>warranty</b>
          </span>
        </div>
      </div>

      {/* 9 — Built to perform */}
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white p-6 text-black sm:p-10">
        <h2 className="font-heading text-center text-4xl leading-none sm:text-5xl">Built to perform</h2>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
          <Photo n={1} alt="VORTEX Z10 product shot" />
          <ul className="grid gap-2 text-sm font-bold uppercase tracking-wide">
            {[
              "Hydraulic suspension",
              "IPX6 protection",
              "11\" tubeless off-road tyres",
              "Wide longboard-style deck",
              "Aerospace-grade aluminium alloy chassis",
            ].map((f) => (
              <li key={f} className="rounded-lg bg-surface px-3 py-2">
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-6 max-w-md rounded-xl border-2 border-accent p-4 text-center text-sm font-bold uppercase tracking-wide">
          Max load: 150 kg
          <br />
          Weight: approx. 32 kg
          <br />
          Withstands heavy rain
        </div>
      </div>

      {/* 10 — In the box */}
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white p-6 text-black sm:p-10">
        <h2 className="font-heading text-4xl leading-none sm:text-5xl">Everything you need to get started.</h2>
        <ul className="mt-4 grid gap-1 text-base font-bold uppercase tracking-wide">
          <li>■ 1 × VORTEX Z10</li>
          <li>■ 1 × Charger (UK plug)</li>
          <li>■ 1 × User manual</li>
          <li>■ 1 × Basic tool kit</li>
        </ul>
        <Photo n={4} alt="VORTEX Z10 folded for storage" className="mt-6" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-full bg-accent px-5 py-3 text-center text-sm font-bold uppercase text-black">🚚 Free delivery across the UK</div>
          <div className="rounded-full bg-accent px-5 py-3 text-center text-sm font-bold uppercase text-black">🛡 3-year warranty</div>
        </div>
      </div>

      {/* 11 — Summary */}
      <div className="overflow-hidden rounded-xl bg-[#0f1113] p-6 text-white sm:p-10">
        <h2 className="font-heading text-center text-5xl leading-none sm:text-6xl">
          VORTEX <span className="text-accent">Z10</span>
        </h2>
        <p className="font-heading mt-2 text-center text-2xl text-accent sm:text-3xl">High performance. All-terrain. No compromise.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1.2fr_1fr]">
          <ul className="flex flex-col gap-3 text-sm font-bold uppercase">
            <li>⚡ 4,000 W max.</li>
            <li>⏱ 40 mph (65 km/h)</li>
            <li>📍 75 miles (120 km) max.</li>
            <li>🔁 AWD</li>
          </ul>
          <Photo n={3} alt="VORTEX Z10 side view" />
          <ul className="flex flex-col gap-3 text-sm font-bold uppercase">
            <li>🔋 60 V • 25 Ah</li>
            <li>🛞 11&quot; off-road</li>
            <li>🛑 E-ABS</li>
            <li>📡 GPS + app</li>
            <li>💧 IPX6</li>
          </ul>
        </div>
        <p className="mt-8 text-center font-heading text-2xl sm:text-3xl">Step into a new generation of electric mobility.</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-bold uppercase tracking-wider">
          <span>
            Free delivery
            <br />
            across the UK
          </span>
          <a href={CHECKOUT_URL} className="rounded-lg bg-accent px-6 py-3 font-heading text-2xl leading-none text-black">
            Discover the Vortex Z10
          </a>
          <span>
            3-year <span className="text-accent">warranty</span>
          </span>
        </div>
      </div>
    </section>
  );
}
