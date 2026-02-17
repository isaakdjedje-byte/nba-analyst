import { describe, it, expect, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  circuitBreakerRegistry,
} from './circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxCalls: 2,
      successThreshold: 2,
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should allow execution in CLOSED state', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });
  });

  describe('failure tracking', () => {
    it('should track consecutive failures', async () => {
      // First 2 failures should keep circuit closed
      await expect(breaker.execute(() => Promise.reject(new Error('fail 1')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail 2')))).rejects.toThrow();
      
      expect(breaker.getState()).toBe('CLOSED');
      
      // Third failure should open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail 3')))).rejects.toThrow();
      
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reset failure count on success', async () => {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await breaker.execute(() => Promise.resolve('success'));
      
      expect(breaker.getState()).toBe('CLOSED');
      
      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('state transitions', () => {
    it('should transition to OPEN after threshold failures', async () => {
      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error(`fail ${i}`)))).rejects.toThrow();
      }
      
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should block calls in OPEN state', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      expect(breaker.getState()).toBe('OPEN');
      
      // Should immediately throw CircuitBreakerOpenError
      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow(
        CircuitBreakerOpenError
      );
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      expect(breaker.getState()).toBe('OPEN');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Accessing state should trigger timeout check
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should transition to CLOSED after successful HALF_OPEN calls', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // HALF_OPEN state
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // Need 2 successful calls to close
      await breaker.execute(() => Promise.resolve('success 1'));
      await breaker.execute(() => Promise.resolve('success 2'));
      
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reopen on failure in HALF_OPEN state', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // One failure should reopen
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('metrics', () => {
    it('should track total calls', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      await breaker.execute(() => Promise.resolve('success'));
      
      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successes).toBe(2);
    });

    it('should track failures', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      
      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.successes).toBe(1);
      expect(metrics.failures).toBe(1);
    });

    it('should track rejected calls in OPEN state', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      // Try to execute while OPEN
      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow();
      
      const metrics = breaker.getMetrics();
      expect(metrics.rejectedCalls).toBe(1);
    });
  });

  describe('manual control', () => {
    it('should allow manual open', () => {
      breaker.forceOpen();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should allow manual close', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
      
      breaker.forceClose();
      expect(breaker.getState()).toBe('CLOSED');
      
      // Should work normally now
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should allow reset', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      
      breaker.reset();
      
      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(0);
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });
  });
});

describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    // Clean up registry
    circuitBreakerRegistry.remove('test-1');
    circuitBreakerRegistry.remove('test-2');
  });

  it('should create new breaker', () => {
    const breaker = circuitBreakerRegistry.getOrCreate('test-1');
    expect(breaker).toBeDefined();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should return existing breaker', () => {
    const breaker1 = circuitBreakerRegistry.getOrCreate('test-1');
    const breaker2 = circuitBreakerRegistry.getOrCreate('test-1');
    expect(breaker1).toBe(breaker2);
  });

  it('should retrieve breaker by name', () => {
    circuitBreakerRegistry.getOrCreate('test-1');
    const breaker = circuitBreakerRegistry.get('test-1');
    expect(breaker).toBeDefined();
  });

  it('should return undefined for non-existent breaker', () => {
    const breaker = circuitBreakerRegistry.get('non-existent');
    expect(breaker).toBeUndefined();
  });

  it('should remove breaker', () => {
    circuitBreakerRegistry.getOrCreate('test-1');
    circuitBreakerRegistry.remove('test-1');
    expect(circuitBreakerRegistry.get('test-1')).toBeUndefined();
  });

  it('should return all metrics', () => {
    circuitBreakerRegistry.getOrCreate('test-1');
    circuitBreakerRegistry.getOrCreate('test-2');
    
    const allMetrics = circuitBreakerRegistry.getAllMetrics();
    expect(Object.keys(allMetrics)).toHaveLength(2);
    expect(allMetrics['test-1']).toBeDefined();
    expect(allMetrics['test-2']).toBeDefined();
  });
});

describe('CircuitBreakerOpenError', () => {
  it('should create error with message', () => {
    const error = new CircuitBreakerOpenError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('CircuitBreakerOpenError');
  });
});
