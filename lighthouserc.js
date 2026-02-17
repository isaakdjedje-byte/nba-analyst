/**
 * Lighthouse CI Configuration
 * Story 3.8: AC4 - Lighthouse mobile score >= 90
 * 
 * @see https://github.com/GoogleChrome/lighthouse-ci
 */

module.exports = {
  ci: {
    collect: {
      // Run Lighthouse 3 times for statistical significance
      numberOfRuns: 3,
      
      // Start server
      startServerCommand: 'npm run dev',
      
      // Wait for server to be ready
      startServerReadyPattern: 'Ready on',
      startServerReadyTimeout: 60000,
      
      // URL to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard/picks',
        'http://localhost:3000/dashboard/no-bet',
      ],
      
      // Use mobile emulation
      settings: {
        preset: 'mobile',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        },
        emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      },
    },
    
    assert: {
      // AC4: Lighthouse mobile score >= 90
      assertions: {
        // Performance category
        'categories:performance': ['warn', { minScore: 0.9 }],
        
        // Accessibility category
        'categories:accessibility': ['error', { minScore: 0.9 }],
        
        // Best practices
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        
        // SEO
        'categories:seo': ['warn', { minScore: 0.9 }],
        
        // Specific metrics per AC4
        'first-contentful-paint': ['warn', { maxNumericValue: 1500 }], // FCP < 1.5s
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }], // LCP < 2.5s
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }], // CLS < 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 200 }], // TBT < 200ms
        'interactive': ['warn', { maxNumericValue: 3000 }], // TTI < 3s
        
        // Skip certain audits that may fail in CI
        'uses-long-cache-ttl': 'off',
        'uses-http2': 'off',
      },
    },
    
    upload: {
      target: 'temporary-public-storage',
    },
    
    server: {
      // Server options
    },
    
    wizard: {
      // Wizard options
    },
  },
};
