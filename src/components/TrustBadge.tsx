import { trust } from "@/data/product";
import { Stars } from "./Icons";

export default function TrustBadge() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm">
      <span className="flex items-center gap-1 font-bold">
        <span className="inline-block h-4 w-4 text-[#00b67a]">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 9.5 9H2l6 4.5L5.7 21 12 16.5 18.3 21 16 13.5 22 9h-7.5z" />
          </svg>
        </span>
        {trust.label}
      </span>
      <Stars value={5} color="text-[#00b67a]" className="h-5 w-5" />
      <span className="font-semibold">{trust.score}</span>
      <span className="text-black/60">{trust.basedOn}</span>
      <span className="rounded bg-[#00b67a] px-2 py-0.5 text-xs font-bold text-white">{trust.grade}</span>
    </div>
  );
}
