import { NextRequest, NextResponse } from 'next/server';
import { GET as getDecisionsV1 } from '@/app/api/v1/decisions/route';

export async function GET(request: NextRequest) {
  return getDecisionsV1(request);
}

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'METHOD_NOT_SUPPORTED',
        message: 'Use /api/v1/decisions endpoints for write operations.',
      },
    },
    { status: 405 }
  );
}
