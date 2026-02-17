/**
 * ML Monitoring Dashboard API
 * 
 * Returns model performance metrics, drift detection, and health status.
 * 
 * GET /api/admin/ml/dashboard
 */

import { NextResponse } from 'next/server';
import { createMonitoringService } from '@/server/ml/monitoring/monitoring-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['ops', 'admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const monitoring = createMonitoringService();
    const data = await monitoring.getDashboardData();
    const health = await monitoring.runHealthCheck();

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        health,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
