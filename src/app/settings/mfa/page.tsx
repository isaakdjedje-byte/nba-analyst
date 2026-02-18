"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MFAStatus {
  enabled: boolean;
  enrolledAt: string | null;
  lastVerifiedAt: string | null;
  cooldownExpiry?: string | null;
}

export default function MFAManagementPage() {
  const session = useSession();
  const sessionData = session?.data;
  const sessionStatus = session?.status;
  const router = useRouter();
  
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disableSuccess, setDisableSuccess] = useState("");
  const [sessionTimeoutError, setSessionTimeoutError] = useState("");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus !== "loading") return;
    const timer = setTimeout(() => {
      setSessionTimeoutError("Session loading timeout. Please refresh and try again.");
    }, 10000);
    return () => clearTimeout(timer);
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "loading" || !sessionData) {
      return;
    }

    // Fetch MFA status
    fetch("/api/auth/mfa/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMfaStatus(data.status);
        } else {
          setError(data.message || "Failed to load MFA status");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load MFA status");
        setLoading(false);
      });
  }, [sessionStatus, sessionData]);

  // Guard against undefined session during prerender - must check before any session usage
  if (sessionStatus === "loading" || !sessionData) {
    if (sessionTimeoutError) {
      return (
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <h2 className="text-lg font-semibold text-red-700 mb-2">Session Error</h2>
              <p className="text-gray-700">{sessionTimeoutError}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleDisableRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDisableSuccess("");

    try {
      const response = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setDisableSuccess(data.message || "MFA disable request submitted");
        setShowDisableForm(false);
        setDisableCode("");
        // Refresh status
        setMfaStatus((prev) =>
          prev
            ? {
                ...prev,
                cooldownExpiry: data.cooldownExpiry,
              }
            : null
        );
      } else {
        setError(data.message || "Failed to disable MFA");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white shadow rounded-lg p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Two-Factor Authentication
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage your account security settings
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  mfaStatus?.enabled
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {mfaStatus?.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {disableSuccess && (
              <div className="mb-6 rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">{disableSuccess}</p>
              </div>
            )}

            {!mfaStatus?.enabled ? (
              <div className="space-y-6">
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-yellow-900 mb-2">
                    MFA is Not Enabled
                  </h3>
                  <p className="text-sm text-yellow-700 mb-4">
                    {sessionData?.user?.role === "admin" ||
                    sessionData?.user?.role === "ops"
                      ? "MFA is mandatory for your role. Please enable it to continue accessing admin features."
                      : "Enable two-factor authentication to add an extra layer of security to your account."}
                  </p>
                  <Link
                    href="/settings/mfa/setup"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Enable MFA
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900 mb-4">
                    MFA is Enabled
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-700">Active</span>
                    </div>
                    {mfaStatus.enrolledAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Enabled on:</span>
                        <span className="font-medium">
                          {new Date(mfaStatus.enrolledAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {mfaStatus.lastVerifiedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last verified:</span>
                        <span className="font-medium">
                          {new Date(mfaStatus.lastVerifiedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  {!showDisableForm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          Disable MFA
                        </h4>
                        <p className="text-sm text-gray-500">
                          Remove two-factor authentication from your account
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDisableForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Disable
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleDisableRequest} className="space-y-4">
                      <div>
                        <label
                          htmlFor="disableCode"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Enter MFA code to confirm disable
                        </label>
                        <input
                          type="text"
                          id="disableCode"
                          value={disableCode}
                          onChange={(e) => setDisableCode(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="6-digit code"
                          maxLength={6}
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Note: Disabling MFA requires a 24-hour cooldown period.
                        </p>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Confirm Disable
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDisableForm(false);
                            setDisableCode("");
                          }}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
