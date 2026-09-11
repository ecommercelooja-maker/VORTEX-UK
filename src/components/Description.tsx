import Image from "next/image";
import Link from "next/link";
import { product } from "@/data/product";

/*
 * Long description: the same 11 artwork panels used on the French store,
 * re-lettered in British English (public/desc/01-11.jpg).
 */
export default function Description() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10" aria-label="Product description">
      {product.descriptionImages.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={`${product.title} - detail ${i + 1}`}
          width={1024}
          height={1024}
          sizes="(min-width: 896px) 896px, 100vw"
          className="h-auto w-full rounded-xl"
        />
      ))}
      {/* Pre-contractual information: UK road-use rules for privately owned e-scooters */}
      <p className="mt-2 text-center text-[11px] leading-snug text-black/60">
        Warning: in the UK, privately owned electric scooters may only be ridden on private land with the landowner&apos;s permission. The VORTEX Z10 is not approved for use on public roads, cycle lanes or pavements. A helmet and protective equipment are recommended. See our{" "}
        <Link href="/terms-of-service" className="underline">
          terms of service
        </Link>
        .
      </p>
    </section>
  );
}
