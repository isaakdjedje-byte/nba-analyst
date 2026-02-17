import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  void request;

  return NextResponse.json(
    {
      error: 'Deprecated endpoint. Use NextAuth credentials flow.',
    },
    { status: 410 }
  );
}
