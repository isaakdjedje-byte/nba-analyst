"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function MFAVerificationForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update session to mark MFA as verified
        await signIn("credentials", {
          redirect: false,
          callbackUrl,
        });

        // Redirect to the callback URL
        router.push(callbackUrl);
      } else {
        setError(data.message || "Invalid verification code");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {useBackupCode
              ? "Enter one of your 8-character backup codes"
              : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700"
            >
              {useBackupCode ? "Backup Code" : "Verification Code"}
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode={useBackupCode ? "text" : "numeric"}
              pattern={useBackupCode ? "[a-zA-Z0-9]*" : "[0-9]*"}
              maxLength={useBackupCode ? 8 : 6}
              required
              value={code}
              onChange={(e) =>
                setCode(
                  useBackupCode
                    ? e.target.value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
                    : e.target.value.replace(/\D/g, "")
                )
              }
              className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm tracking-widest text-center text-2xl"
              placeholder={useBackupCode ? "abc12345" : "000000"}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </div>

          <div className="flex flex-col space-y-3 text-center">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode("");
                setError("");
              }}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {useBackupCode
                ? "Use authenticator app code"
                : "Use backup code"}
            </button>
            <a
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-400"
            >
              Back to login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
