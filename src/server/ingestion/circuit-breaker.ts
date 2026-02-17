/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services are down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening (default: 5)
  resetTimeout: number;          // Time in ms before half-open (default: 60000)
  halfOpenMaxCalls: number;      // Max calls in half-open state (default: 3)
  successThreshold: number;      // Successes needed to close (default: 2)
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalCalls: number;
  rejectedCalls: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxCalls: 3,
  successThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  private halfOpenCalls = 0;
  private totalCalls = 0;
  private rejectedCalls = 0;
  private nextAttempt?: number;
  private config: CircuitBreakerConfig;

  constructor(
    private name: string,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    this.checkTimeout();
    return this.state;
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls,
    };
  }

  /**
   * Check if request should be allowed
   */
  canExecute(): boolean {
    this.checkTimeout();

    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        this.rejectedCalls++;
        return false;
      case 'HALF_OPEN':
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          this.rejectedCalls++;
          return false;
        }
        this.halfOpenCalls++;
        return true;
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.name}' is OPEN - service temporarily unavailable`
      );
    }

    this.totalCalls++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record success
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.closeCircuit();
      }
    }
  }

  /**
   * Record failure
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    if (this.state === 'HALF_OPEN') {
      this.openCircuit();
    } else if (
      this.state === 'CLOSED' &&
      this.consecutiveFailures >= this.config.failureThreshold
    ) {
      this.openCircuit();
    }
  }

  /**
   * Transition to OPEN state
   */
  private openCircuit(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    this.halfOpenCalls = 0;
    console.warn(
      `[CircuitBreaker:${this.name}] Circuit OPENED - blocking calls for ${this.config.resetTimeout}ms`
    );
  }

  /**
   * Transition to HALF_OPEN state
   */
  private halfOpenCircuit(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenCalls = 0;
    this.consecutiveSuccesses = 0;
    console.info(`[CircuitBreaker:${this.name}] Circuit HALF_OPEN - testing recovery`);
  }

  /**
   * Transition to CLOSED state
   */
  private closeCircuit(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
    this.nextAttempt = undefined;
    console.info(`[CircuitBreaker:${this.name}] Circuit CLOSED - service recovered`);
  }

  /**
   * Check if timeout elapsed and transition to HALF_OPEN
   */
  private checkTimeout(): void {
    if (this.state === 'OPEN' && this.nextAttempt && Date.now() >= this.nextAttempt) {
      this.halfOpenCircuit();
    }
  }

  /**
   * Force open circuit (for manual intervention)
   */
  forceOpen(): void {
    this.openCircuit();
  }

  /**
   * Force close circuit (for manual intervention)
   */
  forceClose(): void {
    this.closeCircuit();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.closeCircuit();
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.rejectedCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }
}

/**
 * Global circuit breaker registry
 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
