import { NextRequest, NextResponse } from 'next/server';

const users = new Map([
  ['test@example.com', { id: 'user-1', email: 'test@example.com', password: 'testpassword123', role: 'user' }],
  ['admin@example.com', { id: 'admin-1', email: 'admin@example.com', password: 'admin123', role: 'admin' }],
]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  const user = users.get(email);
  
  if (!user || user.password !== password) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  const token = `token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    expiresIn: 3600,
  });
}
