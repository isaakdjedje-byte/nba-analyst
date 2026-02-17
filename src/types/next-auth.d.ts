import { DefaultSession } from "next-auth";
import { UserRole } from "@/server/auth/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      mfaEnabled: boolean;
      mfaVerified: boolean;
      requiresMfa: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
    requiresMfa?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
    requiresMfa?: boolean;
    iat?: number;
  }
}
