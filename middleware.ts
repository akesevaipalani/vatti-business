import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth/login",
  "/api/auth/logout",
  "/manifest.json",
  "/favicon.ico",
  "/icon.png",
  "/logo.png",
];

// Admin-only paths
const ADMIN_ONLY_PREFIXES = [
  "/settings",
  "/backup",
  "/audit-log",
  "/day-closing",
  "/api/backup",
  "/api/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static Next.js assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Check for session cookie
  const sessionCookie = request.cookies.get("vatti_session")?.value;
  const authHeader = request.headers.get("authorization");
  const hasToken = !!sessionCookie || (!!authHeader && authHeader.startsWith("Bearer "));

  if (!hasToken) {
    // If an API route, return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    // For pages, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode basic payload from JWT if present for role checks
  try {
    const rawToken = sessionCookie || (authHeader ? authHeader.replace("Bearer ", "") : "");
    if (rawToken) {
      const parts = rawToken.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
        const payload = JSON.parse(payloadJson);

        // Check if route is admin only and user is not admin
        const isAdminRoute = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
        if (isAdminRoute && payload.role !== "ADMIN") {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "Forbidden: Admin privileges required" },
              { status: 403 }
            );
          }
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
  } catch {
    // If malformed token, redirect to login
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
