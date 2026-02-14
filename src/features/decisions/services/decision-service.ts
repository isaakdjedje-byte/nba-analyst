/**
 * Decision Service
 * Service layer for fetching decision data
 * Story 3.2: Implement Picks view with today's decisions list
 */

import type { DecisionsResponse, ApiError } from '../types';

const API_BASE = '/api/v1';

/**
 * Fetch today's decisions
 * @param date Optional date filter (ISO string)
 * @param status Optional status filter
 * @returns Decisions response with data and metadata
 */
export async function fetchDecisions(
  date?: string,
  status?: string
): Promise<DecisionsResponse> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);

  const queryString = params.toString();
  const url = `${API_BASE}/decisions${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.error?.message || 'Failed to fetch decisions');
  }

  return data as DecisionsResponse;
}

/**
 * Fetch decisions with retry logic
 * @param retries Number of retry attempts
 * @param delayMs Delay between retries
 */
export async function fetchDecisionsWithRetry(
  date?: string,
  status?: string,
  retries = 3,
  delayMs = 1000
): Promise<DecisionsResponse> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchDecisions(date, status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Failed to fetch decisions after retries');
}

/**
 * Format match time for display
 * @param startTime ISO datetime string
 * @returns Formatted time string
 */
export function formatMatchTime(startTime: string | null): string {
  if (!startTime) return 'TBD';
  
  const date = new Date(startTime);
  if (isNaN(date.getTime())) return 'TBD';

  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format edge percentage for display
 * @param edge Edge value (e.g., 0.052)
 * @returns Formatted percentage string
 */
export function formatEdge(edge: number | null): string {
  if (edge === null || edge === undefined) return 'N/A';
  return `${(edge * 100).toFixed(1)}%`;
}

/**
 * Format confidence percentage for display
 * @param confidence Confidence value (e.g., 0.78)
 * @returns Formatted percentage string
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
