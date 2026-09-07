/**
 * Strategy registry.
 *
 * The two strategies are deliberately anti-correlated: the breakout makes its
 * money in trending regimes and bleeds in ranges, the mean-reversion does the
 * opposite. Running both smooths the equity curve, which matters far more for
 * passing a challenge than raw return does — a 5 % daily loss limit punishes
 * variance, not mediocrity.
 */

import { MeanReversionStrategy, DEFAULT_MEAN_REVERSION_PARAMS } from './meanReversion';
import { TrendBreakoutStrategy, DEFAULT_TREND_PARAMS } from './trendBreakout';
import type { Strategy } from './types';

export { DEFAULT_MEAN_REVERSION_PARAMS, DEFAULT_TREND_PARAMS };
export { MeanReversionStrategy, TrendBreakoutStrategy };
export * from './types';

const FACTORIES: Record<string, () => Strategy> = {
  'trend-breakout': () => new TrendBreakoutStrategy(),
  'mean-reversion': () => new MeanReversionStrategy()
};

export function availableStrategies(): string[] {
  return Object.keys(FACTORIES);
}

export function createStrategies(ids: string[]): Strategy[] {
  return ids.map((id) => {
    const factory = FACTORIES[id];
    if (!factory) {
      throw new Error(`Unknown strategy "${id}". Available: ${availableStrategies().join(', ')}`);
    }
    return factory();
  });
}
