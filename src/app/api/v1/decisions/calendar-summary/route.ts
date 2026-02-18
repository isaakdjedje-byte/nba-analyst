import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuth } from '@/server/auth/server-rbac';

type DecisionStatus = 'PICK' | 'NO_BET' | 'HARD_STOP';

const ALLOWED_STATUSES: DecisionStatus[] = ['PICK', 'NO_BET', 'HARD_STOP'];

function parseMonth(month: string | null): { start: Date; end: Date; key: string } {
  const now = new Date();

  if (!month) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { start, end, key };
  }

  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error('INVALID_MONTH_FORMAT');
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('INVALID_MONTH_VALUE');
  }

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end, key: `${year}-${String(monthIndex + 1).padStart(2, '0')}` };
}

function parseStatuses(raw: string | null): DecisionStatus[] | undefined {
  if (!raw) return undefined;

  const values = raw
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is DecisionStatus => ALLOWED_STATUSES.includes(part as DecisionStatus));

  return values.length > 0 ? values : undefined;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const authResult = await requireAuth();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const statusesParam = searchParams.get('statuses');
    const { start, end, key } = parseMonth(monthParam);
    const statuses = parseStatuses(statusesParam);

    const rows = await prisma.policyDecision.findMany({
      where: {
        matchDate: {
          gte: start,
          lte: end,
        },
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      select: {
        matchDate: true,
        status: true,
      },
      orderBy: {
        matchDate: 'asc',
      },
    });

    const byDate = new Map<string, { total: number; pick: number; noBet: number; hardStop: number }>();

    for (const row of rows) {
      const dayKey = formatLocalDate(row.matchDate);
      const prev = byDate.get(dayKey) ?? { total: 0, pick: 0, noBet: 0, hardStop: 0 };

      prev.total += 1;
      if (row.status === 'PICK') prev.pick += 1;
      if (row.status === 'NO_BET') prev.noBet += 1;
      if (row.status === 'HARD_STOP') prev.hardStop += 1;

      byDate.set(dayKey, prev);
    }

    const summary = Array.from(byDate.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    return NextResponse.json({
      data: summary,
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
        month: key,
        statuses: statuses ?? ALLOWED_STATUSES,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = message.startsWith('INVALID_MONTH') ? 400 : 500;

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message: status === 400 ? 'Parametre month invalide. Format attendu: YYYY-MM' : 'Failed to fetch calendar summary',
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status }
    );
  }
}
