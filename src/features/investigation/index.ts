/**
 * Investigation Feature Index
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Re-exports all investigation components, hooks, and types
 */

// Components
export { InvestigationSearch } from './components/InvestigationSearch';
export { InvestigationDetail } from './components/InvestigationDetail';

// Hooks
export { useInvestigationSearch, useInvestigationDetail } from './hooks/useInvestigationSearch';

// Types
export type {
  InvestigationFilters,
  InvestigationSearchParams,
  InvestigationResult,
  InvestigationSearchResponse,
  InvestigationDetailResponse,
  InvestigationExportFormat,
  InvestigationExportRequest,
  InvestigationExportResponse,
  InvestigationAuditLog,
  InvestigationState,
} from './types';
