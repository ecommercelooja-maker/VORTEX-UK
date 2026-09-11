# Connects a custom domain to the Vercel project "vortex-uk" and points the site at it.
# Usage (PowerShell, from the project folder):
#   .\scripts\connect-domain.ps1 -Domain example.co.uk
#
# What it does:
#   1. adds example.co.uk and www.example.co.uk to the Vercel project (www redirects to the apex)
#   2. sets NEXT_PUBLIC_SITE_URL=https://example.co.uk for Production (canonical, sitemap, robots, policies)
#   3. redeploys to production
# Then create the DNS records at your registrar (Hostinger etc.):
#   A     @    76.76.21.21
#   CNAME www  cname.vercel-dns.com
# Vercel issues the SSL certificate automatically once DNS resolves (usually within minutes, up to 48 h).

param(
  [Parameter(Mandatory = $true)] [string] $Domain,
  [string] $Scope = "ecommercelooja",
  [switch] $PreferWww   # use https://www.<domain> as the canonical URL instead of the apex
)

$ErrorActionPreference = "Stop"
$Domain = $Domain.ToLower().Trim() -replace '^https?://', '' -replace '^www\.', '' -replace '/$', ''
$www = "www.$Domain"
$canonical = if ($PreferWww) { "https://$www" } else { "https://$Domain" }

Write-Host "==> Adding domains to project vortex-uk ($Scope)"
vercel domains add $Domain vortex-uk --scope $Scope
vercel domains add $www vortex-uk --scope $Scope

Write-Host "==> Setting NEXT_PUBLIC_SITE_URL=$canonical (production)"
vercel env rm NEXT_PUBLIC_SITE_URL production --yes --scope $Scope 2>$null
$canonical | vercel env add NEXT_PUBLIC_SITE_URL production --scope $Scope

Write-Host "==> Redeploying to production"
$env:GIT_DIR = "C:/nonexistent-git"
vercel --prod --yes --archive=tgz --scope $Scope

Write-Host ""
Write-Host "Done. Now create the DNS records at your registrar:"
Write-Host "  A     @    76.76.21.21"
Write-Host "  CNAME www  cname.vercel-dns.com"
Write-Host "Check status with:  vercel domains inspect $Domain --scope $Scope"
