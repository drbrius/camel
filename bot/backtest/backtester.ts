/**
 * Backtester.
 *
 * It drives the *real* engine against the paper broker rather than
 * reimplementing the decision logic. That is the whole point: if the backtest
 * says the daily limit was never breached, that statement is about the code
 * that will run live, not about a separate simplified model of it.
 *
 * Known limitations, stated plainly because they bound how much the numbers
 * are worth:
 *   - Bar data, not ticks. Intrabar fill order is assumed unfavourable.
 *   - Spread is modelled as constant per instrument; in reality it widens
 *     around news and the rollover, which is when breakouts trigger.
 *   - No slippage model for gaps over the weekend.
 *   - Swap is a flat per-lot charge, not the broker's real dual-sided table.
 *
 * The net effect is that results here are optimistic. Treat a backtest that
 * only just passes as a failure.
 */

import type { BotConfig } from '../config';
import { PaperBroker } from '../brokers/paper';
import { Engine } from '../core/engine';
import { CurrencyConverter } from '../core/instruments';
import { Logger, nullLogger } from '../core/logger';
import { RiskManager } from '../core/risk';
import { createStrategies } from '../strategies';
import type { Candle, ClosedTrade } from '../types';
import { computeMetrics, formatReport, type BacktestMetrics, type EquityPoint } from './metrics';

export interface BacktestOptions {
  config: BotConfig;
  /** Candle series per symbol on the primary timeframe, oldest first. */
  data: Record<string, Candle[]>;
  /** Bars fed in before trading starts, so indicators are warm. */
  warmupBars?: number;
  slippagePips?: number;
  spreadMultiplier?: number;
  logger?: Logger;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: ClosedTrade[];
  report: string;
}

export async function runBacktest(options: BacktestOptions): Promise<BacktestResult> {
  const { config, data } = options;
  const logger = options.logger ?? nullLogger;
  const warmupBars = options.warmupBars ?? 200;

  const symbols = config.symbols.filter((symbol) => (data[symbol]?.length ?? 0) > 0);
  if (symbols.length === 0) {
    throw new Error('no candle data for any configured symbol');
  }

  const converter = new CurrencyConverter(config.rules.currency);
  const broker = new PaperBroker({
    startingBalance: config.rules.accountSize,
    currency: config.rules.currency,
    converter,
    slippagePips: options.slippagePips ?? 0.3,
    spreadMultiplier: options.spreadMultiplier ?? 1
  });

  const risk = new RiskManager({ rules: config.rules, config: config.risk, converter });

  // Simulated clock: the engine must never see the wall clock during a backtest.
  let simulatedNow = 0;
  const engine = new Engine({
    config,
    broker,
    strategies: createStrategies(config.strategies),
    risk,
    converter,
    logger,
    clock: () => simulatedNow
  });

  // Merge every symbol's timeline so cross-symbol risk is evaluated in order.
  const timeline = [...new Set(symbols.flatMap((symbol) => data[symbol].map((c) => c.time)))].sort(
    (a, b) => a - b
  );

  const cursors = new Map<string, number>(symbols.map((symbol) => [symbol, 0]));
  const equityCurve: EquityPoint[] = [];

  for (let step = 0; step < timeline.length; step++) {
    const time = timeline[step];
    simulatedNow = time;

    // Advance every symbol that has a bar at this timestamp.
    for (const symbol of symbols) {
      const series = data[symbol];
      let cursor = cursors.get(symbol)!;
      while (cursor < series.length && series[cursor].time === time) {
        const filled = broker.syncCandle(symbol, series[cursor]);
        if (step >= warmupBars) {
          for (const trade of filled) engine.registerExternalClose(trade);
        }
        cursor++;
      }
      cursors.set(symbol, cursor);
    }

    if (step < warmupBars) continue;

    await engine.iterate();

    const snapshot = await broker.getAccount();
    equityCurve.push({ time, equity: snapshot.equity, balance: snapshot.balance });
  }

  // Close anything still open so the final equity is realised, not floating.
  const remaining = await broker.closeAll('shutdown');
  for (const trade of remaining) engine.registerExternalClose(trade);

  if (remaining.length > 0) {
    const snapshot = await broker.getAccount();
    equityCurve.push({
      time: timeline[timeline.length - 1],
      equity: snapshot.equity,
      balance: snapshot.balance
    });
  }

  const trades = engine.closedTrades();
  const metrics = computeMetrics(equityCurve, trades, config.rules);

  return {
    metrics,
    equityCurve,
    trades,
    report: formatReport(metrics, config.rules)
  };
}

/**
 * Walk-forward analysis.
 *
 * Splits the history into consecutive out-of-sample windows and reports each
 * one separately. A strategy whose edge lives in two of eight windows is
 * curve-fitted, and the aggregate number hides that. This is the single most
 * useful check before risking a challenge fee.
 */
export async function runWalkForward(
  options: BacktestOptions & { windows: number }
): Promise<{ windows: BacktestResult[]; summary: string }> {
  const { windows, data, config } = options;
  const results: BacktestResult[] = [];

  const anySymbol = config.symbols.find((s) => (data[s]?.length ?? 0) > 0);
  if (!anySymbol) throw new Error('no candle data for any configured symbol');

  const totalBars = data[anySymbol].length;
  const windowSize = Math.floor(totalBars / windows);
  if (windowSize < 400) {
    throw new Error(`each window would only hold ${windowSize} bars – use fewer windows or more data`);
  }

  for (let i = 0; i < windows; i++) {
    const from = i * windowSize;
    const to = i === windows - 1 ? totalBars : (i + 1) * windowSize;

    const slice: Record<string, typeof data[string]> = {};
    for (const symbol of config.symbols) {
      if (!data[symbol]) continue;
      slice[symbol] = data[symbol].slice(from, to);
    }

    results.push(await runBacktest({ ...options, data: slice, warmupBars: 200 }));
  }

  const profitable = results.filter((r) => r.metrics.netProfit > 0).length;
  const passed = results.filter((r) => r.metrics.ftmo.passed).length;
  const breached = results.filter(
    (r) => r.metrics.ftmo.dailyLimitBreached || r.metrics.ftmo.totalLimitBreached
  ).length;

  const summary = [
    '',
    '════════════════════ WALK-FORWARD SUMMARY ════════════════════',
    `  Windows                   ${windows}`,
    `  Profitable windows        ${profitable}/${windows}`,
    `  Windows passing FTMO      ${passed}/${windows}`,
    `  Windows breaching a limit ${breached}/${windows}`,
    '',
    ...results.map(
      (r, i) =>
        `  Window ${String(i + 1).padStart(2)}  ${String(r.metrics.netProfitPct).padStart(7)}%  ` +
        `DD ${String(r.metrics.maxDrawdownPct).padStart(5)}%  ` +
        `${String(r.metrics.totalTrades).padStart(4)} trades  ` +
        `PF ${r.metrics.profitFactor}`
    ),
    '',
    breached > 0
      ? '  ⚠️  At least one window breached a hard limit. Do not run this live.'
      : profitable < Math.ceil(windows * 0.6)
        ? '  ⚠️  The edge is not consistent across windows – likely curve-fitted.'
        : '  Results are consistent across windows. Still validate on a demo account first.',
    ''
  ].join('\n');

  return { windows: results, summary };
}
