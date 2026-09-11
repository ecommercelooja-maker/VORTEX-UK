import { announcements } from "@/data/product";
import { Box, Storefront } from "./Icons";

export default function AnnouncementBar() {
  return (
    <div className="bg-black text-[13px] font-semibold tracking-wide text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-1 px-4 py-2">
        {announcements.map((a) => (
          <span key={a.text} className="inline-flex items-center gap-2">
            {a.icon === "box" ? <Box className="h-4 w-4 text-accent" /> : <Storefront className="h-4 w-4 text-accent" />}
            {a.text}
          </span>
        ))}
      </div>
    </div>
  );
}
