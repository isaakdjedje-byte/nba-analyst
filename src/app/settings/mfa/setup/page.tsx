"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface MFASetupData {
  qrCodeUrl: string;
  uri: string;
}

export default function MFASetupPage() {
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"setup" | "verify" | "complete">("setup");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();

  const callbackUrlRaw = searchParams.get("callbackUrl");
  const callbackUrl =
    callbackUrlRaw && callbackUrlRaw.startsWith("/") && !callbackUrlRaw.startsWith("//")
      ? callbackUrlRaw
      : "/settings/mfa";

  useEffect(() => {
    // Fetch MFA setup data
    fetch("/api/auth/mfa/setup")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSetupData(data);
          setStep("setup");
        } else {
          setError(data.message || "Failed to load MFA setup");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load MFA setup");
        setLoading(false);
      });
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setBackupCodes(data.backupCodes || []);
        await update();
        setStep("complete");
      } else {
        setError(data.message || "Invalid verification code");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    router.push(callbackUrl);
  };

  if (loading && !setupData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MFA setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Set Up Two-Factor Authentication
            </h1>
            <p className="text-gray-600 mb-8">
              Enhance your account security by enabling two-factor authentication.
            </p>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {step === "setup" && setupData && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Step 1: Scan QR Code
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code:
                  </p>
                  <div className="flex justify-center">
                    <Image
                      src={setupData.qrCodeUrl}
                      alt="MFA QR Code"
                      width={200}
                      height={200}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">Or enter this code manually:</p>
                    <code className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-sm break-all">
                      {setupData.uri.split("secret=")[1]?.split("&")[0]}
                    </code>
                  </div>
                </div>

                <form onSubmit={() => setStep("verify")} className="text-center">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    I&apos;ve scanned the code
                  </button>
                </form>
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Step 2: Verify Code
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter the 6-digit code from your authenticator app to confirm setup:
                  </p>
                  <form onSubmit={handleVerify} className="space-y-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) =>
                        setVerificationCode(e.target.value.replace(/\D/g, ""))
                      }
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm tracking-widest text-center text-2xl"
                      placeholder="000000"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading || verificationCode.length !== 6}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {loading ? "Verifying..." : "Verify and Enable"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {step === "complete" && (
              <div className="space-y-6">
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900 mb-4">
                    ✅ MFA Enabled Successfully!
                  </h3>
                  <p className="text-sm text-green-700 mb-4">
                    Save these backup codes in a secure location. You&apos;ll need them if you lose access to your authenticator app.
                  </p>
                  <div className="bg-white p-4 rounded border border-green-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Backup Codes (save these now):
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, index) => (
                        <code
                          key={index}
                          className="text-center bg-gray-100 px-2 py-1 rounded font-mono text-sm"
                        >
                          {code}
                        </code>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">
                      Each code can only be used once.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleComplete}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
