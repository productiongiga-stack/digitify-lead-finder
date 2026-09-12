import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight middleware — checks session cookie instead of importing full auth.
 * This keeps the Edge Function under the 1 MB size limit.
 *
 * Rules:
 * - /login, /register → if logged in, redirect to /
 * - /[workspaceSlug]/* → if not logged in, redirect to /login
 * - /api/public/* → always allow (public endpoints)
 * - /configure/*, /embed/*, /book/*, /proposal/* → always allow (public pages)
 * - / → allow (landing page handles its own redirect)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for NextAuth session cookie (works with JWT strategy)
  const sessionToken =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value;

  const isLoggedIn = !!sessionToken;

  // Public routes — never block
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/configure") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/proposal") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Auth pages — redirect to / if already logged in
  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Auth pages — allow if not logged in
  if (isAuthPage) {
    return NextResponse.next();
  }

  // All other routes require auth
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public embed assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|embed/widget.js).*)",
  ],
};
