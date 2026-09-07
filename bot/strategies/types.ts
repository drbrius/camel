/**
 * Strategy contract.
 *
 * A strategy answers two questions and nothing else:
 *   - `evaluate`: should a new position be opened, and where does its stop go?
 *   - `manage`:   should an open position's stop move, or should it be closed?
 *
 * It never sizes a position, never checks the account, and never places an
 * order. All of that belongs to the risk manager and the engine. Keeping that
 * boundary sharp is what makes it possible to add a strategy without being
 * able to endanger the account.
 */

import type { Candle, InstrumentSpec, Position, Quote, Side, Timeframe } from '../types';

export interface StrategyContext {
  symbol: string;
  spec: InstrumentSpec;
  /** Closed candles on the primary timeframe, oldest first. */
  candles: Candle[];
  /** Closed candles on the higher timeframe, for regime filtering. */
  higher: Candle[];
  quote: Quote;
  now: number;
  /** Positions currently open on this symbol. */
  positions: Position[];
  /** ATR on the primary timeframe – the unit for all distances. */
  atr: number;
  spreadPips: number;
}

export interface Signal {
  symbol: string;
  side: Side;
  strategy: string;
  /** Absolute stop price. The risk manager derives size from it. */
  stopPrice: number;
  takeProfitPrice?: number;
  /** 0..1 – scales risk within the configured per-trade limit. */
  confidence: number;
  reason: string;
}

export type PositionAction =
  | { type: 'hold' }
  | { type: 'move-stop'; stopLoss: number; reason: string }
  | { type: 'partial-close'; volume: number; reason: string }
  | { type: 'close'; reason: string };

export interface Strategy {
  readonly id: string;
  readonly timeframe: Timeframe;
  /** Bars required before the strategy may emit a signal. */
  readonly warmupBars: number;
  evaluate(ctx: StrategyContext): Signal | null;
  manage(position: Position, ctx: StrategyContext): PositionAction;
}

/** Distance from entry to stop, in price. */
export function riskDistance(signal: Signal, entryPrice: number): number {
  return Math.abs(entryPrice - signal.stopPrice);
}

/**
 * Shared trade management used by every strategy: move to break-even after
 * 1R, then trail at `trailAtrMultiple` ATR behind the best price seen.
 *
 * Break-even is placed slightly beyond entry so that spread and commission are
 * covered – a "break-even" stop at exactly the entry price still loses money.
 */
export function manageWithTrailing(
  position: Position,
  ctx: StrategyContext,
  options: { breakEvenAtR: number; trailAtrMultiple: number; trailStartsAtR: number }
): PositionAction {
  const price = position.side === 'buy' ? ctx.quote.bid : ctx.quote.ask;
  const direction = position.side === 'buy' ? 1 : -1;
  const openR =
    position.initialRiskPrice > 0 ? ((price - position.entryPrice) * direction) / position.initialRiskPrice : 0;

  if (openR >= options.trailStartsAtR && ctx.atr > 0) {
    const trailStop =
      position.side === 'buy'
        ? position.trailAnchor - options.trailAtrMultiple * ctx.atr
        : position.trailAnchor + options.trailAtrMultiple * ctx.atr;

    // Stops only ever move in the direction of profit.
    const improves =
      position.side === 'buy' ? trailStop > position.stopLoss : trailStop < position.stopLoss;
    if (improves) {
      return {
        type: 'move-stop',
        stopLoss: trailStop,
        reason: `trailing at ${options.trailAtrMultiple} ATR (open ${openR.toFixed(2)}R)`
      };
    }
  }

  if (!position.breakEvenDone && openR >= options.breakEvenAtR) {
    const costBuffer = ctx.spec.pipSize * (ctx.spec.typicalSpreadPips + 0.5);
    const breakEven = position.entryPrice + direction * costBuffer;
    const improves =
      position.side === 'buy' ? breakEven > position.stopLoss : breakEven < position.stopLoss;
    if (improves) {
      return { type: 'move-stop', stopLoss: breakEven, reason: `break-even after ${openR.toFixed(2)}R` };
    }
  }

  return { type: 'hold' };
}
