import { NextRequest } from 'next/server';
import { GET as getRunsV1, POST as postRunsV1 } from '@/app/api/v1/runs/route';

export async function GET(request: NextRequest) {
  return getRunsV1(request);
}

export async function POST(request: NextRequest) {
  return postRunsV1(request);
}
