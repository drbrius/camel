/**
 * Position sizing.
 *
 * Sizing is derived from risk, never the other way round: we decide how many
 * account-currency units we are willing to lose, measure the distance to the
 * stop, and let the lot size fall out of that. A trade whose minimum lot would
 * risk more than the budget is rejected outright rather than "rounded down and
 * hoped for" – that rejection is a feature, not a limitation.
 */

import type { InstrumentSpec } from '../types';
import { CurrencyConverter, roundLots } from './instruments';

export interface SizingInput {
  equity: number;
  /** Percent of equity to risk on this trade, before instrument weighting. */
  riskPct: number;
  /** Absolute price distance between entry and stop. */
  stopDistance: number;
  spec: InstrumentSpec;
  converter: CurrencyConverter;
  /** Hard ceiling in account currency (e.g. what the portfolio budget allows). */
  maxRiskAmount?: number;
}

export interface SizingResult {
  ok: boolean;
  volume: number;
  /** Money at risk if the stop is hit, including commission. */
  riskAmount: number;
  /** Money at risk excluding commission – used for R-multiple maths. */
  priceRiskAmount: number;
  commission: number;
  reason?: string;
}

/**
 * Computes the lot size for a trade.
 *
 * Commission is treated as part of the risk budget: a round-turn fee on a
 * 0.25 % risk trade is not noise, and ignoring it means every stop-out loses
 * slightly more than the model assumes. Over a 200-trade challenge that
 * difference compounds into a real drawdown gap.
 */
export function computePositionSize(input: SizingInput): SizingResult {
  const { equity, riskPct, stopDistance, spec, converter } = input;

  const empty: SizingResult = { ok: false, volume: 0, riskAmount: 0, priceRiskAmount: 0, commission: 0 };

  if (!(equity > 0)) {
    return { ...empty, reason: 'equity must be positive' };
  }
  if (!(stopDistance > 0)) {
    return { ...empty, reason: 'stop distance must be positive' };
  }
  if (!(riskPct > 0)) {
    return { ...empty, reason: 'risk percentage must be positive' };
  }

  const weightedRiskPct = riskPct * spec.riskWeight;
  let budget = equity * (weightedRiskPct / 100);
  if (input.maxRiskAmount !== undefined) {
    budget = Math.min(budget, input.maxRiskAmount);
  }
  if (!(budget > 0)) {
    return { ...empty, reason: 'risk budget exhausted' };
  }

  const valuePerLot = converter.valuePerLotPerPricePoint(spec);
  const lossPerLot = stopDistance * valuePerLot + spec.commissionPerLot;
  if (!(lossPerLot > 0)) {
    return { ...empty, reason: 'instrument specification yields a non-positive loss per lot' };
  }

  const rawVolume = budget / lossPerLot;
  const volume = roundLots(Math.min(rawVolume, spec.maxLot), spec);

  if (volume < spec.minLot) {
    return {
      ...empty,
      reason:
        `minimum lot ${spec.minLot} would risk ${(spec.minLot * lossPerLot).toFixed(2)} ` +
        `but only ${budget.toFixed(2)} is available – trade skipped`
    };
  }

  const priceRiskAmount = volume * stopDistance * valuePerLot;
  const commission = volume * spec.commissionPerLot;

  return {
    ok: true,
    volume,
    riskAmount: priceRiskAmount + commission,
    priceRiskAmount,
    commission
  };
}

/**
 * Money that would be lost if an open position were stopped out right now.
 * Used by the risk manager to compute the portfolio's worst case.
 */
export function openRiskOf(
  side: 'buy' | 'sell',
  volume: number,
  currentPrice: number,
  stopLoss: number,
  spec: InstrumentSpec,
  converter: CurrencyConverter
): number {
  const distance = side === 'buy' ? currentPrice - stopLoss : stopLoss - currentPrice;

  // A stop already at or beyond entry contributes no risk at all – neither
  // negative risk (locked-in profit must not fund a larger position elsewhere)
  // nor a residual commission charge, since the guaranteed exit is in profit.
  if (distance <= 0) return 0;

  const valuePerLot = converter.valuePerLotPerPricePoint(spec);
  return distance * volume * valuePerLot + volume * spec.commissionPerLot;
}
