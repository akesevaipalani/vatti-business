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
  "/partners",
  "/backup",
  "/audit-log",
  "/day-closing",
  "/api/partners",
  "/api/backup",
  "/api/settings",
  "/api/day-closing",
  "/api/audit-logs",
  "/api/accounting",
];

// Allowed origins for mobile apps (Capacitor Android/iOS) and web development
const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith(".up.railway.app")) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  const allowOrigin = allowed ? origin! : "https://localhost";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // 1. Handle CORS preflight (OPTIONS) for all API routes immediately
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Helper to attach CORS headers to responses
  const withCors = (res: NextResponse): NextResponse => {
    if (pathname.startsWith("/api/") && isAllowedOrigin(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin!);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  };

  // 2. Allow static Next.js assets and public paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return withCors(NextResponse.next());
  }

  // 3. Check for session cookie or Bearer authorization header
  const sessionCookie = request.cookies.get("vatti_session")?.value;
  const authHeader = request.headers.get("authorization");
  const hasToken = !!sessionCookie || (!!authHeader && authHeader.startsWith("Bearer "));

  if (!hasToken) {
    // If an API route, return 401 Unauthorized with CORS headers
    if (pathname.startsWith("/api/")) {
      return withCors(
        NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
      );
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
            return withCors(
              NextResponse.json(
                { error: "Forbidden: Admin privileges required" },
                { status: 403 }
              )
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

  return withCors(NextResponse.next());
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
