import type { Metadata } from "next";
import { Bebas_Neue, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vortex-uk.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VORTEX Z10 2x2 app-connected electric scooter – Vortex UK",
  description:
    "VORTEX Z10 2x2 app-connected electric scooter. Up to 4,000 W, dual motor AWD, 75-mile range. Free express delivery across the UK and a 60-day money-back guarantee.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "VORTEX Z10 2x2 app-connected electric scooter.",
    images: ["/produto/01.jpg"],
    locale: "en_GB",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${figtree.variable} ${bebas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
