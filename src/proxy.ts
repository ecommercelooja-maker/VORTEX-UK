import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção otimista do dashboard: sem cookie de sessão, /admin/* redireciona para o login.
 * A verificação criptográfica completa acontece no servidor (requireAdmin / isAdminAuthenticated)
 * em cada página e server action — este proxy só evita renderizar o layout para anônimos.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("vortex_admin")?.value;
    if (!token || !/^admin\.\d+\.[A-Za-z0-9_-]+$/.test(token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
