import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { randomToken } from "@/lib/crypto";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

/**
 * Two jobs, deliberately kept separate and small:
 *
 * (a) Security headers on every response, including the public invite page
 *     — a nonce-based CSP plus the usual hardening headers.
 * (b) A fast, unauthenticated-looking redirect for `/admin/*` when the
 *     session cookie is simply ABSENT.
 *
 * (b) is a UX shortcut only, not a security boundary: it never validates
 * the cookie's value against the database, so a request carrying ANY cookie
 * (garbage or otherwise) sails through the middleware and reaches the page,
 * where `requireAdmin()` (`src/lib/auth.ts`) does the real, DB-backed
 * validation and redirects if invalid. Never rely on this middleware alone
 * to protect an admin route — every admin page/route calls the guard
 * independently.
 */

function buildCsp(nonce: string): string {
  const scriptSrc =
    process.env.NODE_ENV !== "production"
      ? // Next.js's dev overlay / Fast Refresh relies on eval() in dev mode;
        // this relaxation is strictly gated on non-production and never
        // ships to a deployed build.
        `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // TODO(Phase 7 - Google Analytics): add
    //   `https://www.googletagmanager.com` to script-src, and
    //   `https://*.google-analytics.com` to connect-src, right here, when
    //   GA is wired up.
    // 'unsafe-inline' is required here for Next.js's own injected <style>
    // tags (App Router streaming/critical CSS) and for next/font's inlined
    // @font-face rules. There is no nonce hook for style-src in Next.js
    // today, so style-src is deliberately looser than script-src.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

function applySecurityHeaders(request: NextRequest, response: NextResponse, nonce: string): void {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );

  // HSTS only makes sense (and is only safe) over an actual HTTPS
  // connection — sending it over plain http in local dev would be a no-op
  // at best and misleading at worst.
  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // A cached admin page/response at the edge or in a shared cache would
    // be a direct data leak — never allow it.
    response.headers.set("Cache-Control", "no-store");
  }
}

export function middleware(request: NextRequest) {
  const nonce = randomToken(16);

  // The nonce is set on the REQUEST headers (not just the response) so
  // that Next.js can read it back via the `x-nonce` header and apply it to
  // its own framework-injected inline scripts, and so server
  // components/route handlers can read it via `headers()` if they ever
  // need to render their own nonced `<script>` tag.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  if (isAdminPage && !isLoginPage) {
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSessionCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      applySecurityHeaders(request, response, nonce);
      return response;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(request, response, nonce);
  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets and the favicon — there's no security header or
     * auth-redirect concern for a static file the CDN serves as-is, and
     * running this middleware on every asset request would be pure
     * overhead.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
