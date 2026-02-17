/**
 * Retry Helpers
 * Deterministic polling utilities for waiting on conditions
 * 
 * Replaces hard waits (setTimeout) with condition-based polling
 */

export interface RetryOptions {
  maxAttempts: number;
  intervalMs: number;
  timeoutMs?: number;
}

/**
 * Wait for a condition to be true with retry logic
 * Replaces hard waits with deterministic polling
 * 
 * @param conditionFn - Function that returns the current state
 * @param predicate - Function that returns true when condition is met
 * @param options - Retry configuration
 * @returns The final state when predicate returns true
 * @throws Error if max attempts exceeded
 */
export async function waitForCondition<T>(
  conditionFn: () => Promise<T> | T,
  predicate: (state: T) => boolean,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, intervalMs, timeoutMs } = options;
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const state = await conditionFn();
    
    if (predicate(state)) {
      return state;
    }
    
    // Check timeout if specified
    if (timeoutMs && Date.now() - startTime >= timeoutMs) {
      throw new Error(`Timeout after ${timeoutMs}ms. Condition not met after ${attempt} attempts.`);
    }
    
    // Don't wait after the last attempt
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  const finalState = await conditionFn();
  throw new Error(`Condition not met after ${maxAttempts} attempts. Final state: ${JSON.stringify(finalState)}`);
}

/**
 * Wait for a value to equal an expected value
 * Convenience function for simple equality checks
 */
export async function waitForValue<T>(
  conditionFn: () => Promise<T> | T,
  expectedValue: T,
  options: RetryOptions
): Promise<T> {
  return waitForCondition(
    conditionFn,
    (state) => state === expectedValue,
    options
  );
}

/**
 * Wait for a value to be truthy
 */
export async function waitForTruthy<T>(
  conditionFn: () => Promise<T> | T,
  options: RetryOptions
): Promise<T> {
  return waitForCondition(
    conditionFn,
    (state) => Boolean(state),
    options
  );
}

/**
 * Retry a function until it succeeds or max attempts reached
 * Useful for flaky operations
 */
export async function retry<T>(
  operation: () => Promise<T> | T,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, intervalMs } = options;
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

/**
 * Exponential backoff retry
 * Increases interval between attempts
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T> | T,
  options: {
    maxAttempts: number;
    initialIntervalMs: number;
    maxIntervalMs?: number;
    backoffMultiplier?: number;
  }
): Promise<T> {
  const {
    maxAttempts,
    initialIntervalMs,
    maxIntervalMs = 30000,
    backoffMultiplier = 2
  } = options;
  
  let lastError: Error | undefined;
  let interval = initialIntervalMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
        interval = Math.min(interval * backoffMultiplier, maxIntervalMs);
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxAttempts} attempts with exponential backoff: ${lastError?.message}`);
}
