/**
 * ML Dashboard Page
 *
 * Server-rendered admin interface for monitoring ML model performance.
 * Route: /admin/ml
 */

import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth/auth-options';
import { createMonitoringService } from '@/server/ml/monitoring/monitoring-service';
import type {
  PredictionMetrics,
  ModelHealthStatus,
  FeatureDriftReport,
  LatestModelSummary,
} from '@/server/ml/monitoring/monitoring-service';

export const dynamic = 'force-dynamic';

interface DashboardData {
  dailyMetrics: PredictionMetrics[];
  modelHealth: ModelHealthStatus[];
  drift: FeatureDriftReport | null;
  calibration: {
    bin: number;
    predicted: number;
    observed: number;
    count: number;
  }[];
  latestModel: LatestModelSummary | null;
  health: {
    healthy: boolean;
    alerts: string[];
    recommendations: string[];
  };
}

async function loadDashboardData(): Promise<{ data: DashboardData | null; error: string | null }> {
  try {
    const monitoring = createMonitoringService();
    const data = await monitoring.getDashboardData();
    const health = await monitoring.runHealthCheck();

    return {
      data: {
        ...data,
        health,
      } as DashboardData,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default async function MLDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !['ops', 'admin'].includes(role)) {
    redirect('/dashboard/picks');
  }

  const { data, error } = await loadDashboardData();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-xl w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Dashboard Error</h2>
          <p className="text-gray-700 mb-4">{error ?? 'Failed to load dashboard data'}</p>
          <Link
            href="/admin/ml"
            className="inline-flex px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">ML Monitoring Dashboard</h1>
              <p className="text-sm text-slate-200">Real-time model performance, drift, and production health</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.health.healthy ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30' : 'bg-rose-500/20 text-rose-100 border border-rose-300/30'
              }`}>
                {data.health.healthy ? 'Healthy' : 'Issues'}
              </span>
              <Link
                href="/admin/ml"
                className="px-4 py-2 rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                Refresh
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {(!data.dailyMetrics?.length && !data.modelHealth?.length) && (
          <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">No Monitoring Data Yet</h2>
            <p className="mt-2 text-sm text-amber-900">
              The ML monitoring tables are empty. Run the pipeline once to generate prediction logs and outcome resolution.
            </p>
          </section>
        )}

        {data.latestModel && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Active Model</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Version</p>
                  <p className="text-xl font-semibold text-slate-900">{data.latestModel.version}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Algorithm</p>
                  <p className="text-base font-medium text-slate-800">{data.latestModel.algorithm}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-slate-500">Accuracy</p><p className="font-semibold text-slate-900">{(data.latestModel.accuracy * 100).toFixed(2)}%</p></div>
                <div><p className="text-slate-500">F1 Score</p><p className="font-semibold text-slate-900">{(data.latestModel.f1Score * 100).toFixed(2)}%</p></div>
                <div><p className="text-slate-500">AUC</p><p className="font-semibold text-slate-900">{data.latestModel.auc.toFixed(4)}</p></div>
                <div><p className="text-slate-500">Calibration Error</p><p className="font-semibold text-slate-900">{data.latestModel.calibrationError.toFixed(4)}</p></div>
              </div>
            </div>
          </section>
        )}

        {data.dailyMetrics && data.dailyMetrics.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily ML Results (Last 7 Days)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.dailyMetrics.slice(-4).map((row, index) => {
                const day = typeof row.date === 'string' ? new Date(row.date).toLocaleDateString() : 'N/A';
                const total = Number(row.totalPredictions ?? 0);
                const resolved = Number(row.resolvedCount ?? 0);
                const accuracy = Number(row.accuracy ?? 0);
                return (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{day}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{(accuracy * 100).toFixed(1)}%</p>
                    <p className="text-sm text-slate-600">Accuracy</p>
                    <p className="mt-3 text-xs text-slate-500">{resolved} resolved / {total} predictions</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
