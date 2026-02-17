/**
 * MetadataSection Component
 * Story 3.5: Display audit metadata with copy functionality
 *
 * AC4: Metadata and audit section
 * - Decision timestamp and traceId
 * - Policy version and runId
 * - Copy-to-clipboard functionality for traceId
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { AuditMetadata } from '../../types';

interface MetadataSectionProps {
  metadata?: AuditMetadata;
}

/**
 * Copy icon component
 */
function CopyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

/**
 * Check icon for copied state
 */
function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Formats ISO timestamp to readable format with timezone
 */
function formatTimestamp(isoString: string | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  } catch {
    return isoString;
  }
}

/**
 * Displays audit metadata section with copy functionality
 * AC4: Complete metadata display with copy-to-clipboard
 */
export function MetadataSection({ metadata }: MetadataSectionProps) {
  const [copiedTraceId, setCopiedTraceId] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const traceId = metadata?.traceId;

  /**
   * Copy traceId to clipboard
   * AC4: Copy-to-clipboard functionality
   */
  const handleCopyTraceId = useCallback(async () => {
    if (!traceId) return;

    try {
      await navigator.clipboard.writeText(traceId);
      setCopiedTraceId(true);
      setCopyError(false);
      setTimeout(() => setCopiedTraceId(false), 2000);
    } catch {
      setCopyError(true);
      setCopiedTraceId(false);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [traceId]);

  // AC9: Handle missing metadata gracefully
  if (!metadata) {
    return (
      <section
        aria-labelledby="metadata-heading"
        className="space-y-2"
        data-testid="metadata-section"
      >
        <h3
          id="metadata-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          Metadata Audit
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Informations de métadonnées non disponibles
        </p>
      </section>
    );
  }

  const { timestamp, policyVersion, runId, createdBy } = metadata;

  return (
    <section
      aria-labelledby="metadata-heading"
      className="space-y-4"
      data-testid="metadata-section"
    >
      <h3
        id="metadata-heading"
        className="text-sm font-semibold text-gray-900 dark:text-white"
      >
        Metadata Audit
      </h3>

      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
        <dl className="grid grid-cols-1 gap-3">
          {/* Trace ID with copy button */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">ID Trace</dt>
            <dd className="flex items-center gap-1">
              <code className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {traceId || 'N/A'}
              </code>
              {traceId && (
                <button
                  type="button"
                  onClick={handleCopyTraceId}
                  aria-label="Copier ID Trace"
                  data-testid="copy-traceid"
                  className={`
                    p-1 rounded transition-colors
                    ${copiedTraceId
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : copyError
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }
                  `}
                  title={copiedTraceId ? 'Copié !' : copyError ? 'Erreur lors de la copie' : 'Copier'}
                  aria-live="polite"
                >
                  {copiedTraceId ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : copyError ? (
                    <span className="text-xs">⚠️</span>
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </button>
              )}
            </dd>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Timestamp</dt>
            <dd className="text-sm text-gray-700 dark:text-gray-300">
              {formatTimestamp(timestamp)}
            </dd>
          </div>

          {/* Policy Version */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Version Policy</dt>
            <dd className="text-sm font-mono text-gray-700 dark:text-gray-300">
              {policyVersion || 'N/A'}
            </dd>
          </div>

          {/* Run ID */}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">ID Run</dt>
            <dd className="text-sm font-mono text-gray-700 dark:text-gray-300">
              {runId || 'N/A'}
            </dd>
          </div>

          {/* Created By */}
          {createdBy && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-gray-500 dark:text-gray-400">Créé par</dt>
              <dd className="text-sm text-gray-700 dark:text-gray-300">
                {createdBy}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        L&apos;ID Trace permet de retracer cette décision dans les logs système.
      </p>
    </section>
  );
}

export default MetadataSection;
