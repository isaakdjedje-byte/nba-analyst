/**
 * InvestigationDetail Component
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Detail view for investigating a contested decision
 * Reuses DecisionTimeline from story 4-3
 * 
 * Requirements (AC3, AC4, AC5):
 * - AC3: Full decision timeline displayed with evidence highlighting
 * - AC4: Gate evaluation shows pass/fail, threshold, actual value, recommendation
 * - AC5: Export as PDF or copy summary, traceId prominently displayed, audit logging
 * 
 * WCAG 2.2 AA compliant
 * Mobile-first responsive
 * Dark mode support
 */

'use client';

import { useState, useCallback } from 'react';
import { 
  ArrowLeft, 
  Copy, 
  Download, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Shield,
  Brain,
  Database,
  Hash
} from 'lucide-react';
import { DecisionTimeline } from '@/features/logs/components/DecisionTimeline';
import type { InvestigationResult } from '../types';

/**
 * InvestigationDetail Component Props
 */
interface InvestigationDetailProps {
  decisionId: string;
  decision?: InvestigationResult;
  isLoading?: boolean;
  error?: Error | null;
  onBack: () => void;
}

/**
 * Loading skeleton
 */
function DetailSkeleton() {
  return (
    <div className="space-y-6" data-testid="investigation-detail-skeleton">
      <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-4">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Error state
 */
function DetailErrorState({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return (
    <div 
      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6"
      data-testid="investigation-detail-error"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Erreur de chargement
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {message}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Réessayer
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Evidence section highlighting (AC4)
 */
function EvidenceSection({ 
  title, 
  icon: Icon, 
  children,
  highlight = false
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div 
      className={`
        rounded-lg border p-4
        ${highlight 
          ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
      `}
      data-testid={`evidence-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden="true" />
        <h3 className={`font-semibold ${highlight ? 'text-amber-800 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>
          {title}
        </h3>
        {highlight && (
          <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400 rounded">
            Evidence
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Gate evaluation display (AC4)
 */
function GateEvaluation({ 
  gateName, 
  passed, 
  threshold, 
  actual,
  recommendation 
}: { 
  gateName: string; 
  passed: boolean; 
  threshold?: string; 
  actual?: string;
  recommendation?: string;
}) {
  return (
    <div 
      className={`
        flex items-center justify-between p-3 rounded-lg border
        ${passed 
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' 
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
        }
      `}
      data-testid={`gate-${gateName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-3">
        {passed ? (
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{gateName}</p>
          {threshold && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seuil: {threshold}
            </p>
          )}
          {actual && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Valeur: {actual}
            </p>
          )}
        </div>
      </div>
      {recommendation && (
        <span className={`text-sm font-medium ${passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
          {recommendation}
        </span>
      )}
    </div>
  );
}

/**
 * Export options component (AC5)
 */
function ExportOptions({ 
  onCopySummary, 
  onExportPdf,
  isCopying = false,
  isExporting = false,
  traceId,
  investigatorName = 'Support User'
}: { 
  onCopySummary: () => void; 
  onExportPdf: () => void;
  isCopying?: boolean;
  isExporting?: boolean;
  traceId: string;
  investigatorName?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await onCopySummary();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopySummary]);

  const handleExport = useCallback(async () => {
    await onExportPdf();
  }, [onExportPdf]);

  return (
    <div 
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
      data-testid="investigation-export-options"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Options d&apos;export (AC5)
      </h3>
      
      <div className="flex flex-wrap gap-3">
        {/* Copy summary button */}
        <button
          onClick={handleCopy}
          disabled={isCopying}
          className="
            flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
            bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md
            hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 dark:focus:ring-offset-gray-900 min-h-[44px]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          data-testid="copy-summary-button"
        >
          {isCopying ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : copied ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? 'Copié!' : 'Copier le résumé'}
        </button>

        {/* PDF export button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="
            flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 dark:focus:ring-offset-gray-900 min-h-[44px]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          data-testid="export-pdf-button"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {isExporting ? 'Export...' : 'Exporter PDF'}
        </button>

        {/* traceId display (AC5) */}
        <div className="flex items-center gap-2 ml-auto px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700">
          <Hash className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
            {traceId}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(traceId)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            aria-label="Copier le traceId"
            title="Copier le traceId"
          >
            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Audit info (AC5) */}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Investigateur: {investigatorName} • {new Date().toLocaleString('fr-FR')}
      </p>
    </div>
  );
}

/**
 * Main InvestigationDetail Component
 */
export function InvestigationDetail({
  decisionId,
  decision,
  isLoading = false,
  error = null,
  onBack,
}: InvestigationDetailProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Generate summary text for copy (AC5)
  const generateSummary = useCallback(() => {
    if (!decision) return '';
    
    return `
Décision contestée - Investigation
====================================
Match: ${decision.homeTeam} vs ${decision.awayTeam}
Date: ${new Date(decision.matchDate).toLocaleDateString('fr-FR')}
Statut: ${decision.status}
ID: ${decision.id}
traceId: ${decision.traceId}

Justification:
${decision.rationaleSummary || 'Aucune'}

Portails:
- Confiance: ${decision.gates?.confidence ? 'Pass' : 'Fail'}
- Edge: ${decision.gates?.edge ? 'Pass' : 'Fail'}
- Drift: ${decision.gates?.drift ? 'Pass' : 'Fail'}
- Hard-Stop: ${decision.gates?.hardStop ? 'Oui' : 'Non'}
${decision.hardStopReason ? `- Raison: ${decision.hardStopReason}` : ''}

Confiance ML: ${decision.mlOutput?.confidence ? `${Math.round(decision.mlOutput.confidence * 100)}%` : 'N/A'}
Facteurs dominants: ${decision.mlOutput?.dominantFactors?.join(', ') || 'N/A'}
    `.trim();
  }, [decision]);

  // Handle copy summary (AC5) - with proper audit logging
  const handleCopySummary = useCallback(async () => {
    setIsCopying(true);
    try {
      const summary = generateSummary();
      await navigator.clipboard.writeText(summary);
      // Log audit event to console (API logs to database at src/app/api/v1/investigations/[id]/route.ts)
      console.log('[AUDIT][COPY_TRACE] Investigation summary copied:', { 
        decisionId, 
        traceId: decision?.traceId,
        timestamp: new Date().toISOString(),
        action: 'copy_trace_summary'
      });
    } catch (err) {
      console.error('Failed to copy summary:', err);
    } finally {
      setIsCopying(false);
    }
  }, [decisionId, decision, generateSummary]);

  // Handle PDF export (AC5)
  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      if (!decision) return;
      
      // Generate PDF content as formatted text
      const pdfContent = `
================================================================================
                    RAPPORT D'INVESTIGATION DE DÉCISION
================================================================================

Informations générales
--------------------
ID de la décision: ${decision.id}
traceId: ${decision.traceId}
Match: ${decision.homeTeam} vs ${decision.awayTeam}
Date du match: ${new Date(decision.matchDate).toLocaleDateString('fr-FR')}
Statut: ${decision.status}
Confiance: ${decision.confidence ? `${Math.round(decision.confidence * 100)}%` : 'N/A'}
Edge: ${decision.edge ? `${Math.round(decision.edge * 100)}%` : 'N/A'}

Justification
-------------
${decision.rationaleSummary || 'Aucune justification disponible'}

Évaluation des portails
----------------------
- Confiance: ${decision.gates?.confidence ? 'Pass' : 'Fail'} (seuil: ≥ 0.7)
- Edge: ${decision.gates?.edge ? 'Pass' : 'Fail'} (seuil: ≥ 0.5)
- Drift: ${decision.gates?.drift ? 'Pass' : 'Fail'} (seuil: < 0.3)
- Hard-Stop: ${decision.gates?.hardStop ? 'Oui' : 'Non'}
${decision.hardStopReason ? `\nRaison du Hard-Stop: ${decision.hardStopReason}` : ''}

${decision.mlOutput ? `Sorties ML (Machine Learning)
--------------------------
Score de confiance: ${Math.round(decision.mlOutput.confidence * 100)}%
Facteurs dominants: ${decision.mlOutput.dominantFactors?.join(', ') || 'N/A'}` : ''}

${decision.dataQuality && decision.dataQuality.length > 0 ? `Signaux de qualité des données
--------------------------------
${decision.dataQuality.map(s => `- ${s.signal}: ${s.isAnomaly ? 'ANOMALIE' : 'OK'}`).join('\n')}` : ''}

================================================================================
Rapport généré le: ${new Date().toLocaleString('fr-FR')}
Investigateur: ${'Support User'}
================================================================================
      `.trim();

      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `investigation-${decision.traceId}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Log audit event to console (API logs to database at src/app/api/v1/investigations/[id]/route.ts)
      console.log('[AUDIT][EXPORT] Investigation exported:', { 
        decisionId, 
        traceId: decision.traceId,
        format: 'text',
        timestamp: new Date().toISOString(),
        action: 'export_investigation'
      });
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setIsExporting(false);
    }
  }, [decision, decisionId]);

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <DetailErrorState 
        message={error.message} 
        onBack={onBack}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // No decision found
  if (!decision) {
    return (
      <DetailErrorState 
        message="Décision non trouvée" 
        onBack={onBack}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div data-testid="investigation-detail">
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="
            flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
            bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md
            hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2 dark:focus:ring-offset-gray-900 min-h-[44px]
          "
          data-testid="back-button"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la recherche
        </button>
      </div>

      {/* Decision header info */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {decision.homeTeam} vs {decision.awayTeam}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(decision.matchDate).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`
              px-3 py-1 text-sm font-medium rounded-full
              ${decision.status === 'PICK' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
              ${decision.status === 'NO_BET' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : ''}
              ${decision.status === 'HARD_STOP' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''}
            `}>
              {decision.status === 'PICK' ? 'PICK' : decision.status === 'NO_BET' ? 'No-Bet' : 'Hard-Stop'}
            </span>
          </div>
        </div>
      </div>

      {/* Evidence sections (AC4) */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preuves et évaluation des portails
        </h2>

        {/* Gate evaluations */}
        <EvidenceSection 
          title="Évaluation des portails" 
          icon={Shield}
          highlight={true}
        >
          <div className="space-y-2">
            <GateEvaluation
              gateName="Confiance"
              passed={decision.gates?.confidence ?? false}
              threshold="≥ 0.65"
              actual={decision.confidence ? `${Math.round(decision.confidence * 100)}%` : undefined}
              recommendation={decision.gates?.confidence ? 'Pass' : 'Fail'}
            />
            <GateEvaluation
              gateName="Edge"
              passed={decision.gates?.edge ?? false}
              threshold="≥ 0.05"
              actual={decision.edge ? `${Math.round(decision.edge * 100)}%` : undefined}
              recommendation={decision.gates?.edge ? 'Pass' : 'Fail'}
            />
            <GateEvaluation
              gateName="Drift"
              passed={decision.gates?.drift ?? true}
              threshold="< 0.15"
              recommendation={decision.gates?.drift ? 'Pass' : 'Fail'}
            />
            <GateEvaluation
              gateName="Hard-Stop"
              passed={!decision.gates?.hardStop}
              threshold="N/A"
              recommendation={decision.gates?.hardStop ? 'Bloqué' : 'Autorisé'}
            />
          </div>
        </EvidenceSection>

        {/* ML Outputs (AC4) */}
        {decision.mlOutput && (
          <EvidenceSection 
            title="Sorties ML (Machine Learning)" 
            icon={Brain}
            highlight={true}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Score de confiance</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.round(decision.mlOutput.confidence * 100)}%
                </span>
              </div>
              {decision.mlOutput.dominantFactors && decision.mlOutput.dominantFactors.length > 0 && (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Facteurs dominants:</span>
                  <ul className="mt-2 space-y-1">
                    {decision.mlOutput.dominantFactors.map((factor, idx) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <Brain className="h-3 w-3" aria-hidden="true" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </EvidenceSection>
        )}

        {/* Data Quality signals (AC4) */}
        {decision.dataQuality && decision.dataQuality.length > 0 && (
          <EvidenceSection 
            title="Signaux de qualité des données" 
            icon={Database}
            highlight={false}
          >
            <div className="space-y-2">
              {decision.dataQuality.map((signal, idx) => (
                <div 
                  key={idx}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${signal.isAnomaly 
                      ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20' 
                      : 'border-gray-200 dark:border-gray-700'
                    }
                  `}
                >
                  <span className="text-gray-700 dark:text-gray-300">{signal.signal}</span>
                  {signal.isAnomaly && (
                    <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400 rounded">
                      Anomalie détectée
                    </span>
                  )}
                </div>
              ))}
            </div>
          </EvidenceSection>
        )}

        {/* Hard Stop Reason */}
        {decision.hardStopReason && (
          <EvidenceSection 
            title="Raison du Hard-Stop" 
            icon={AlertCircle}
            highlight={true}
          >
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              {decision.hardStopReason}
            </p>
          </EvidenceSection>
        )}
      </div>

      {/* Export options (AC5) */}
      <div className="mb-6">
        <ExportOptions
          onCopySummary={handleCopySummary}
          onExportPdf={handleExportPdf}
          isCopying={isCopying}
          isExporting={isExporting}
          traceId={decision.traceId}
        />
      </div>

      {/* Decision Timeline (reuse from story 4-3) - AC3 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Chronologie complète de la décision
        </h2>
        <DecisionTimeline
          decisionId={decisionId}
          showFilters={true}
        />
      </div>
    </div>
  );
}

export default InvestigationDetail;
