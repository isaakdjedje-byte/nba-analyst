/**
 * Base Provider Class for Data Ingestion
 * Provides common interface and functionality for all data source providers
 */

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  rateLimit?: number; // Requests per minute
  headers?: Record<string, string>;
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

  constructor(config: ProviderConfig) {
    this.validateConfig(config);
    this.config = {
      timeout: 10000,
      rateLimit: 60,
      ...config,
    };
    
    // Initialize rate limiter (default 60 requests per minute)
    const rateLimit = this.config.rateLimit ?? 60;
    this.rateLimiter = new TokenBucket(rateLimit, rateLimit);
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
   * Make an authenticated request with timeout, rate limiting, and error handling
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; latency: number }> {
    // Check rate limit
    if (!this.rateLimiter.consume()) {
      const waitTime = this.rateLimiter.getTimeUntilNextToken();
      throw new Error(
        `Rate limit exceeded for ${this.config.name}. ` +
        `Please wait ${Math.ceil(waitTime / 1000)}s before retrying.`
      );
    }

    const startTime = Date.now();
    const traceId = this.generateTraceId();

    const headers: Record<string, string> = {
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

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      this.setLastLatency(latency);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.setLastLatency(latency);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }
}
