/**
 * ML Dashboard Page
 * 
 * Admin interface for monitoring ML model performance.
 * Route: /admin/ml
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface DashboardData {
  dailyMetrics: Array<Record<string, unknown>>;
  modelHealth: Array<{
    modelVersion: string;
    isHealthy: boolean;
    predictionsInLastHour: number;
    avgLatencyMs: number;
    errorRate: number;
  }>;
  drift: {
    alertLevel: string;
    driftedFeatures: Array<{
      featureName: string;
      baselineMean: number;
      currentMean: number;
      driftScore: number;
    }>;
    totalDriftScore: number;
  } | null;
  calibration: {
    bin: number;
    predicted: number;
    observed: number;
    count: number;
  }[];
  latestModel: {
    version: string;
    algorithm: string;
    trainedAt: string;
    activatedAt: string | null;
    trainingDataStart: string;
    trainingDataEnd: string;
    numTrainingSamples: number;
    numTestSamples: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    logLoss: number;
    auc: number;
    calibrationError: number;
  } | null;
  health: {
    healthy: boolean;
    alerts: string[];
    recommendations: string[];
  };
}

export default function MLDashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/ml/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ML Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
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
                data?.health?.healthy ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30' : 'bg-rose-500/20 text-rose-100 border border-rose-300/30'
              }`}>
                {data?.health?.healthy ? 'Healthy' : 'Issues'}
              </span>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Latest Active Model */}
        {data?.latestModel && (
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
              <p className="mt-4 text-xs text-slate-500">
                Training window: {new Date(data.latestModel.trainingDataStart).toLocaleDateString()} - {new Date(data.latestModel.trainingDataEnd).toLocaleDateString()} | Samples: {data.latestModel.numTrainingSamples.toLocaleString()} train / {data.latestModel.numTestSamples.toLocaleString()} test
              </p>
            </div>
          </section>
        )}

        {/* Daily Metrics */}
        {data?.dailyMetrics && data.dailyMetrics.length > 0 && (
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

        {/* System Health */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Card */}
            <div className={`p-6 rounded-lg border-2 ${
              data?.health?.healthy ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <div className="flex items-center">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  data?.health?.healthy ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  <span className="text-white text-2xl">
                    {data?.health?.healthy ? '✓' : '⚠'}
                  </span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className={`text-lg font-semibold ${
                    data?.health?.healthy ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {data?.health?.healthy ? 'All Systems Operational' : 'Issues Detected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Alerts Card */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-3xl font-bold text-gray-900">{data?.health?.alerts?.length || 0}</p>
              {data?.health?.alerts && data.health.alerts.length > 0 && (
                <ul className="mt-2 text-sm text-red-600">
                  {data.health.alerts.slice(0, 3).map((alert, i) => (
                    <li key={i}>• {alert}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recommendations Card */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Recommendations</p>
              <p className="text-3xl font-bold text-gray-900">{data?.health?.recommendations?.length || 0}</p>
              {data?.health?.recommendations && data.health.recommendations.length > 0 && (
                <ul className="mt-2 text-sm text-blue-600">
                  {data.health.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Model Status */}
        {data?.modelHealth && data.modelHealth.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Status</h2>
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Health</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preds/hour</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.modelHealth.map((model, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {model.modelVersion}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          model.isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {model.isHealthy ? 'Healthy' : 'Issues'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {model.predictionsInLastHour}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {model.avgLatencyMs?.toFixed(0)}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(model.errorRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Drift Detection */}
        {data?.drift && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Drift</h2>
            <div className={`p-6 rounded-lg border-2 ${
              data.drift.alertLevel === 'high' ? 'border-red-500 bg-red-50' :
              data.drift.alertLevel === 'medium' ? 'border-yellow-500 bg-yellow-50' :
              data.drift.alertLevel === 'low' ? 'border-blue-500 bg-blue-50' :
              'border-green-500 bg-green-50'
            }`}>
              <div className="flex items-center mb-4">
                <span className={`text-2xl mr-2 ${
                  data.drift.alertLevel === 'none' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.drift.alertLevel === 'none' ? '✓' : '⚠'}
                </span>
                <h3 className={`text-lg font-semibold ${
                  data.drift.alertLevel === 'high' ? 'text-red-800' :
                  data.drift.alertLevel === 'medium' ? 'text-yellow-800' :
                  data.drift.alertLevel === 'low' ? 'text-blue-800' :
                  'text-green-800'
                }`}>
                  Alert Level: {data.drift.alertLevel.toUpperCase()}
                </h3>
              </div>
              
              {data.drift.driftedFeatures.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Feature</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Baseline</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Current</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Drift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drift.driftedFeatures.map((f, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm text-gray-900">{f.featureName}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{f.baselineMean.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{f.currentMean.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-red-600">
                            {f.driftScore.toFixed(2)}σ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-green-700">No significant drift detected.</p>
              )}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <a
              href="/api/admin/ml/dashboard"
              target="_blank"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              View Raw API
            </a>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Refresh
            </button>
          </div>
        </section>

        {/* Documentation */}
        <section className="bg-gray-100 p-6 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Documentation</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• ML Architecture: docs/ML_ARCHITECTURE.md</li>
            <li>• Setup Guide: docs/ML_SETUP_GUIDE.md</li>
            <li>• API: GET /api/admin/ml/dashboard</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
