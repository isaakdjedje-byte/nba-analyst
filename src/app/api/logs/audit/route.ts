import { NextRequest, NextResponse } from 'next/server';

const logs = [
  {
    id: 'log-1',
    event: 'decision.created',
    traceId: 'trace-123',
    timestamp: new Date().toISOString(),
    data: { matchId: 'match-1', status: 'Pick' },
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  
  let filteredLogs = logs;
  
  if (from && to) {
    filteredLogs = logs.filter(
      (log) => log.timestamp >= from && log.timestamp <= to
    );
  }
  
  return NextResponse.json({ entries: filteredLogs });
}
