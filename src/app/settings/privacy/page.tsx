/**
 * Privacy Settings Page
 * RGPD compliance features: data export, account deletion, retention info
 * Per Story 1.5 - AC #2, #3
 */

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Force dynamic rendering to avoid SSR/prerender issues
export const dynamic = "force-dynamic";

interface DataExport {
  id: string;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string;
  status: string;
}

export default function PrivacySettingsPage() {
  const session = useSession();
  const sessionData = session?.data;
  const sessionStatus = session?.status;
  const router = useRouter();

  const [exports, setExports] = useState<DataExport[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletionStatus, setDeletionStatus] = useState<{
    pending: boolean;
    scheduledFor?: string;
    daysRemaining?: number;
  } | null>(null);
  const [sessionTimeoutError, setSessionTimeoutError] = useState<string | null>(null);

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
    if (sessionData?.user) {
      loadExports();
      checkDeletionStatus();
    }
  }, [sessionData?.user]);

  const loadExports = async () => {
    try {
      const response = await fetch("/api/v1/user/export-data");
      if (response.ok) {
        const data = await response.json();
        setExports(data.data.exports || []);
      }
    } catch (error) {
      console.error("Failed to load exports:", error);
    }
  };

  const checkDeletionStatus = async () => {
    try {
      const response = await fetch("/api/v1/user/deletion-status");
      if (response.ok) {
        const data = await response.json();
        setDeletionStatus(data.data);
      }
    } catch (error) {
      console.error("Failed to check deletion status:", error);
    }
  };

  const requestDataExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/user/export-data", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({
          type: "success",
          text: `Export généré avec succès. Expire le: ${new Date(data.data.expiresAt).toLocaleDateString()}`,
        });
        loadExports();
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.error?.message || "Échec de la génération de l'export",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Erreur lors de la génération de l'export",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const requestAccountDeletion = async () => {
    if (!confirmDelete) {
      setMessage({ type: "error", text: "Vous devez confirmer la suppression" });
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: deleteReason,
          confirm: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({
          type: "success",
          text: `Suppression programmée pour le: ${new Date(data.data.scheduledDeletionDate).toLocaleDateString()}`,
        });
        setShowDeleteConfirm(false);
        checkDeletionStatus();
      } else {
        const error = await response.json();
        setMessage({
          type: "error",
          text: error.error?.message || "Échec de la demande de suppression",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Erreur lors de la demande de suppression",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeletion = async () => {
    try {
      const response = await fetch("/api/v1/user/cancel-deletion", {
        method: "POST",
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Demande de suppression annulée" });
        setDeletionStatus(null);
      } else {
        setMessage({ type: "error", text: "Échec de l'annulation" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'annulation" });
    }
  };

  if (sessionStatus === "loading" || !sessionData) {
    if (sessionTimeoutError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Session Error</h2>
            <p className="text-gray-700">{sessionTimeoutError}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Paramètres de confidentialité</h1>
      <p className="text-gray-600 mb-8">
        Gérez vos données personnelles et vos droits RGPD
      </p>

      {message && (
        <div
          className={`p-4 mb-6 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}

      {/* Data Export Section */}
      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          📥 Export de vos données (Portabilité)
        </h2>
        <p className="text-gray-600 mb-4">
          Téléchargez une copie de vos données personnelles au format JSON.
          L&apos;export sera disponible pendant 7 jours.
        </p>

        <button
          onClick={requestDataExport}
          disabled={isExporting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Demander l'export des données"
        >
          {isExporting ? "Génération en cours..." : "Exporter mes données"}
        </button>

        {exports.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">Exports disponibles:</h3>
            <ul className="space-y-2">
              {exports.map((exp) => (
                <li
                  key={exp.id}
                  className="flex justify-between items-center bg-gray-50 p-3 rounded"
                >
                  <span>
                    Export du{" "}
                    {new Date(exp.requestedAt).toLocaleDateString()}
                    {exp.status === "completed" && (
                      <span className="text-green-600 ml-2">✓ Disponible</span>
                    )}
                    {exp.status === "expired" && (
                      <span className="text-red-600 ml-2">✗ Expiré</span>
                    )}
                  </span>
                  {exp.status === "completed" && (
                    <a
                      href={`/api/v1/user/export-data/${exp.id}/download`}
                      className="text-blue-600 hover:underline"
                      download
                    >
                      Télécharger
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Data Retention Info */}
      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          📅 Conservation des données
        </h2>
        <div className="space-y-3 text-gray-600">
          <p>
            <strong>Données de compte:</strong> 365 jours après demande de suppression
          </p>
          <p>
            <strong>Logs d&apos;audit:</strong> 7 ans (obligation légale)
          </p>
          <p>
            <strong>Exports de données:</strong> 7 jours maximum
          </p>
          <p>
            <strong>Sessions:</strong> 30 jours après expiration
          </p>
        </div>
      </section>

      {/* Account Deletion Section */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-600">
          ⚠️ Suppression du compte
        </h2>

        {deletionStatus?.pending ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="font-medium text-yellow-800">
              Suppression programmée
            </p>
            <p className="text-yellow-700">
              Votre compte sera définitivement supprimé le:{" "}
              {new Date(deletionStatus.scheduledFor!).toLocaleDateString()}
            </p>
            <p className="text-yellow-700">
              Jours restants: {deletionStatus.daysRemaining}
            </p>
            <button
              onClick={cancelDeletion}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Annuler la suppression
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Demandez la suppression définitive de votre compte. Cette action
              est irréversible. Vous disposez d&apos;un délai de 30 jours pour
              annuler la suppression.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
                aria-label="Supprimer mon compte"
              >
                Supprimer mon compte
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-bold text-red-800 mb-4">
                  ⚠️ Attention: Cette action est irréversible!
                </p>

                <div className="mb-4">
                  <label
                    htmlFor="delete-reason"
                    className="block text-sm font-medium mb-2"
                  >
                    Raison de la suppression (optionnel):
                  </label>
                  <select
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Sélectionnez une raison...</option>
                    <option value="not_using">Je n&apos;utilise plus le service</option>
                    <option value="privacy">Préoccupations de confidentialité</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      Je confirme vouloir supprimer définitivement mon compte
                    </span>
                  </label>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={requestAccountDeletion}
                    disabled={isDeleting || !confirmDelete}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Traitement..." : "Confirmer la suppression"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Legal Links */}
      <section className="mt-8 text-center">
        <p className="text-gray-600">
          Pour plus d&apos;informations, consultez notre{" "}
          <a href="/privacy" className="text-blue-600 hover:underline">
            Politique de confidentialité
          </a>{" "}
          et nos{" "}
          <a href="/terms" className="text-blue-600 hover:underline">
            Conditions d&apos;utilisation
          </a>
          .
        </p>
      </section>
    </div>
  );
}
