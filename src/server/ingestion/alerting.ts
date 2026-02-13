/**
 * Alerting Service for Ingestion System
 * Sends notifications on drift detection and failures
 */

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertConfig {
  enabled: boolean;
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
  email?: {
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    from: string;
    to: string[];
  };
  console?: boolean;
}

export interface AlertPayload {
  severity: AlertSeverity;
  title: string;
  message: string;
  traceId: string;
  timestamp: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send alert through configured channels
 */
export async function sendAlert(config: AlertConfig, payload: AlertPayload): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const alerts: Promise<void>[] = [];

  if (config.console) {
    alerts.push(sendConsoleAlert(payload));
  }

  if (config.webhook) {
    alerts.push(sendWebhookAlert(config.webhook, payload));
  }

  if (config.slack) {
    alerts.push(sendSlackAlert(config.slack, payload));
  }

  if (config.email) {
    alerts.push(sendEmailAlert(config.email, payload));
  }

  await Promise.allSettled(alerts);
}

/**
 * Send alert to console
 */
async function sendConsoleAlert(payload: AlertPayload): Promise<void> {
  const icon = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  }[payload.severity];

  console.error(
    `${icon} [${payload.severity.toUpperCase()}] ${payload.title}\n` +
    `   Trace: ${payload.traceId}\n` +
    `   Time: ${payload.timestamp}\n` +
    `   ${payload.message}`
  );
}

/**
 * Send alert to webhook
 */
async function sendWebhookAlert(
  config: NonNullable<AlertConfig['webhook']>,
  payload: AlertPayload
): Promise<void> {
  try {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to send webhook alert:', error);
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(
  config: NonNullable<AlertConfig['slack']>,
  payload: AlertPayload
): Promise<void> {
  const color = {
    info: '#36a64f',
    warning: '#daa520',
    error: '#dc143c',
    critical: '#8b0000',
  }[payload.severity];

  const slackPayload = {
    channel: config.channel,
    attachments: [
      {
        color,
        title: payload.title,
        text: payload.message,
        fields: [
          {
            title: 'Severity',
            value: payload.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Trace ID',
            value: payload.traceId,
            short: true,
          },
          {
            title: 'Timestamp',
            value: payload.timestamp,
            short: true,
          },
          ...(payload.provider
            ? [
                {
                  title: 'Provider',
                  value: payload.provider,
                  short: true,
                },
              ]
            : []),
        ],
        footer: 'NBA Analyst Ingestion System',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
      },
    ],
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

/**
 * Send alert via email (placeholder - requires nodemailer)
 */
async function sendEmailAlert(
  config: NonNullable<AlertConfig['email']>,
  payload: AlertPayload
): Promise<void> {
  // Email sending requires nodemailer or similar
  // For now, just log that email would be sent
  console.log(
    `[Email Alert] Would send to ${config.to.join(', ')}: ${payload.title}`
  );
}

/**
 * Create alert for schema drift
 */
export function createDriftAlert(
  provider: string,
  traceId: string,
  severity: AlertSeverity,
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  }
): AlertPayload {
  const parts: string[] = [];

  if (changes.removed.length > 0) {
    parts.push(`Fields removed: ${changes.removed.join(', ')}`);
  }
  if (changes.modified.length > 0) {
    parts.push(`Fields modified: ${changes.modified.join(', ')}`);
  }
  if (changes.added.length > 0) {
    parts.push(`Fields added: ${changes.added.join(', ')}`);
  }

  return {
    severity,
    title: `Schema Drift Detected - ${provider}`,
    message: parts.join(' | '),
    traceId,
    timestamp: new Date().toISOString(),
    provider,
    metadata: { changes },
  };
}

/**
 * Create alert for provider failure
 */
export function createFailureAlert(
  provider: string,
  traceId: string,
  error: string,
  recoverable: boolean
): AlertPayload {
  return {
    severity: recoverable ? 'warning' : 'error',
    title: `Provider Failure - ${provider}`,
    message: error,
    traceId,
    timestamp: new Date().toISOString(),
    provider,
    metadata: { recoverable },
  };
}
