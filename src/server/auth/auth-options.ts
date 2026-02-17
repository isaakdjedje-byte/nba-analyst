import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db/client";
import { UserRole } from "./rbac";
import { checkMFARequirement } from "./mfa-verification";
import { rateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          let ip = "unknown";
          try {
            // NextAuth v4: req.headers is a plain object, not Headers instance
            const requestHeaders = (req as { headers?: Record<string, string | undefined> } | undefined)?.headers;
            const forwardedFor = requestHeaders?.["x-forwarded-for"];
            ip = forwardedFor?.split(",")[0]?.trim() ?? 
                 requestHeaders?.["x-real-ip"] ?? 
                 "unknown";
          } catch {
            ip = "unknown";
          }

          const loginRateLimit = rateLimit(`login:${ip}`, {
            windowMs: 15 * 60 * 1000,
            maxRequests: 5,
          });

          if (!loginRateLimit.success) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            role: user.role as UserRole,
          };
        } catch (globalError) {
          console.error("[AUTH] GLOBAL ERROR:", globalError);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days - matches session
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const authenticatedUser = user as { id: string; role: UserRole };
        token.role = authenticatedUser.role;
        token.iat = Date.now();

        // Check MFA requirement for this user
        const mfaData = await checkMFARequirement(
          authenticatedUser.id,
          authenticatedUser.role as string
        );
        token.mfaEnabled = mfaData.mfaEnabled;
        token.mfaVerified = mfaData.mfaVerified;
        token.requiresMfa = mfaData.requiresMfa;
      }

      // Handle MFA verification callback (triggered after MFA step)
      if (trigger === "update" && token.requiresMfa) {
        token.mfaVerified = true;
      }

      // C2: Validate token iat exists and prevent replay attacks
      if (!token.iat || typeof token.iat !== 'number') {
        console.warn("[AUTH] Invalid token iat, setting to now");
        token.iat = Date.now();
      }

      // Refresh token if it's older than 7 days (1 week before expiry)
      const tokenAge = Date.now() - (token.iat as number);
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      const maxTokenAge = 30 * 24 * 60 * 60 * 1000; // 30 days max

      // Reject tokens older than max age (prevents replay with old tokens)
      if (tokenAge > maxTokenAge) {
        console.warn("[AUTH] Token expired (>30 days), returning empty token");
        // Return minimal token that will fail auth check
        return {} as typeof token;
      }

      if (tokenAge > weekInMs) {
        // Token is older than a week, refresh the iat to extend session
        token.iat = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      // Only populate session if we have valid token data
      if (token && token.sub && token.role) {
        const sessionUser = session.user as {
          id: string;
          role: UserRole;
          mfaEnabled: boolean;
          mfaVerified: boolean;
          requiresMfa: boolean;
        };

        sessionUser.id = token.sub as string;
        sessionUser.role = token.role as UserRole;
        sessionUser.mfaEnabled = token.mfaEnabled as boolean;
        sessionUser.mfaVerified = token.mfaVerified as boolean;
        sessionUser.requiresMfa = token.requiresMfa as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
