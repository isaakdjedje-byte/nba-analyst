/**
 * PolicyVersionHistory Component
 * Story 5.3: Implementer le versioning et historique des changements policy
 * 
 * Displays policy version history timeline with restore functionality
 */

'use client';

import React, { useState } from 'react';
import { 
  History, 
  RotateCcw, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { usePolicyVersions, useRestorePolicyVersion, calculateVersionDiff } from '../hooks/usePolicyVersions';
import type { PolicyVersion } from '../hooks/usePolicyVersions';

interface PolicyVersionHistoryProps {
  onVersionRestored?: () => void;
}

/**
 * Policy Version History Panel
 * Displays timeline of configuration changes with restore capability
 */
export function PolicyVersionHistory({ onVersionRestored }: PolicyVersionHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  
  const { data: versionData, isLoading, error, refetch } = usePolicyVersions(20, 0);
  const restoreMutation = useRestorePolicyVersion();

  const versions = versionData?.data?.versions || [];
  const total = versionData?.data?.total || 0;

  const handleRestore = async (versionId: string) => {
    try {
      await restoreMutation.mutateAsync(versionId);
      setShowRestoreConfirm(null);
      onVersionRestored?.();
      refetch();
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Historique des versions</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>Erreur lors du chargement de l&apos;historique</span>
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Historique des versions</h3>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Aucun historique de version disponible
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Historique des versions</h3>
          <span className="text-sm text-gray-500">({total} versions)</span>
        </div>
        <a
          href="/api/v1/policy/config/history/export?format=json"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter
        </a>
      </div>

      <div className="space-y-2">
        {versions.map((version, index) => (
          <VersionCard
            key={version.id}
            version={version}
            isExpanded={expandedVersion === version.id}
            onToggle={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
            onRestore={() => setShowRestoreConfirm(version.id)}
            isRestoring={restoreMutation.isPending && showRestoreConfirm === version.id}
            showRestoreConfirm={showRestoreConfirm === version.id}
            onConfirmRestore={() => handleRestore(version.id)}
            onCancelRestore={() => setShowRestoreConfirm(null)}
            isLatest={index === 0}
            previousVersion={versions[index + 1]}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual version card component
 */
interface VersionCardProps {
  version: PolicyVersion;
  isExpanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  isRestoring: boolean;
  showRestoreConfirm: boolean;
  onConfirmRestore: () => void;
  onCancelRestore: () => void;
  isLatest: boolean;
  previousVersion?: PolicyVersion;
}

function VersionCard({
  version,
  isExpanded,
  onToggle,
  onRestore,
  isRestoring,
  showRestoreConfirm,
  onConfirmRestore,
  onCancelRestore,
  isLatest,
  previousVersion,
}: VersionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const diffs = previousVersion 
    ? calculateVersionDiff(previousVersion, version)
    : [];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Version header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            version.isRestore 
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
          }`}>
            {version.isRestore ? <RotateCcw className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Version {version.version}</span>
              {isLatest && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  Actuelle
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatDate(version.createdAt)}</span>
              <span>•</span>
              <User className="w-3 h-3" />
              <span>{version.createdBy}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isLatest && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              disabled={isRestoring}
              className="flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurer
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Confirmation dialog */}
      {showRestoreConfirm && (
        <div className="px-3 pb-3">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Confirmer la restauration ?
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Cette action remplacera la configuration actuelle par la version {version.version}.
                </p>
                {diffs.length > 0 && (
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-medium">Modifications:</p>
                    <ul className="list-disc list-inside mt-1">
                      {diffs.map((diff) => (
                        <li key={diff.key}>
                          {diff.path}: {diff.oldValue} → {diff.newValue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onConfirmRestore}
                    disabled={isRestoring}
                    className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isRestoring ? 'Restauration...' : 'Confirmer'}
                  </button>
                  <button
                    onClick={onCancelRestore}
                    disabled={isRestoring}
                    className="px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
          <div className="py-3 space-y-3">
            {version.changeReason && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Raison</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{version.changeReason}</p>
              </div>
            )}
            
            {version.isRestore && version.previousVersionId && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <RotateCcw className="w-4 h-4" />
                <span>Restauré depuis la version {version.previousVersionId}</span>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration</p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm font-mono">
                <ConfigDisplay config={version.config} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Display policy configuration in a readable format
 */
function ConfigDisplay({ config }: { config: PolicyVersion['config'] }) {
  return (
    <div className="space-y-2">
      <div>
        <span className="text-gray-500 dark:text-gray-400">Confiance: </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          {(config.confidence.minThreshold * 100).toFixed(0)}%
        </span>
      </div>
      <div>
        <span className="text-gray-500 dark:text-gray-400">Edge: </span>
        <span className="text-blue-600 dark:text-blue-400">
          {(config.edge.minThreshold * 100).toFixed(0)}%
        </span>
      </div>
      <div>
        <span className="text-gray-500 dark:text-gray-400">Dérive: </span>
        <span className="text-purple-600 dark:text-purple-400">
          {(config.drift.maxDriftScore * 100).toFixed(0)}%
        </span>
      </div>
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Limite quotidienne: </span>
          <span className="text-orange-600 dark:text-orange-400">
            €{config.hardStops.dailyLossLimit}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Pertes consécutives: </span>
          <span className="text-orange-600 dark:text-orange-400">
            {config.hardStops.consecutiveLosses}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Bankroll: </span>
          <span className="text-orange-600 dark:text-orange-400">
            {(config.hardStops.bankrollPercent * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default PolicyVersionHistory;
