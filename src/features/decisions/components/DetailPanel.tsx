/**
 * DetailPanel Component
 * Story 3.5: Ajouter le panneau de détails extensible
 *
 * Main component that assembles all detailed sections:
 * - ConfidenceEdgeSection: Edge and confidence breakdown
 * - GatesDetailSection: Detailed gate outcomes
 * - DataSignalsSection: Data sources and ML info
 * - MetadataSection: Audit metadata with copy functionality
 * - BlockCausePanel: Block cause information (Story 5.1)
 *
 * AC1-9: All acceptance criteria covered
 */

'use client';

import React from 'react';
import { ConfidenceEdgeSection } from './DetailPanel/ConfidenceEdgeSection';
import { GatesDetailSection } from './DetailPanel/GatesDetailSection';
import { DataSignalsSection } from './DetailPanel/DataSignalsSection';
import { MetadataSection } from './DetailPanel/MetadataSection';
import { BlockCausePanel } from './BlockCausePanel';
import { detectBlockCauseCategory } from '../types';
import type { DecisionDetail } from '../types';

interface DetailPanelProps {
  decision: DecisionDetail;
  isExpanded: boolean;
}

/**
 * DetailPanel - Displays comprehensive decision details
 *
 * AC2: Complete detailed content
 * AC3: Detailed gate outcomes
 * AC4: Data signals and metadata
 * AC7: Performance optimized with progressive disclosure
 * AC9: Graceful degradation for missing data
 */
export function DetailPanel({ decision, isExpanded }: DetailPanelProps) {
  // Don't render if not expanded
  if (!isExpanded) {
    return null;
  }

  // Check if decision is blocked by policy
  const isBlocked = decision.status === 'HARD_STOP';

  return (
    <div
      data-testid="detail-panel"
      className="detail-panel border-t border-gray-200 dark:border-gray-700 pt-4 mt-4"
    >
      <div className="space-y-6">
        {/* AC2: Confidence and Edge Breakdown */}
        <ConfidenceEdgeSection decision={decision} />

        {/* AC3: Gates Detail */}
        <GatesDetailSection gates={decision.gates} />

        {/* Story 5.1: Block Cause Panel for HARD_STOP decisions */}
        {isBlocked && decision.hardStopReason && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Cause du blocage
            </h4>
            <BlockCausePanel
              decisionId={decision.id}
              cause={{
                ruleName: 'HARD_STOP_RULE',
                ruleDescription: decision.hardStopReason,
                triggeredAt: decision.createdAt,
                currentValue: 1,
                threshold: 0,
                recommendation: decision.recommendedAction || 'Contactez le support pour plus d\'informations.',
                category: detectBlockCauseCategory(decision.hardStopReason),
              }}
              expanded={true}
            />
          </div>
        )}

        {/* AC4: Data Signals */}
        <DataSignalsSection dataSignals={decision.dataSignals} />

        {/* AC4: Metadata & Audit */}
        <MetadataSection metadata={decision.metadata} />
      </div>
    </div>
  );
}

export default DetailPanel;
