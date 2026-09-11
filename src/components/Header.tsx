import Image from "next/image";
import Link from "next/link";
import { CHECKOUT_URL, nav } from "@/data/product";
import { Cart, Menu, Search, User } from "./Icons";

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-3 items-center py-3">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Menu" className="lg:hidden">
              <Menu />
            </button>
            <button type="button" aria-label="Search" className="hidden lg:block">
              <Search />
            </button>
          </div>
          <Link href="/" className="flex justify-center" aria-label="Vortex UK">
            <Image src="/logo.png" alt="Vortex UK" width={200} height={60} priority className="h-10 w-auto sm:h-12" />
          </Link>
          <div className="flex items-center justify-end gap-4">
            <button type="button" aria-label="Search" className="lg:hidden">
              <Search />
            </button>
            <a href="#" aria-label="Sign in" className="hidden lg:block">
              <User />
            </a>
            <a href={CHECKOUT_URL} aria-label="Basket">
              <Cart />
            </a>
          </div>
        </div>
        <nav className="hidden items-center justify-center gap-7 pb-3 text-[13px] text-black/80 lg:flex">
          {nav.map((n) => (
            <a key={n} href="#" className="underline-offset-4 hover:text-black hover:underline">
              {n}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
