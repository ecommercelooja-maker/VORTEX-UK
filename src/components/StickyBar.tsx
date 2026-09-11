"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { CHECKOUT_URL, product } from "@/data/product";

export default function StickyBar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <Image src={product.gallery[0]} alt="" width={48} height={48} className="hidden h-12 w-12 rounded-lg object-cover sm:block" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{product.title}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-accent-dark">{product.price}</span>
            <s className="text-black/50">{product.comparePrice}</s>
            <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">{product.discountLabel}</span>
          </div>
        </div>
        <a href={CHECKOUT_URL} className="btn-gradient rounded-full px-5 py-2.5 text-sm font-bold text-white shadow">
          {product.stickyCtaLabel}
        </a>
      </div>
    </div>
  );
}
