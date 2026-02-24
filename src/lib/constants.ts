export const TIME = {
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

export const CACHE_TTL_SECONDS = {
  ONE_MINUTE: 60,
  FIVE_MINUTES: 300,
  FIFTEEN_MINUTES: 900,
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
} as const;

export const MODEL = {
  MAX_AGE_HOURS: 1,
  FEATURE_CACHE_HOURS: 1,
} as const;

export const RETRY = {
  DEFAULT_RETRIES: 3,
  DEFAULT_DELAY_MS: 1000,
} as const;
