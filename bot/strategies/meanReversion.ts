/**
 * Range mean reversion.
 *
 * Premise: outside of trends, price oscillates around a moving centre. Fading
 * a stretched move back to that centre wins often (55–65 %) with small
 * winners, which complements the breakout strategy's rare-but-large payoff.
 *
 * The danger is well known: mean reversion is short volatility, so a single
 * trend day can give back a month of gains. Three guards address that:
 *   1. Only trade when ADX confirms a range – never fade an established trend.
 *   2. A hard ATR stop, always. No averaging down, no widening.
 *   3. A time stop: if the reversion has not happened within `maxBarsInTrade`,
 *      the premise was wrong and the position is closed at whatever it is worth.
 */

import type { Position, Side } from '../types';
import { adx, atr, bollinger, closes, last, rsi } from '../core/indicators';
import { sessionOf } from '../core/time';
import {
  manageWithTrailing,
  type PositionAction,
  type Signal,
  type Strategy,
  type StrategyContext
} from './types';

/**
 * Minimum share of the signal bar's range that must sit on the rejection side
 * of the close. A bar closing on its low while breaking the lower band is a
 * continuation, not a reversal.
 */
const REJECTION_THRESHOLD = 0.2;

export interface MeanReversionParams {
  bollingerPeriod: number;
  bollingerDeviations: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  atrPeriod: number;
  adxPeriod: number;
  /** Maximum ADX for the regime to count as ranging. */
  maxAdx: number;
  stopAtrMultiple: number;
  /** Target is the band midline; this caps how far away it may be. */
  maxTargetAtrMultiple: number;
  breakEvenAtR: number;
  trailStartsAtR: number;
  trailAtrMultiple: number;
  /** Close the position after this many bars regardless of PnL. */
  maxBarsInTrade: number;
  sessions: string[];
}

/**
 * Conventional textbook levels, not optimised values.
 *
 * The filters compose multiplicatively, so tightening each one "a little"
 * compounds into a strategy that never trades: a 2.2σ band break *and* RSI<25
 * *and* ADX<20 co-occur on well under one bar in ten thousand. These defaults
 * use the standard thresholds (2σ, 30/70, ADX<25) so the filters stay
 * independent checks rather than one accidental super-filter.
 */
export const DEFAULT_MEAN_REVERSION_PARAMS: MeanReversionParams = {
  bollingerPeriod: 20,
  bollingerDeviations: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  atrPeriod: 14,
  adxPeriod: 14,
  maxAdx: 25,
  stopAtrMultiple: 1.4,
  maxTargetAtrMultiple: 3.0,
  breakEvenAtR: 0.8,
  trailStartsAtR: 1.2,
  trailAtrMultiple: 1.6,
  maxBarsInTrade: 32,
  sessions: ['london', 'overlap', 'newyork', 'tokyo']
};

export class MeanReversionStrategy implements Strategy {
  readonly id = 'mean-reversion';
  readonly timeframe = 'M15' as const;
  readonly warmupBars: number;

  constructor(private readonly params: MeanReversionParams = DEFAULT_MEAN_REVERSION_PARAMS) {
    this.warmupBars = Math.max(params.bollingerPeriod, params.adxPeriod * 3, params.rsiPeriod * 3) + 10;
  }

  evaluate(ctx: StrategyContext): Signal | null {
    const { params } = this;
    if (ctx.candles.length < this.warmupBars) return null;
    if (ctx.positions.length > 0) return null;
    if (!params.sessions.includes(sessionOf(ctx.now))) return null;
    if (ctx.spreadPips > ctx.spec.typicalSpreadPips * 2) return null;

    const series = closes(ctx.candles);
    const bands = bollinger(series, params.bollingerPeriod, params.bollingerDeviations);
    const rsiSeries = rsi(series, params.rsiPeriod);
    const atrSeries = atr(ctx.candles, params.atrPeriod);
    const adxSeries = adx(ctx.candles, params.adxPeriod);

    const i = ctx.candles.length - 1;
    const bar = ctx.candles[i];
    const upper = bands.upper[i];
    const lower = bands.lower[i];
    const middle = bands.middle[i];
    const currentRsi = rsiSeries[i];
    const currentAtr = atrSeries[i];
    const currentAdx = adxSeries[i];

    if (![upper, lower, middle, currentRsi, currentAtr, currentAdx].every((v) => Number.isFinite(v))) {
      return null;
    }
    // Fading a trend is how this strategy family blows up. Never do it.
    if (currentAdx > params.maxAdx) return null;
    if (currentAtr <= 0) return null;

    let side: Side | null = null;
    if (bar.close < lower && currentRsi < params.rsiOversold) side = 'buy';
    else if (bar.close > upper && currentRsi > params.rsiOverbought) side = 'sell';
    if (!side) return null;

    // Require a rejection wick: the bar must show the extreme being refused,
    // not merely be closing at its low in the middle of a slide.
    const range = bar.high - bar.low;
    if (range <= 0) return null;
    const rejection =
      side === 'buy' ? (bar.close - bar.low) / range : (bar.high - bar.close) / range;
    if (rejection < REJECTION_THRESHOLD) return null;

    const entryPrice = side === 'buy' ? ctx.quote.ask : ctx.quote.bid;
    const stopDistance = currentAtr * params.stopAtrMultiple;
    const stopPrice = side === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;

    // The target is the band midline, capped so the reward stays plausible.
    const rawTargetDistance = Math.abs(middle - entryPrice);
    const targetDistance = Math.min(rawTargetDistance, currentAtr * params.maxTargetAtrMultiple);
    // A target closer than the stop is a negative-expectancy trade unless the
    // hit rate is extreme; require at least 1R.
    if (targetDistance < stopDistance) return null;

    const takeProfitPrice =
      side === 'buy' ? entryPrice + targetDistance : entryPrice - targetDistance;

    const extremity =
      side === 'buy' ? params.rsiOversold - currentRsi : currentRsi - params.rsiOverbought;
    const confidence = Math.min(1, 0.5 + extremity / 30);

    return {
      symbol: ctx.symbol,
      side,
      strategy: this.id,
      stopPrice,
      takeProfitPrice,
      confidence,
      reason: `band ${side === 'buy' ? 'lower' : 'upper'} rejected (RSI ${currentRsi.toFixed(1)}, ADX ${currentAdx.toFixed(1)})`
    };
  }

  manage(position: Position, ctx: StrategyContext): PositionAction {
    const { params } = this;

    // Time stop: the reversion either happens quickly or the premise was wrong.
    const barMs = 15 * 60_000;
    const barsHeld = (ctx.now - position.openedAt) / barMs;
    if (barsHeld > params.maxBarsInTrade) {
      return { type: 'close', reason: `time stop after ${Math.floor(barsHeld)} bars` };
    }

    // A range that turns into a trend against us invalidates the whole idea.
    const currentAdx = last(adx(ctx.candles, params.adxPeriod));
    if (currentAdx !== undefined && currentAdx > params.maxAdx * 1.8) {
      return { type: 'close', reason: `range broke into a trend (ADX ${currentAdx.toFixed(1)})` };
    }

    return manageWithTrailing(position, ctx, {
      breakEvenAtR: params.breakEvenAtR,
      trailStartsAtR: params.trailStartsAtR,
      trailAtrMultiple: params.trailAtrMultiple
    });
  }
}
