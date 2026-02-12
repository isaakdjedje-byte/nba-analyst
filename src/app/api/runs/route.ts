import { NextRequest, NextResponse } from 'next/server';

const runs: unknown[] = [];

export async function GET() {
  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const run = { ...body, id: body.id || `run-${Date.now()}` };
  runs.push(run);
  return NextResponse.json(run, { status: 201 });
}
