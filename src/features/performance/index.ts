/**
 * Performance Feature Exports
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 */

export * from './types';
export * from './components/MetricCard';
export * from './components/DateRangePicker';
export * from './components/PerformanceView';
export * from './hooks/usePerformanceMetrics';
export * from './services/metrics-service';

// Re-export with traceId support
export type { PerformanceMetrics, PerformanceMetricsResponse, DateRange, PerformanceState } from './types';

// Re-export for cache invalidation
export { invalidateMetricsCache } from './services/metrics-service';
