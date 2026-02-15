import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db/client";
import { rateLimit } from "./rate-limit";
import { UserRole } from "./rbac";
import { checkMFARequirement } from "./mfa-verification";

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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limiting by email + IP to prevent brute force
        const forwardedFor = req?.headers?.get("x-forwarded-for");
        const ip = forwardedFor?.split(",")[0]?.trim() ?? 
                   req?.headers?.get("x-real-ip") ?? 
                   "unknown";
        const rateLimitKey = `login:${credentials.email}:${ip}`;
        const rateLimitResult = rateLimit(rateLimitKey, {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 5, // 5 attempts per window
        });

        if (!rateLimitResult.success) {
          // Throw specific error for rate limit to ensure blocking
          throw new Error("RATE_LIMIT_EXCEEDED:Trop de tentatives. Réessayez plus tard.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        // H1: bcrypt with try/catch
        let isPasswordValid: boolean;
        try {
          isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );
        } catch (error) {
          console.error("[AUTH] bcrypt compare error:", error);
          return null;
        }

        if (!isPasswordValid) {
          return null;
        }

        // NFR9: Data minimization - only email collected as PII
        return {
          id: user.id,
          email: user.email,
          role: user.role as UserRole,
        };
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
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.iat = Date.now();
        
        // Check MFA requirement for this user
        const mfaData = await checkMFARequirement(user.id, user.role as string);
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
        console.warn("[AUTH] Invalid token iat, rejecting");
        return {} as typeof token; // Return empty token to force re-auth
      }
      
      // Refresh token if it's older than 7 days (1 week before expiry)
      const tokenAge = Date.now() - (token.iat as number);
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      const maxTokenAge = 30 * 24 * 60 * 60 * 1000; // 30 days max
      
      // Reject tokens older than max age (prevents replay with old tokens)
      if (tokenAge > maxTokenAge) {
        console.warn("[AUTH] Token expired (>30 days), rejecting");
        return {} as typeof token;
      }
      
      if (tokenAge > weekInMs) {
        // Token is older than a week, refresh the iat
        token.iat = Date.now();
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
        session.user.mfaVerified = token.mfaVerified as boolean;
        session.user.requiresMfa = token.requiresMfa as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
