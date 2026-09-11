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

## Connecting a custom domain

1. Buy the domain (e.g. at Hostinger).
2. From this folder, in PowerShell, run:

   ```powershell
   .\scripts\connect-domain.ps1 -Domain example.co.uk
   ```

   This adds `example.co.uk` and `www.example.co.uk` to the Vercel project, sets
   `NEXT_PUBLIC_SITE_URL=https://example.co.uk` for Production and redeploys.
3. At the registrar create the DNS records:

   | Type  | Name | Value                  |
   | ----- | ---- | ---------------------- |
   | A     | @    | 76.76.21.21            |
   | CNAME | www  | cname.vercel-dns.com   |

4. Wait for DNS to propagate; Vercel issues the SSL certificate automatically.
5. Update `src/data/company.ts` (support e-mail on the new domain, company details) and redeploy.

The site keeps working on https://vortex-uk.vercel.app in the meantime.
