/**
 * Time and session helpers.
 *
 * The FTMO trading day rolls over at midnight Europe/Prague (CET/CEST), *not*
 * UTC. Getting this wrong is one of the most common ways to fail a challenge:
 * a trade that looks like it is inside today's loss budget may in fact belong
 * to the next broker day. All day-boundary logic therefore goes through
 * `brokerDayKey`, which uses the IANA timezone from the rule set.
 */

import { TIMEFRAME_MINUTES, type Candle, type Timeframe } from '../types';

/**
 * Returns the broker-day key (YYYY-MM-DD) for a timestamp in the given
 * timezone. Uses Intl so DST transitions are handled by the platform database
 * rather than by hand-rolled offsets.
 */
export function brokerDayKey(timestampMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // en-CA formats as YYYY-MM-DD.
  return formatter.format(new Date(timestampMs));
}

/** Wall-clock hour and minute in the given timezone. */
export function clockInZone(timestampMs: number, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(timestampMs));

  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const minutePart = parts.find((p) => p.type === 'minute')?.value ?? '0';
  // Some locales render midnight as "24".
  return { hour: Number(hourPart) % 24, minute: Number(minutePart) };
}

/** Wall-clock hour (0–23) in the given timezone. */
export function hourInZone(timestampMs: number, timeZone: string): number {
  return clockInZone(timestampMs, timeZone).hour;
}

/** Day of week in UTC: 0 = Sunday … 6 = Saturday. */
export function utcDayOfWeek(timestampMs: number): number {
  return new Date(timestampMs).getUTCDay();
}

export function utcHour(timestampMs: number): number {
  return new Date(timestampMs).getUTCHours();
}

export function utcMinute(timestampMs: number): number {
  return new Date(timestampMs).getUTCMinutes();
}

/**
 * The FX market is closed from Friday ~21:00 UTC to Sunday ~21:00 UTC.
 * We treat the whole window as closed and refuse to trade in it.
 */
export function isMarketClosed(timestampMs: number): boolean {
  const day = utcDayOfWeek(timestampMs);
  const hour = utcHour(timestampMs);

  if (day === 6) return true; // Saturday
  if (day === 5 && hour >= 21) return true; // Friday evening
  if (day === 0 && hour < 22) return true; // Sunday before the open
  return false;
}

/**
 * True when we are inside the pre-weekend flat window: non-swing FTMO accounts
 * may not hold positions over the weekend, so everything must be closed well
 * before the Friday close.
 */
export function isWeekendFlatWindow(timestampMs: number, minutesBeforeClose = 60): boolean {
  const day = utcDayOfWeek(timestampMs);
  if (day !== 5) return false;
  const minutesIntoDay = utcHour(timestampMs) * 60 + utcMinute(timestampMs);
  const fridayCloseMinutes = 21 * 60;
  return minutesIntoDay >= fridayCloseMinutes - minutesBeforeClose;
}

/**
 * Daily rollover window around the broker's server midnight. Spreads widen
 * dramatically here and swap is charged, so we neither open nor hold through it.
 */
export function isRolloverWindow(timestampMs: number, timeZone: string, bufferMinutes = 10): boolean {
  const { hour, minute } = clockInZone(timestampMs, timeZone);
  const minutesIntoDay = hour * 60 + minute;
  const minutesInDay = 24 * 60;
  return minutesIntoDay >= minutesInDay - bufferMinutes || minutesIntoDay <= bufferMinutes;
}

export type TradingSession = 'sydney' | 'tokyo' | 'london' | 'newyork' | 'overlap' | 'off-hours';

/** Classifies a timestamp into the dominant FX session (UTC based). */
export function sessionOf(timestampMs: number): TradingSession {
  const hour = utcHour(timestampMs);
  if (hour >= 12 && hour < 16) return 'overlap'; // London/New York – deepest liquidity
  if (hour >= 7 && hour < 12) return 'london';
  if (hour >= 16 && hour < 21) return 'newyork';
  if (hour >= 0 && hour < 7) return 'tokyo';
  if (hour >= 21) return 'sydney';
  return 'off-hours';
}

/** Bar open time snapped down to the timeframe grid. */
export function alignToTimeframe(timestampMs: number, timeframe: Timeframe): number {
  const ms = TIMEFRAME_MINUTES[timeframe] * 60_000;
  return Math.floor(timestampMs / ms) * ms;
}

/**
 * Resamples candles to a higher timeframe. Used so a strategy can consult an
 * H4 regime filter while trading M15 without a second data subscription.
 */
export function resample(candles: Candle[], target: Timeframe): Candle[] {
  const bucketMs = TIMEFRAME_MINUTES[target] * 60_000;
  const out: Candle[] = [];
  let current: Candle | null = null;
  let currentBucket = -1;

  for (const candle of candles) {
    const bucket = Math.floor(candle.time / bucketMs) * bucketMs;
    if (bucket !== currentBucket) {
      if (current) out.push(current);
      currentBucket = bucket;
      current = {
        time: bucket,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      };
      continue;
    }
    if (!current) continue;
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
  }

  if (current) out.push(current);
  return out;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
