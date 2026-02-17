/**
 * Web Vitals Monitoring
 * Story 3.8: AC4 Performance monitoring - FCP, TTI, CLS, LCP, FID
 * 
 * Tracks Core Web Vitals and reports to console/analytics
 */

import { onCLS, onFCP, onFID, onLCP, onTTFB, type Metric } from 'web-vitals';

declare global {
  interface Window {
    gtag?: (event: string, action: string, params?: Record<string, unknown>) => void;
    __webVitals?: Record<string, VitalsReport>;
  }
}

// Thresholds based on AC4 requirements
const PERFORMANCE_THRESHOLDS = {
  FCP: 1500, // First Contentful Paint < 1.5s
  LCP: 2500, // Largest Contentful Paint < 2.5s
  FID: 100,  // First Input Delay < 100ms
  CLS: 0.1,  // Cumulative Layout Shift < 0.1
  TTFB: 600, // Time to First Byte < 600ms
  TTI: 3000, // Time to Interactive < 3s
};

type MetricRating = 'good' | 'needs-improvement' | 'poor';

interface VitalsReport {
  name: string;
  value: number;
  rating: MetricRating;
  delta?: number;
  id?: string;
  navigationType?: string;
}

/**
 * Get rating based on metric thresholds
 */
function getRating(name: string, value: number): MetricRating {
  switch (name) {
    case 'FCP':
      return value <= PERFORMANCE_THRESHOLDS.FCP ? 'good' : value <= PERFORMANCE_THRESHOLDS.FCP * 2 ? 'needs-improvement' : 'poor';
    case 'LCP':
      return value <= PERFORMANCE_THRESHOLDS.LCP ? 'good' : value <= PERFORMANCE_THRESHOLDS.LCP * 2 ? 'needs-improvement' : 'poor';
    case 'FID':
      return value <= PERFORMANCE_THRESHOLDS.FID ? 'good' : value <= PERFORMANCE_THRESHOLDS.FID * 3 ? 'needs-improvement' : 'poor';
    case 'CLS':
      return value <= PERFORMANCE_THRESHOLDS.CLS ? 'good' : value <= PERFORMANCE_THRESHOLDS.CLS * 2 ? 'needs-improvement' : 'poor';
    case 'TTFB':
      return value <= PERFORMANCE_THRESHOLDS.TTFB ? 'good' : value <= PERFORMANCE_THRESHOLDS.TTFB * 2 ? 'needs-improvement' : 'poor';
    default:
      return 'needs-improvement';
  }
}

/**
 * Report metric to console
 */
function reportToConsole(vitalsReport: VitalsReport): void {
  const emoji = vitalsReport.rating === 'good' ? '✅' : vitalsReport.rating === 'needs-improvement' ? '⚠️' : '❌';
  const style = vitalsReport.rating === 'good' ? 'color: green' : vitalsReport.rating === 'needs-improvement' ? 'color: orange' : 'color: red';
  
  console.log(
    `%c${emoji} ${vitalsReport.name}: ${vitalsReport.value.toFixed(2)} (${vitalsReport.rating})`,
    style,
    vitalsReport
  );
}

/**
 * Report metric to analytics endpoint
 */
function reportToAnalytics(vitalsReport: VitalsReport): void {
  // Send to your analytics endpoint
  // Example: gtag('event', 'web_vitals', { ... })
  
  if (typeof window !== 'undefined' && 'gtag' in window) {
    window.gtag?.('event', 'web_vitals', {
      event_category: 'Web Vitals',
      event_label: vitalsReport.name,
      value: Math.round(vitalsReport.value),
      custom_parameter_1: vitalsReport.rating,
    });
  }

  // Also report to performance observer for debugging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // Store in window for debugging
    window.__webVitals = window.__webVitals || {};
    window.__webVitals[vitalsReport.name] = vitalsReport;
  }
}

/**
 * Handle metric reporting
 */
function handleMetric(metric: Metric): void {
  const report: VitalsReport = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };

  reportToConsole(report);
  reportToAnalytics(report);
}

/**
 * Initialize Web Vitals monitoring
 * Call this in your app layout or entry point
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  onCLS(handleMetric);   // Cumulative Layout Shift
  onFCP(handleMetric);   // First Contentful Paint
  onFID(handleMetric);   // First Input Delay
  onLCP(handleMetric);   // Largest Contentful Paint
  onTTFB(handleMetric);  // Time to First Byte

  console.log('🔍 Web Vitals monitoring initialized');
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): VitalsReport[] {
  if (typeof window === 'undefined') return [];
  
  const vitals = window.__webVitals || {};
  return Object.values(vitals);
}

/**
 * Measure Time to Interactive (TTI)
 * AC4 requirement: TTI < 3s
 * Uses PerformanceObserver to detect when page is truly interactive
 */
export function measureTTI(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(0);
      return;
    }

    const domContentLoaded = performance.timing?.domContentLoadedEventEnd || 0;
    const navigationStart = performance.timing?.navigationStart || performance.now();
    let lastLongTaskTime = 0;
    let ttiDetected = false;

    // Use PerformanceObserver to detect long tasks
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            lastLongTaskTime = entry.startTime + entry.duration;
          }
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
      
      // Check periodically if page is interactive
      const checkInterval = setInterval(() => {
        // TTI is reached when:
        // 1. DOM is ready
        // 2. No long tasks have occurred in the last 50ms
        // 3. At least 50ms has passed since DOMContentLoaded
        
        const now = performance.now();
        const timeSinceDL = now - domContentLoaded;
        const timeSinceLongTask = now - (navigationStart + lastLongTaskTime);
        
        if (timeSinceDL > 50 && timeSinceLongTask > 50 && !ttiDetected) {
          ttiDetected = true;
          clearInterval(checkInterval);
          observer.disconnect();
          
          const tti = now - navigationStart;
          resolve(tti);
        }
      }, 50);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        observer.disconnect();
        const tti = performance.now() - navigationStart;
        resolve(tti);
      }, 10000);
      
    } catch {
      // Fallback: use basic timing
      const tti = performance.now() - navigationStart;
      resolve(tti);
    }
  });
}

export { PERFORMANCE_THRESHOLDS };
export type { VitalsReport, MetricRating };
