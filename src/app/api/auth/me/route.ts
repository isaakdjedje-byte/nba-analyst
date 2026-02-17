import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';

export async function GET(request: NextRequest) {
  void request;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as { id: string; email: string; role: string };

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
