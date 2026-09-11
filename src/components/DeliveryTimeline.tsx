"use client";
import { useSyncExternalStore } from "react";
import { deliverySteps } from "@/data/product";
import { Cart, Gift, Truck } from "./Icons";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function range(min: number, max: number, now: Date) {
  const a = new Date(now);
  a.setDate(a.getDate() + min);
  if (min === max) return fmt.format(a);
  const b = new Date(now);
  b.setDate(b.getDate() + max);
  return `${fmt.format(a)} - ${fmt.format(b)}`;
}

const icons = { cart: Cart, truck: Truck, gift: Gift };

const subscribe = () => () => {};
const getToday = () => new Date().toDateString();
const getServerToday = () => null;

export default function DeliveryTimeline() {
  // Dates are computed in the browser only, to avoid a server/client mismatch.
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);
  const now = today ? new Date(today) : null;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-black/10 bg-surface px-3 py-4 text-center">
      {deliverySteps.map((s, i) => {
        const Icon = icons[s.icon as keyof typeof icons];
        return (
          <div key={s.label} className="relative flex flex-col items-center gap-1">
            {i > 0 && <span className="absolute left-[-50%] top-4 h-px w-full bg-black/20" aria-hidden="true" />}
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-accent-dark shadow">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold">{now ? range(s.minDays, s.maxDays, now) : " "}</span>
            <span className="text-xs text-black/60">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
