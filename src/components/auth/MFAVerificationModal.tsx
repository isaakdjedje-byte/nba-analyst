"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface MFAVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: () => void;
  action: string;
  description?: string;
}

export function MFAVerificationModal({
  isOpen,
  onClose,
  onVerify,
  action,
  description,
}: MFAVerificationModalProps) {
  useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
          setCode("");
          onVerify();
        } else {
          setError(data.message || "Invalid verification code");
        }
      } catch {
        setError("An error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [code, onVerify]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Verify Your Identity
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    You are about to perform a sensitive action:
                    <span className="font-medium text-gray-900 block mt-1">
                      {action}
                    </span>
                  </p>
                  {description && (
                    <p className="text-sm text-gray-500 mt-2">{description}</p>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="mfa-code"
                      className="block text-sm font-medium text-gray-700 text-left"
                    >
                      {useBackupCode
                        ? "Backup Code (8 characters)"
                        : "Authentication Code (6 digits)"}
                    </label>
                    <input
                      type="text"
                      id="mfa-code"
                      inputMode={useBackupCode ? "text" : "numeric"}
                      pattern={useBackupCode ? "[a-zA-Z0-9]*" : "[0-9]*"}
                      maxLength={useBackupCode ? 8 : 6}
                      value={code}
                      onChange={(e) =>
                        setCode(
                          useBackupCode
                            ? e.target.value
                                .replace(/[^a-zA-Z0-9]/g, "")
                                .toLowerCase()
                            : e.target.value.replace(/\D/g, "")
                        )
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm tracking-widest text-center text-xl py-2"
                      placeholder={useBackupCode ? "abc12345" : "000000"}
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-50 p-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="flex flex-col space-y-2">
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
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        code.length !== (useBackupCode ? 8 : 6)
                      }
                      className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Verifying..." : "Verify"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage MFA re-verification with grace period
 */
export function useMFAVerification() {
  const { data: session, update } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    description?: string;
    onVerify: () => void;
  } | null>(null);

  /**
   * Request MFA verification for a sensitive action
   */
  const requestVerification = useCallback(
    (params: {
      action: string;
      description?: string;
      onVerify: () => void;
    }) => {
      // Check if MFA is required for this user
      if (!session?.user?.requiresMfa) {
        // MFA not required, proceed immediately
        params.onVerify();
        return;
      }

      // Check if MFA was recently verified (within grace period)
      if (session?.user?.mfaVerified) {
        params.onVerify();
        return;
      }

      // Show MFA verification modal
      setPendingAction(params);
      setShowModal(true);
    },
    [session]
  );

  /**
   * Handle successful MFA verification
   */
  const handleVerify = useCallback(async () => {
    // Update session to mark MFA as verified
    await update({ mfaVerified: true });

    // Close modal and execute pending action
    setShowModal(false);
    if (pendingAction) {
      pendingAction.onVerify();
    }
    setPendingAction(null);
  }, [pendingAction, update]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  const modal = showModal ? (
    <MFAVerificationModal
      isOpen={showModal}
      onClose={handleClose}
      onVerify={handleVerify}
      action={pendingAction?.action || ""}
      description={pendingAction?.description}
    />
  ) : null;

  return {
    requestVerification,
    modal,
    isVerifying: showModal,
  };
}
