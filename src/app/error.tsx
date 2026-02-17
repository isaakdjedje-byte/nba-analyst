/**
 * Error Boundary
 * Handles runtime errors gracefully
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error
    console.error('Application error:', error);
  }, [error]);

  return (
    <main
      data-testid="error-page"
      style={{
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h1 data-testid="error-heading">Something went wrong!</h1>
      <p data-testid="error-message">
        We encountered an unexpected error. Please try again.
      </p>

      {error.message && (
        <div
          data-testid="error-details"
          style={{
            margin: '1rem 0',
            padding: '1rem',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            color: '#721c24',
          }}
        >
          <p>Error: {error.message}</p>
          {error.digest && <p>Digest: {error.digest}</p>}
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <button
          data-testid="retry-button"
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '1rem',
          }}
        >
          Try Again
        </button>

        <Link
          href="/"
          data-testid="home-link"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
          }}
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
