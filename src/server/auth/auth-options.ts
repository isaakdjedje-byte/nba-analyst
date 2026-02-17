import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db/client";
import { UserRole } from "./rbac";
import { checkMFARequirement } from "./mfa-verification";

console.log("[AUTH] Loading auth-options module v3 - DEBUG at", new Date().toISOString());

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
          console.log("[AUTH] ========== LOGIN ATTEMPT ==========");
          console.log("[AUTH] Raw credentials:", JSON.stringify(credentials));
          console.log("[AUTH] Email:", credentials?.email);
          
          if (!credentials?.email || !credentials?.password) {
            console.log("[AUTH] MISSING CREDENTIALS");
            return null;
          }

          console.log("[AUTH] Step 1: Getting IP...");
          let ip = "unknown";
          try {
            // NextAuth v4: req.headers is a plain object, not Headers instance
            const requestHeaders = (req as { headers?: Record<string, string | undefined> } | undefined)?.headers;
            const forwardedFor = requestHeaders?.["x-forwarded-for"];
            console.log("[AUTH] forwardedFor:", forwardedFor);
            ip = forwardedFor?.split(",")[0]?.trim() ?? 
                 requestHeaders?.["x-real-ip"] ?? 
                 "unknown";
          } catch (e) {
            console.log("[AUTH] IP error:", e);
          }
          
          console.log("[AUTH] Step 2: IP is:", ip);
          
          // Skip rate limiting for now
          console.log("[AUTH] Step 3: Skipping rate limit for debugging");

          console.log("[AUTH] Step 4: Looking up user...");
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          console.log("[AUTH] User:", user ? "FOUND" : "NOT FOUND");

          if (!user || !user.password) {
            console.log("[AUTH] No user or password");
            return null;
          }

          console.log("[AUTH] Step 5: Checking password...");
          const isValid = await bcrypt.compare(credentials.password, user.password);
          console.log("[AUTH] Password valid:", isValid);

          if (!isValid) {
            console.log("[AUTH] Invalid password");
            return null;
          }

          console.log("[AUTH] SUCCESS!");
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
        console.log("[AUTH] Refreshing token (older than 7 days)");
        token.iat = Date.now();
      }
      
      return token;
    },
    async session({ session, token }) {
      // Only populate session if we have valid token data
      if (token && token.sub && token.role) {
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
