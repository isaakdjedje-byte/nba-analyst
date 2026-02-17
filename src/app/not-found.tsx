/**
 * Custom 404 Error Page
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      data-testid="not-found-page"
      style={{
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h1 data-testid="404-heading">404 - Page Not Found</h1>
      <p data-testid="not-found-message">
        Sorry, the page you are looking for does not exist.
      </p>
      <p data-testid="page-not-found">
        The page you requested could not be found.
      </p>

      <div style={{ marginTop: '2rem' }}>
        <h2>What you can do:</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ margin: '1rem 0' }}>
            <Link
              href="/"
              data-testid="home-link"
              role="link"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              Go to Home
            </Link>
          </li>
          <li style={{ margin: '1rem 0' }}>
            <Link
              href="/dashboard/picks"
              data-testid="dashboard-link"
              role="link"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              Go to Dashboard
            </Link>
          </li>
          <li style={{ margin: '1rem 0' }}>
            <Link
              href="/"
              data-testid="back-link"
              role="link"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              Go Back
            </Link>
          </li>
        </ul>
      </div>

      <p
        data-testid="error-help"
        style={{ marginTop: '2rem', color: '#666' }}
      >
        If you believe this is an error, please contact support.
      </p>
    </main>
  );
}
