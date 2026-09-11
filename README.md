# VORTEX UK

Sales page for the **VORTEX Z10** electric scooter, UK edition (British English, GBP, UK units).
Built with Next.js 16 + Tailwind CSS 4. Sister project of `vortex-loja-2` (French page).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where the content lives

- `src/data/product.ts` — price, title, bullets, checkout link (`CHECKOUT_URL`), footer, navigation.
- `src/data/reviews.json` — the 312 customer reviews (name, stars, text, photos).
- `src/components/Description.tsx` — the long product description (HTML, not images).
- `public/produto/` — product photos, `public/reviews/` — customer photos.

## Deploy

Hosted on Vercel (project `vortex-uk`, team ecommercelooja). Set `NEXT_PUBLIC_SITE_URL`
to the production domain so canonical URLs, robots.txt and sitemap.xml point to it.
