/**
 * MFA Unit Tests
 * Tests for TOTP generation, encryption, and verification
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  generateMFASecret,
  encryptMFASecret,
  decryptMFASecret,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  isMFAGracePeriodValid,
  isMFARemovalCooldownComplete,
  isMFAMandatoryForRole,
  verifyMFAToken,
} from "./mfa";

// Mock environment variables
beforeAll(() => {
  process.env.MFA_ENCRYPTION_KEY = "test-key-32-chars-long-for-mfa-encryption!!";
  process.env.MFA_ISSUER_NAME = "Test-App";
  process.env.MFA_ENFORCE_FOR_ROLES = "admin,ops";
});

describe("MFA Utilities", () => {
  describe("generateMFASecret", () => {
    it("should generate a secret, QR code URL, and OTPAuth URI", async () => {
      const result = await generateMFASecret("test@example.com");

      expect(result).toHaveProperty("secret");
      expect(result).toHaveProperty("qrCodeUrl");
      expect(result).toHaveProperty("uri");
      expect(result.secret).toBeTruthy();
      expect(result.qrCodeUrl).toContain("data:image/png;base64,");
      expect(result.uri).toContain("otpauth://totp/");
    });

    it("should include email in the OTPAuth URI", async () => {
      const email = "user@example.com";
      const result = await generateMFASecret(email);

      expect(result.uri).toContain(encodeURIComponent(email));
    });
  });

  describe("encryptMFASecret and decryptMFASecret", () => {
    it("should encrypt and decrypt a secret correctly", () => {
      const originalSecret = "test-secret-123";
      const encrypted = encryptMFASecret(originalSecret);
      const decrypted = decryptMFASecret(encrypted);

      expect(encrypted).not.toBe(originalSecret);
      expect(encrypted).toContain(":"); // Format: iv:authTag:encrypted
      expect(decrypted).toBe(originalSecret);
    });

    it("should produce different encrypted values for the same secret", () => {
      const secret = "test-secret-123";
      const encrypted1 = encryptMFASecret(secret);
      const encrypted2 = encryptMFASecret(secret);

      expect(encrypted1).not.toBe(encrypted2); // Due to random IV
    });

    it("should throw error for invalid encrypted format", () => {
      expect(() => decryptMFASecret("invalid-format")).toThrow(
        "Invalid encrypted secret format"
      );
    });
  });

  describe("verifyTOTP", () => {
    it("should verify a valid TOTP code", async () => {
      // Use a valid base32 secret (uppercase A-Z, 2-7)
      const secret = "JBSWY3DPEHPK3PXP"; // Valid base32 secret
      const encrypted = encryptMFASecret(secret);

      const totp = await TOTP.generate(secret, {
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
      });

      const isValid = await verifyTOTP(encrypted, totp.otp);
      expect(isValid).toBe(true);
    });

    it("should reject an invalid TOTP code", async () => {
      const secret = "JBSWY3DPEHPK3PXP"; // Valid base32 secret
      const encrypted = encryptMFASecret(secret);

      const isValid = await verifyTOTP(encrypted, "000000");
      expect(isValid).toBe(false);
    });

    it("should reject an expired TOTP code", async () => {
      const secret = "JBSWY3DPEHPK3PXP"; // Valid base32 secret
      const encrypted = encryptMFASecret(secret);

      // Generate a TOTP for 2 minutes ago (expired)
      const expiredTOTP = await TOTP.generate(secret, {
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
        timestamp: Date.now() - 120000,
      });

      const isValid = await verifyTOTP(encrypted, expiredTOTP.otp);
      // Should fail because it's outside the ±1 window
      expect(isValid).toBe(false);
    });
  });

  describe("generateBackupCodes", () => {
    it("should generate 10 backup codes", () => {
      const codes = generateBackupCodes();

      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[a-zA-Z0-9-_]+$/); // base64url can include - and _
      });
    });

    it("should generate unique codes", () => {
      const codes = generateBackupCodes();
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe("hashBackupCode", () => {
    it("should hash a backup code consistently", () => {
      const code = "ABCD1234";
      const hash1 = hashBackupCode(code);
      const hash2 = hashBackupCode(code);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it("should be case-insensitive", () => {
      const hash1 = hashBackupCode("abcd1234");
      const hash2 = hashBackupCode("ABCD1234");

      expect(hash1).toBe(hash2);
    });
  });

  describe("verifyBackupCode", () => {
    it("should verify a valid backup code", () => {
      const code = "ABCD1234";
      const hash = hashBackupCode(code);
      const storedHashes = [hash, "other-hash"];

      const index = verifyBackupCode(code, storedHashes);
      expect(index).toBe(0);
    });

    it("should reject an invalid backup code", () => {
      const storedHashes = [hashBackupCode("ABCD1234")];

      const index = verifyBackupCode("WRONG000", storedHashes);
      expect(index).toBe(-1);
    });
  });

  describe("isMFAGracePeriodValid", () => {
    it("should return false if no last verified timestamp", () => {
      const result = isMFAGracePeriodValid(null, 15);
      expect(result).toBe(false);
    });

    it("should return true if within grace period", () => {
      const lastVerified = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = isMFAGracePeriodValid(lastVerified, 15);
      expect(result).toBe(true);
    });

    it("should return false if outside grace period", () => {
      const lastVerified = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const result = isMFAGracePeriodValid(lastVerified, 15);
      expect(result).toBe(false);
    });
  });

  describe("isMFARemovalCooldownComplete", () => {
    it("should return true if no disable request", () => {
      const result = isMFARemovalCooldownComplete(null, 24);
      expect(result).toBe(true);
    });

    it("should return false if within cooldown period", () => {
      const requestedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const result = isMFARemovalCooldownComplete(requestedAt, 24);
      expect(result).toBe(false);
    });

    it("should return true if cooldown period has passed", () => {
      const requestedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const result = isMFARemovalCooldownComplete(requestedAt, 24);
      expect(result).toBe(true);
    });
  });

  describe("isMFAMandatoryForRole", () => {
    it("should return true for admin role", () => {
      expect(isMFAMandatoryForRole("admin")).toBe(true);
    });

    it("should return true for ops role", () => {
      expect(isMFAMandatoryForRole("ops")).toBe(true);
    });

    it("should return false for user role", () => {
      expect(isMFAMandatoryForRole("user")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isMFAMandatoryForRole("ADMIN")).toBe(true);
      expect(isMFAMandatoryForRole("Ops")).toBe(true);
    });
  });

  describe("verifyMFAToken", () => {
    it("should reject if no encrypted secret", async () => {
      const result = await verifyMFAToken(null, [], "123456");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("MFA not configured for user");
      }
    });

    it("should reject invalid TOTP format", async () => {
      const secret = "test-secret";
      const encrypted = encryptMFASecret(secret);

      const result = await verifyMFAToken(encrypted, [], "12345"); // 5 digits
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid code format");
      }
    });

    it("should reject invalid backup code format", async () => {
      const secret = "test-secret";
      const encrypted = encryptMFASecret(secret);

      const result = await verifyMFAToken(encrypted, [], "1234567"); // 7 chars
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid code format");
      }
    });
  });
});

// Import TOTP for tests
import { TOTP } from "totp-generator";
