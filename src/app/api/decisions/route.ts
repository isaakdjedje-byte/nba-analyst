import { NextRequest, NextResponse } from 'next/server';

const decisions: unknown[] = [];

export async function GET() {
  return NextResponse.json({ decisions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const decision = { ...body, id: body.id || `dec-${Date.now()}` };
  decisions.push(decision);
  return NextResponse.json(decision, { status: 201 });
}
