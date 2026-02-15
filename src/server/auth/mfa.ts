/**
 * MFA Utilities for TOTP-based Multi-Factor Authentication
 * Implements RFC 6238 TOTP algorithm
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import QRCode from "qrcode";
import { TOTP } from "totp-generator";

const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY;
const MFA_ISSUER_NAME = process.env.MFA_ISSUER_NAME || "NBA-Analyst";

// C4: Validate MFA_ENCRYPTION_KEY at module load
if (!MFA_ENCRYPTION_KEY) {
  throw new Error(
    "MFA_ENCRYPTION_KEY environment variable is required for MFA encryption"
  );
}

if (MFA_ENCRYPTION_KEY.length < 32) {
  throw new Error(
    `MFA_ENCRYPTION_KEY must be at least 32 characters long (current: ${MFA_ENCRYPTION_KEY.length})`
  );
}

// Ensure key is exactly 32 bytes for AES-256
const ENCRYPTION_KEY_BUFFER = Buffer.from(MFA_ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));

/**
 * Generate a new MFA secret for a user
 * Returns the secret, QR code data URL, and otpauth URI
 */
export async function generateMFASecret(userEmail: string): Promise<{
  secret: string;
  qrCodeUrl: string;
  uri: string;
}> {
  // Generate a random 20-byte secret (base32 encoded for TOTP)
  const secret = randomBytes(20).toString("base64url");

  // Create otpauth URI for authenticator apps
  const encodedEmail = encodeURIComponent(userEmail);
  const encodedIssuer = encodeURIComponent(MFA_ISSUER_NAME);
  const uri = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}`;

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(uri, {
    width: 200,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return { secret, qrCodeUrl, uri };
}

/**
 * Encrypt MFA secret using AES-256-GCM
 */
export function encryptMFASecret(secret: string): string {
  const iv = randomBytes(16);
  // C4: Use validated encryption key
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY_BUFFER, iv);

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Store as: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt MFA secret
 */
export function decryptMFASecret(encryptedSecret: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedSecret.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  // C4: Use validated encryption key
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Verify a TOTP token against the encrypted secret
 */
export async function verifyTOTP(
  encryptedSecret: string,
  token: string
): Promise<boolean> {
  try {
    const secret = decryptMFASecret(encryptedSecret);

    // Generate expected TOTP for current time window
    const expectedTOTP = await TOTP.generate(secret, {
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
    });

    // Also check adjacent windows for clock skew (±1 window = 30 seconds)
    const prevTOTP = await TOTP.generate(secret, {
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
      timestamp: Date.now() - 30000,
    });

    const nextTOTP = await TOTP.generate(secret, {
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
      timestamp: Date.now() + 30000,
    });

    // Constant-time comparison to prevent timing attacks
    return (
      constantTimeCompare(token, expectedTOTP.otp) ||
      constantTimeCompare(token, prevTOTP.otp) ||
      constantTimeCompare(token, nextTOTP.otp)
    );
  } catch (error) {
    console.error("TOTP verification error:", error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate backup codes for account recovery
 * Returns array of 10 codes (8 characters each)
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code
    const code = randomBytes(6).toString("base64url").slice(0, 8);
    codes.push(code);
  }

  return codes;
}

/**
 * Hash a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.toLowerCase()).digest("hex");
}

/**
 * Verify a backup code against stored hashes
 * Returns the index of the matching code if found, -1 otherwise
 */
export function verifyBackupCode(
  code: string,
  storedHashes: string[]
): number {
  const hash = hashBackupCode(code);

  for (let i = 0; i < storedHashes.length; i++) {
    if (constantTimeCompare(hash, storedHashes[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Check if MFA grace period is still valid
 */
export function isMFAGracePeriodValid(
  lastVerifiedAt: Date | null,
  gracePeriodMinutes: number = 15
): boolean {
  if (!lastVerifiedAt) {
    return false;
  }

  const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
  const expiryTime = new Date(lastVerifiedAt.getTime() + gracePeriodMs);

  return new Date() < expiryTime;
}

/**
 * Check if MFA removal cooldown period has passed
 */
export function isMFARemovalCooldownComplete(
  disableRequestedAt: Date | null,
  cooldownHours: number = 24
): boolean {
  if (!disableRequestedAt) {
    return true; // No request was made, so no cooldown
  }

  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const completionTime = new Date(disableRequestedAt.getTime() + cooldownMs);

  return new Date() >= completionTime;
}

/**
 * Check if MFA is mandatory for a given role
 */
export function isMFAMandatoryForRole(role: string): boolean {
  const mandatoryRoles = (process.env.MFA_ENFORCE_FOR_ROLES || "admin,ops")
    .split(",")
    .map((r) => r.trim().toLowerCase());

  return mandatoryRoles.includes(role.toLowerCase());
}

/**
 * Format TOTP secret for manual entry (groups of 4 characters)
 */
export function formatSecretForDisplay(secret: string): string {
  return secret
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .match(/.{1,4}/g)
    ?.join(" ") || secret;
}

export type MFAVerificationResult =
  | { success: true; method: "totp" | "backup" }
  | { success: false; error: string };

/**
 * Verify MFA token (TOTP or backup code)
 */
export async function verifyMFAToken(
  encryptedSecret: string | null,
  backupCodes: string[],
  token: string
): Promise<MFAVerificationResult> {
  if (!encryptedSecret) {
    return { success: false, error: "MFA not configured for user" };
  }

  // Clean the token
  const cleanToken = token.trim().replace(/\s/g, "").toLowerCase();

  // Check if it's a TOTP code (6 digits)
  if (/^\d{6}$/.test(cleanToken)) {
    const isValid = await verifyTOTP(encryptedSecret, cleanToken);
    if (isValid) {
      return { success: true, method: "totp" };
    }
    return { success: false, error: "Invalid verification code" };
  }

  // Check if it's a backup code (8 alphanumeric characters)
  if (/^[a-z0-9]{8}$/i.test(cleanToken)) {
    const index = verifyBackupCode(cleanToken, backupCodes);
    if (index !== -1) {
      return { success: true, method: "backup" };
    }
    return { success: false, error: "Invalid backup code" };
  }

  return { success: false, error: "Invalid code format" };
}
