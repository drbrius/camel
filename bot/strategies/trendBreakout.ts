/**
 * Trend breakout.
 *
 * Premise: in a trending regime, a break of the recent range tends to continue
 * far enough to pay for the many breaks that do not. This is the oldest
 * documented systematic edge in futures and FX (Donchian, Turtles) and it
 * survives mainly because it is uncomfortable to trade by hand: the win rate
 * sits near 35–40 % and the equity curve spends most of its time flat.
 *
 * Filters, in order of importance:
 *   1. Regime  – ADX above threshold, and the higher timeframe agrees on direction.
 *   2. Session – only the liquid London / London-NY overlap hours.
 *   3. Quality – the breakout bar must actually close beyond the channel, and
 *                volatility must not be so low that the stop sits inside noise.
 */

import type { Position, Side } from '../types';
import { adx, atr, closes, donchian, ema, last } from '../core/indicators';
import { sessionOf } from '../core/time';
import {
  manageWithTrailing,
  type PositionAction,
  type Signal,
  type Strategy,
  type StrategyContext
} from './types';

export interface TrendBreakoutParams {
  channelPeriod: number;
  atrPeriod: number;
  adxPeriod: number;
  /** Minimum ADX for the regime to count as trending. */
  minAdx: number;
  /** Fast/slow EMA on the higher timeframe – the directional filter. */
  higherFastEma: number;
  higherSlowEma: number;
  /** Stop distance in ATR multiples. */
  stopAtrMultiple: number;
  /** Target distance in ATR multiples. 0 disables the fixed target. */
  targetAtrMultiple: number;
  breakEvenAtR: number;
  trailStartsAtR: number;
  trailAtrMultiple: number;
  /** Sessions the strategy is allowed to enter in. */
  sessions: string[];
}

export const DEFAULT_TREND_PARAMS: TrendBreakoutParams = {
  channelPeriod: 40,
  atrPeriod: 14,
  adxPeriod: 14,
  minAdx: 22,
  higherFastEma: 20,
  higherSlowEma: 50,
  stopAtrMultiple: 1.6,
  targetAtrMultiple: 4.0,
  breakEvenAtR: 1.0,
  trailStartsAtR: 1.5,
  trailAtrMultiple: 2.2,
  sessions: ['london', 'overlap', 'newyork']
};

export class TrendBreakoutStrategy implements Strategy {
  readonly id = 'trend-breakout';
  readonly timeframe = 'M15' as const;
  readonly warmupBars: number;

  constructor(private readonly params: TrendBreakoutParams = DEFAULT_TREND_PARAMS) {
    this.warmupBars = Math.max(params.channelPeriod, params.adxPeriod * 3, params.atrPeriod * 2) + 10;
  }

  evaluate(ctx: StrategyContext): Signal | null {
    const { params } = this;
    if (ctx.candles.length < this.warmupBars) return null;
    if (ctx.positions.length > 0) return null;
    if (!params.sessions.includes(sessionOf(ctx.now))) return null;

    // Wide spreads eat a breakout's edge before it starts.
    if (ctx.spreadPips > ctx.spec.typicalSpreadPips * 2.5) return null;

    const channel = donchian(ctx.candles, params.channelPeriod);
    const adxSeries = adx(ctx.candles, params.adxPeriod);
    const atrSeries = atr(ctx.candles, params.atrPeriod);

    const i = ctx.candles.length - 1;
    const bar = ctx.candles[i];
    const upper = channel.upper[i];
    const lower = channel.lower[i];
    const currentAdx = adxSeries[i];
    const currentAtr = atrSeries[i];

    if (![upper, lower, currentAdx, currentAtr].every((v) => Number.isFinite(v))) return null;
    if (currentAdx < params.minAdx) return null;
    if (currentAtr <= 0) return null;

    const bias = this.higherTimeframeBias(ctx);
    if (!bias) return null;

    // The bar must *close* beyond the channel: an intrabar spike that closes
    // back inside is the classic false breakout this filter removes.
    const brokeUp = bar.close > upper;
    const brokeDown = bar.close < lower;

    let side: Side | null = null;
    if (brokeUp && bias === 'up') side = 'buy';
    else if (brokeDown && bias === 'down') side = 'sell';
    if (!side) return null;

    // Reject exhausted breakouts: if price is already far beyond the channel,
    // the stop would sit uneconomically wide and the move is likely late.
    const overshoot = side === 'buy' ? bar.close - upper : lower - bar.close;
    if (overshoot > currentAtr * 1.5) return null;

    const entryPrice = side === 'buy' ? ctx.quote.ask : ctx.quote.bid;
    const stopDistance = currentAtr * params.stopAtrMultiple;
    const stopPrice = side === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
    const takeProfitPrice =
      params.targetAtrMultiple > 0
        ? side === 'buy'
          ? entryPrice + currentAtr * params.targetAtrMultiple
          : entryPrice - currentAtr * params.targetAtrMultiple
        : undefined;

    // Confidence scales with trend strength; the engine turns it into size.
    const confidence = Math.min(1, 0.5 + (currentAdx - params.minAdx) / 40);

    return {
      symbol: ctx.symbol,
      side,
      strategy: this.id,
      stopPrice,
      takeProfitPrice,
      confidence,
      reason:
        `${params.channelPeriod}-bar channel broken (ADX ${currentAdx.toFixed(1)}, ` +
        `${ctx.higher.length > 0 ? 'HTF' : 'no HTF'} bias ${bias})`
    };
  }

  /** Higher-timeframe EMA structure – trades are only taken with it. */
  private higherTimeframeBias(ctx: StrategyContext): 'up' | 'down' | null {
    const { params } = this;
    if (ctx.higher.length < params.higherSlowEma + 5) return null;

    const higherCloses = closes(ctx.higher);
    const fast = last(ema(higherCloses, params.higherFastEma));
    const slow = last(ema(higherCloses, params.higherSlowEma));
    if (fast === undefined || slow === undefined) return null;

    // A neutral band around the crossover keeps us out of chop, where the
    // EMAs whipsaw and every breakout fails.
    const separation = Math.abs(fast - slow) / slow;
    if (separation < 0.0008) return null;

    return fast > slow ? 'up' : 'down';
  }

  manage(position: Position, ctx: StrategyContext): PositionAction {
    const { params } = this;

    // Bank half the position at 2R. This is the single biggest contributor to
    // surviving an FTMO challenge: it converts a large share of trades into a
    // guaranteed non-loss and keeps the daily drawdown curve shallow.
    if (!position.partialDone && position.initialRiskPrice > 0) {
      const price = position.side === 'buy' ? ctx.quote.bid : ctx.quote.ask;
      const direction = position.side === 'buy' ? 1 : -1;
      const openR = ((price - position.entryPrice) * direction) / position.initialRiskPrice;
      if (openR >= 2) {
        const half = Number((position.volume / 2).toFixed(2));
        if (half >= ctx.spec.minLot && position.volume - half >= ctx.spec.minLot) {
          return { type: 'partial-close', volume: half, reason: 'banking half at 2R' };
        }
      }
    }

    // Exit when the regime that justified the trade is gone.
    const adxSeries = adx(ctx.candles, params.adxPeriod);
    const currentAdx = last(adxSeries);
    if (currentAdx !== undefined && currentAdx < params.minAdx * 0.6) {
      return { type: 'close', reason: `trend regime collapsed (ADX ${currentAdx.toFixed(1)})` };
    }

    return manageWithTrailing(position, ctx, {
      breakEvenAtR: params.breakEvenAtR,
      trailStartsAtR: params.trailStartsAtR,
      trailAtrMultiple: params.trailAtrMultiple
    });
  }
}
