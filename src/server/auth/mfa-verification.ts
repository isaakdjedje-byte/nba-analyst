/**
 * MFA Verification Logic for NextAuth
 * Handles MFA checks during authentication flow
 */

import { createHash } from "crypto";
import { prisma } from "@/server/db/client";
import { verifyMFAToken, isMFAGracePeriodValid } from "./mfa";

export interface MFASessionData {
  requiresMfa: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  mfaVerifiedAt: Date | null;
}

/**
 * Check if MFA is required for the user
 */
export async function checkMFARequirement(
  userId: string,
  userRole: string
): Promise<MFASessionData> {
  void userRole;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaEnabled: true,
      mfaSecret: true,
      mfaLastVerifiedAt: true,
      role: true,
    },
  });

  if (!user) {
    return {
      requiresMfa: false,
      mfaEnabled: false,
      mfaVerified: false,
      mfaVerifiedAt: null,
    };
  }

  // Check if MFA is mandatory for this role
  const mandatoryRoles = (process.env.MFA_ENFORCE_FOR_ROLES || "admin,ops")
    .split(",")
    .map((r) => r.trim().toLowerCase());

  const isMandatory = mandatoryRoles.includes(user.role.toLowerCase());

  // If MFA is mandatory but not enabled, require setup
  if (isMandatory && !user.mfaEnabled) {
    return {
      requiresMfa: true,
      mfaEnabled: false,
      mfaVerified: false,
      mfaVerifiedAt: null,
    };
  }

  // If MFA is enabled, check if grace period is valid
  if (user.mfaEnabled) {
    const gracePeriodMinutes = parseInt(
      process.env.MFA_GRACE_PERIOD_MINUTES || "15",
      10
    );
    const isGracePeriodValid = isMFAGracePeriodValid(
      user.mfaLastVerifiedAt,
      gracePeriodMinutes
    );

    return {
      requiresMfa: true,
      mfaEnabled: true,
      mfaVerified: isGracePeriodValid,
      mfaVerifiedAt: user.mfaLastVerifiedAt,
    };
  }

  // MFA not required
  return {
    requiresMfa: false,
    mfaEnabled: false,
    mfaVerified: false,
    mfaVerifiedAt: null,
  };
}

/**
 * Verify MFA token for a user
 * Returns success status and updates last verified timestamp if successful
 */
export async function verifyUserMFAToken(
  userId: string,
  token: string
): Promise<{ success: boolean; method?: "totp" | "backup"; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaSecret: true,
      mfaBackupCodes: true,
      mfaEnabled: true,
    },
  });

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return { success: false, error: "MFA not configured for user" };
  }

  const backupCodes = JSON.parse(user.mfaBackupCodes || "[]");
  const result = await verifyMFAToken(user.mfaSecret, backupCodes, token);

  if (result.success) {
    // Update last verified timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { mfaLastVerifiedAt: new Date() },
    });

    // If backup code was used, remove it from the list
    if (result.method === "backup") {
      const codeIndex = backupCodes.findIndex((hash: string) => {
        const codeHash = createHash("sha256")
          .update(token.toLowerCase())
          .digest("hex");
        return codeHash === hash;
      });

      if (codeIndex !== -1) {
        const newBackupCodes = [...backupCodes];
        newBackupCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: JSON.stringify(newBackupCodes) },
        });
      }
    }

    return { success: true, method: result.method };
  }

  const errorResult = result as { success: false; error: string };
  return { success: false, error: errorResult.error };
}

/**
 * Set up MFA for a user
 * Generates secret, backup codes, and stores encrypted secret
 */
export async function setupMFAForUser(
  userId: string,
  encryptedSetupSecret: string,
  verificationCode: string
): Promise<{
  success: boolean;
  backupCodes?: string[];
  error?: string;
}> {
  const { generateBackupCodes } = await import("./mfa");

  // Verify the code before saving
  const { verifyTOTP } = await import("./mfa");
  const isValid = await verifyTOTP(encryptedSetupSecret, verificationCode);

  if (!isValid) {
    return { success: false, error: "Invalid verification code" };
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const hashedCodes = backupCodes.map((code) => {
    return createHash("sha256").update(code.toLowerCase()).digest("hex");
  });

  // Save to database
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSetupSecret,
      mfaEnabled: true,
      mfaBackupCodes: JSON.stringify(hashedCodes),
      mfaEnrolledAt: new Date(),
      mfaLastVerifiedAt: new Date(),
    },
  });

  return { success: true, backupCodes };
}

/**
 * Request MFA removal with cooldown period
 */
export async function requestMFARemoval(
  userId: string
): Promise<{ success: boolean; cooldownExpiry?: Date; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaDisableRequestedAt: true },
  });

  if (!user || !user.mfaEnabled) {
    return { success: false, error: "MFA is not enabled" };
  }

  const cooldownHours = parseInt(process.env.MFA_REMOVAL_COOLDOWN_HOURS || "24", 10);
  const cooldownExpiry = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { mfaDisableRequestedAt: new Date() },
  });

  return { success: true, cooldownExpiry };
}

/**
 * Complete MFA removal after verification and cooldown
 */
export async function completeMFARemoval(
  userId: string,
  verificationCode: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
      mfaDisableRequestedAt: true,
      role: true,
    },
  });

  if (!user || !user.mfaEnabled) {
    return { success: false, error: "MFA is not enabled" };
  }

  // Check cooldown period
  const cooldownHours = parseInt(process.env.MFA_REMOVAL_COOLDOWN_HOURS || "24", 10);
  if (user.mfaDisableRequestedAt) {
    const elapsedMs = Date.now() - user.mfaDisableRequestedAt.getTime();
    const requiredMs = cooldownHours * 60 * 60 * 1000;

    if (elapsedMs < requiredMs) {
      const remainingHours = Math.ceil((requiredMs - elapsedMs) / (60 * 60 * 1000));
      return {
        success: false,
        error: `Cooldown period not complete. ${remainingHours} hours remaining.`,
      };
    }
  }

  // Verify MFA code before removal
  const backupCodes = JSON.parse(user.mfaBackupCodes || "[]");
  const result = await verifyMFAToken(
    user.mfaSecret,
    backupCodes,
    verificationCode
  );

  if (!result.success) {
    return { success: false, error: "Invalid verification code" };
  }

  // Clear MFA data
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: null,
      mfaEnabled: false,
      mfaBackupCodes: "[]",
      mfaEnrolledAt: null,
      mfaLastVerifiedAt: null,
      mfaDisableRequestedAt: null,
    },
  });

  return { success: true };
}

/**
 * Check if user needs MFA setup prompt
 */
export async function needsMFASetup(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, mfaEnabled: true },
  });

  if (!user) return false;

  const mandatoryRoles = (process.env.MFA_ENFORCE_FOR_ROLES || "admin,ops")
    .split(",")
    .map((r) => r.trim().toLowerCase());

  const isMandatory = mandatoryRoles.includes(user.role.toLowerCase());

  return isMandatory && !user.mfaEnabled;
}
