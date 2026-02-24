import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import {
  checkRouteAccess,
  generateTraceId,
  createForbiddenResponse,
} from "@/server/auth/rbac";

// Define protected routes matcher
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/v1/decisions/:path*",
    "/api/v1/decisions",
    "/api/v1/admin/:path*",
    "/api/v1/admin/users",
    "/api/v1/admin/users/:path*",
    "/decision/:path*",
    "/policy/:path*",
  ],
};

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const pathname = req.nextUrl.pathname;
    const traceId = generateTraceId();

    // Additional security headers
    const response = NextResponse.next();

    // Security headers per architecture.md
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    );
    response.headers.set("X-Request-Id", traceId);
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // RBAC Check - Defense in Depth
    const accessCheck = await checkRouteAccess(req);

    if (!accessCheck.allowed) {
      // Log unauthorized access attempt
      console.warn(`[RBAC] Unauthorized access attempt`, {
        traceId,
        pathname,
        userRole: accessCheck.role,
        error: accessCheck.error,
        ip: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
        timestamp: new Date().toISOString(),
      });

      // Return 403 Forbidden with trace ID
      return createForbiddenResponse(traceId);
    }

    // MFA Check for sensitive routes
    const mfaRequiredPaths = [
      "/admin",
      "/api/v1/admin",
      "/settings/mfa",
      "/api/v1/policy/config",
    ];

    const requiresMfa = mfaRequiredPaths.some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (requiresMfa) {
      const token = req.nextauth.token;

      if (token) {
        // Check if MFA is mandatory for role but not configured
        const mandatoryRoles = (process.env.MFA_ENFORCE_FOR_ROLES || "admin,ops")
          .split(",")
          .map((r) => r.trim().toLowerCase());

        const isMandatory = mandatoryRoles.includes((token.role as string)?.toLowerCase());

        if (isMandatory && !token.mfaEnabled) {
          // Redirect to MFA setup
          const setupUrl = new URL("/settings/mfa/setup", req.url);
          setupUrl.searchParams.set("callbackUrl", pathname);
          return NextResponse.redirect(setupUrl);
        }

        // Check if MFA verified (for this session/grace period)
        if (token.mfaEnabled && !token.mfaVerified) {
          const callbackUrl = encodeURIComponent(pathname);
          return NextResponse.redirect(
            new URL(`/login/mfa?callbackUrl=${callbackUrl}`, req.url)
          );
        }
      }
    }

    // Add user role header for downstream use (optional)
    if (accessCheck.role) {
      response.headers.set("X-User-Role", accessCheck.role);
    }

    return response;
  },
  {
    callbacks: {
      authorized({ req, token }) {
        // Allow public access to specific paths
        const publicPaths = [
          "/api/health",
          "/login",
          "/register",
          "/",
          "/_next",
          "/static",
          "/dashboard/no-bet",
        ];

        const pathname = req.nextUrl.pathname;

        // Check if path is public
        if (publicPaths.some((path) => pathname.startsWith(path))) {
          return true;
        }

        // Check authentication
        if (!token) {
          return false;
        }

        // Token validation - ensure role exists
        if (!token.role) {
          console.warn("[Auth] Token missing role claim", {
            path: pathname,
            sub: token.sub,
          });
          return false;
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
);
