import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>NBA Analyst</h1>
      <p>AI-powered sports betting decision platform</p>
      <nav style={{ marginTop: '2rem' }}>
        <Link href="/dashboard/picks" data-testid="picks-link">
          View Picks
        </Link>
      </nav>
    </main>
  );
}
