/**
 * Indicator library.
 *
 * All functions return an array the same length as the input, with `NaN` in
 * the warm-up region. That convention keeps index alignment with the candle
 * array trivial and makes off-by-one bugs (the classic source of strategies
 * that "work" in backtests only) obvious.
 */

import type { Candle } from '../types';

export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;

  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Wilder's smoothing – the basis of ATR, RSI and ADX. */
function wilder(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + values[i]) / period;
  }
  return out;
}

export function trueRange(candles: Candle[]): number[] {
  return candles.map((candle, i) => {
    if (i === 0) return candle.high - candle.low;
    const prevClose = candles[i - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );
  });
}

export function atr(candles: Candle[], period = 14): number[] {
  return wilder(trueRange(candles), period);
}

export function rsi(values: number[], period = 14): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length <= period) return out;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  const avgGain = wilder(gains.slice(1), period);
  const avgLoss = wilder(losses.slice(1), period);

  for (let i = 0; i < avgGain.length; i++) {
    if (Number.isNaN(avgGain[i])) continue;
    const loss = avgLoss[i];
    out[i + 1] = loss === 0 ? 100 : 100 - 100 / (1 + avgGain[i] / loss);
  }
  return out;
}

/**
 * Rolling standard deviation via running sums – O(n) rather than O(n·period),
 * which matters because the backtester recomputes this on every bar.
 */
export function stdev(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period <= 0) return out;

  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    sumSquares += values[i] * values[i];
    if (i >= period) {
      const dropped = values[i - period];
      sum -= dropped;
      sumSquares -= dropped * dropped;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      // Clamp: accumulated float error can push a near-zero variance negative.
      out[i] = Math.sqrt(Math.max(0, sumSquares / period - mean * mean));
    }
  }
  return out;
}

export interface BollingerBands {
  middle: number[];
  upper: number[];
  lower: number[];
}

export function bollinger(values: number[], period = 20, deviations = 2): BollingerBands {
  const middle = sma(values, period);
  const sd = stdev(values, period);
  return {
    middle,
    upper: middle.map((m, i) => m + deviations * sd[i]),
    lower: middle.map((m, i) => m - deviations * sd[i])
  };
}

export interface DonchianChannel {
  upper: number[];
  lower: number[];
  middle: number[];
}

/**
 * Donchian channel over the *previous* `period` bars, excluding the current
 * one. Excluding the current bar is what makes a breakout test causal: a
 * channel that includes the bar being tested can never be broken.
 */
export function donchian(candles: Candle[], period = 20): DonchianChannel {
  const n = candles.length;
  const upper = new Array<number>(n).fill(NaN);
  const lower = new Array<number>(n).fill(NaN);
  const middle = new Array<number>(n).fill(NaN);
  if (period <= 0 || n <= period) return { upper, lower, middle };

  // Monotonic deques hold the indices that can still become the window's
  // extreme, giving amortised O(1) per bar instead of an O(period) rescan.
  const maxDeque: number[] = [];
  const minDeque: number[] = [];

  for (let i = 0; i < n; i++) {
    // The window covers [i-period, i-1]: the current bar is excluded so a
    // breakout test stays causal.
    if (i > 0) {
      const j = i - 1;
      while (maxDeque.length > 0 && candles[maxDeque[maxDeque.length - 1]].high <= candles[j].high) {
        maxDeque.pop();
      }
      maxDeque.push(j);
      while (minDeque.length > 0 && candles[minDeque[minDeque.length - 1]].low >= candles[j].low) {
        minDeque.pop();
      }
      minDeque.push(j);
    }

    const windowStart = i - period;
    while (maxDeque.length > 0 && maxDeque[0] < windowStart) maxDeque.shift();
    while (minDeque.length > 0 && minDeque[0] < windowStart) minDeque.shift();

    if (i >= period) {
      const hi = candles[maxDeque[0]].high;
      const lo = candles[minDeque[0]].low;
      upper[i] = hi;
      lower[i] = lo;
      middle[i] = (hi + lo) / 2;
    }
  }

  return { upper, lower, middle };
}

/**
 * Average Directional Index – our regime filter. High ADX means trending
 * (trade breakouts), low ADX means ranging (trade mean reversion).
 */
export function adx(candles: Candle[], period = 14): number[] {
  const length = candles.length;
  const out = new Array<number>(length).fill(NaN);
  if (length < period * 2) return out;

  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const tr = trueRange(candles);
  const smoothedTr = wilder(tr, period);
  const smoothedPlus = wilder(plusDm, period);
  const smoothedMinus = wilder(minusDm, period);

  const dx = new Array<number>(length).fill(NaN);
  for (let i = 0; i < length; i++) {
    const range = smoothedTr[i];
    if (!range || Number.isNaN(range) || Number.isNaN(smoothedPlus[i])) continue;
    const plusDi = (smoothedPlus[i] / range) * 100;
    const minusDi = (smoothedMinus[i] / range) * 100;
    const sum = plusDi + minusDi;
    dx[i] = sum === 0 ? 0 : (Math.abs(plusDi - minusDi) / sum) * 100;
  }

  const valid = dx.filter((v) => !Number.isNaN(v));
  const smoothedDx = wilder(valid, period);
  const offset = dx.findIndex((v) => !Number.isNaN(v));
  for (let i = 0; i < smoothedDx.length; i++) {
    if (!Number.isNaN(smoothedDx[i])) out[offset + i] = smoothedDx[i];
  }
  return out;
}

/** Slope of a linear regression over the last `period` values, per bar. */
export function slope(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const xMean = (period - 1) / 2;
  let xVariance = 0;
  for (let i = 0; i < period; i++) xVariance += (i - xMean) ** 2;

  for (let i = period - 1; i < values.length; i++) {
    let yMean = 0;
    for (let j = 0; j < period; j++) yMean += values[i - period + 1 + j];
    yMean /= period;

    let covariance = 0;
    for (let j = 0; j < period; j++) {
      covariance += (j - xMean) * (values[i - period + 1 + j] - yMean);
    }
    out[i] = covariance / xVariance;
  }
  return out;
}

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

/** Last non-NaN value of a series, or `undefined` while still warming up. */
export function last(series: number[]): number | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!Number.isNaN(series[i])) return series[i];
  }
  return undefined;
}
