/**
 * Base Provider Class for Data Ingestion
 * Provides common interface and functionality for all data source providers
 * Enhanced with Circuit Breaker, Content-Type validation, and Retry logic
 */

import { CircuitBreaker, circuitBreakerRegistry } from '../circuit-breaker';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  rateLimit?: number; // Requests per minute
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries?: number;      // Maximum retry attempts (default: 3)
    baseDelay?: number;       // Base delay in ms (default: 1000)
    maxDelay?: number;        // Maximum delay in ms (default: 30000)
  };
  circuitBreakerConfig?: {
    failureThreshold?: number;
    resetTimeout?: number;
  };
}

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per ms

  constructor(capacity: number, refillRatePerMinute: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = refillRatePerMinute / (60 * 1000); // convert to tokens per ms
  }

  /**
   * Try to consume a token
   * Returns true if token was consumed, false if no tokens available
   */
  consume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Get time until next token is available (in ms)
   */
  getTimeUntilNextToken(): number {
    this.refill();
    
    if (this.tokens >= 1) {
      return 0;
    }
    
    // Time to generate 1 token
    return Math.ceil(1 / this.refillRate);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export interface DataSourceResult<T = unknown> {
  data: T;
  metadata: {
    source: string;
    timestamp: Date;
    traceId: string;
    latency?: number;
  };
}

export interface ProviderMetadata {
  name: string;
  baseUrl: string;
  timeout: number;
  rateLimit: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  private lastLatency: number = 0;
  private rateLimiter: TokenBucket;
  private circuitBreaker: CircuitBreaker;

  constructor(config: ProviderConfig) {
    this.validateConfig(config);
    this.config = {
      timeout: 10000,
      rateLimit: 60,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        ...config.retryConfig,
      },
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeout: 60000,
        ...config.circuitBreakerConfig,
      },
      ...config,
    };
    
    // Initialize rate limiter (default 60 requests per minute)
    const rateLimit = this.config.rateLimit ?? 60;
    this.rateLimiter = new TokenBucket(rateLimit, rateLimit);
    
    // Initialize circuit breaker for this provider
    this.circuitBreaker = circuitBreakerRegistry.getOrCreate(
      `provider-${config.name}`,
      {
        failureThreshold: this.config.circuitBreakerConfig?.failureThreshold ?? 5,
        resetTimeout: this.config.circuitBreakerConfig?.resetTimeout ?? 60000,
      }
    );
  }

  private validateConfig(config: ProviderConfig): void {
    if (!config.name) {
      throw new Error('Provider name is required');
    }
    if (!config.baseUrl) {
      throw new Error('Provider baseUrl is required');
    }
  }

  /**
   * Fetch data from the provider
   * Must be implemented by concrete providers
   */
  abstract fetchData(): Promise<DataSourceResult>;

  /**
   * Check provider health
   * Must be implemented by concrete providers
   */
  abstract healthCheck(): Promise<{ healthy: boolean; latency: number }>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get provider metadata
   */
  getMetadata(): ProviderMetadata {
    return {
      name: this.config.name,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout ?? 10000,
      rateLimit: this.config.rateLimit ?? 60,
    };
  }

  /**
   * Generate a unique trace ID for request tracking
   */
  generateTraceId(): string {
    return `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the latency of the last request in milliseconds
   */
  getLastLatency(): number {
    return this.lastLatency;
  }

  /**
   * Set the latency of the last request
   */
  protected setLastLatency(latency: number): void {
    this.lastLatency = latency;
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.retryConfig?.baseDelay ?? 1000;
    const maxDelay = this.config.retryConfig?.maxDelay ?? 30000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    // Add jitter (+/-25%) to avoid thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make an authenticated request with circuit breaker, retry logic, content-type validation,
   * timeout, and rate limiting
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; latency: number }> {
    const maxRetries = this.config.retryConfig?.maxRetries ?? 3;
    const traceId = this.generateTraceId();
    
    // Execute with circuit breaker protection
    return this.circuitBreaker.execute(async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();
        
        // Check rate limit
        if (!this.rateLimiter.consume()) {
          const waitTime = this.rateLimiter.getTimeUntilNextToken();
          throw new Error(
            `Rate limit exceeded for ${this.config.name}. ` +
            `Please wait ${Math.ceil(waitTime / 1000)}s before retrying.`
          );
        }

        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...(options.headers as Record<string, string>),
        };

        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const url = `${this.config.baseUrl}${endpoint}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

          let response: Response;
          try {
            response = await fetch(url, {
              ...options,
              headers,
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          const latency = Date.now() - startTime;
          this.setLastLatency(latency);

          // Check HTTP status
          if (!response.ok) {
            // Only retry on 5xx errors or 429 (rate limit)
            if (response.status >= 500 || response.status === 429) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            // 4xx errors are not retryable
            throw new Error(`HTTP ${response.status}: ${response.statusText} (not retryable)`);
          }

          // Validate Content-Type header
          const contentType = response.headers.get('content-type');
          if (contentType && !contentType.includes('application/json')) {
            throw new Error(
              `Unexpected content-type: ${contentType}. Expected application/json`
            );
          }

          // Try to parse JSON
          let data: T;
          try {
            data = await response.json();
          } catch (parseError) {
            throw new Error(
              `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
            );
          }
          
          return { data, latency };
        } catch (error) {
          const latency = Date.now() - startTime;
          this.setLastLatency(latency);
          lastError = error instanceof Error ? error : new Error(String(error));

          // Don't retry on AbortError (timeout) or non-retryable 4xx errors
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              lastError = new Error(`Request timeout after ${this.config.timeout}ms`);
            }
            // Check if error contains "not retryable"
            if (lastError.message.includes('not retryable')) {
              throw lastError;
            }
          }

          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw new Error(
              `Request failed after ${maxRetries + 1} attempts: ${lastError.message}`
            );
          }

          // Calculate and wait before retry
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(
            `[${traceId}] Request attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. ` +
            `Retrying in ${Math.round(delay)}ms...`
          );
          await this.sleep(delay);
        }
      }

      // Should never reach here, but just in case
      throw lastError || new Error('Request failed after all retries');
    });
  }

  /**
   * Get circuit breaker metrics for this provider
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}
