/**
 * Performance and FTMO-compliance metrics.
 *
 * Two questions matter, and they are not the same question:
 *   - Is the strategy profitable? (expectancy, profit factor, Sharpe)
 *   - Would it have *passed*?     (daily/total limit breaches, days to target)
 *
 * A system with a great profit factor that breached the daily limit once is
 * worth nothing to a prop trader, so the FTMO verdict is reported first.
 */

import type { ClosedTrade, FtmoRuleSet } from '../types';
import { brokerDayKey } from '../core/time';

export interface EquityPoint {
  time: number;
  equity: number;
  balance: number;
}

export interface DailyRecord {
  day: string;
  startEquity: number;
  endEquity: number;
  lowEquity: number;
  peakEquity: number;
  pnl: number;
  pnlPct: number;
  /** Worst intraday drawdown measured from the day's starting equity. */
  maxIntradayLossPct: number;
  trades: number;
}

export interface FtmoVerdict {
  passed: boolean;
  targetReached: boolean;
  daysToTarget: number | null;
  dailyLimitBreached: boolean;
  totalLimitBreached: boolean;
  worstDayPct: number;
  maxTotalDrawdownPct: number;
  tradingDays: number;
  breaches: string[];
}

export interface BacktestMetrics {
  startEquity: number;
  endEquity: number;
  netProfit: number;
  netProfitPct: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdownPct: number;
  /** Longest run of consecutive losing trades. */
  maxLosingStreak: number;
  sharpe: number;
  totalCommission: number;
  totalSwap: number;
  byStrategy: Record<string, { trades: number; netPnl: number; winRatePct: number; expectancyR: number }>;
  daily: DailyRecord[];
  ftmo: FtmoVerdict;
}

/** Groups the equity curve into broker days and measures each one. */
export function buildDailyRecords(
  curve: EquityPoint[],
  trades: ClosedTrade[],
  timeZone: string
): DailyRecord[] {
  const byDay = new Map<string, EquityPoint[]>();
  for (const point of curve) {
    const day = brokerDayKey(point.time, timeZone);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(point);
    else byDay.set(day, [point]);
  }

  const tradesByDay = new Map<string, number>();
  for (const trade of trades) {
    const day = brokerDayKey(trade.closedAt, timeZone);
    tradesByDay.set(day, (tradesByDay.get(day) ?? 0) + 1);
  }

  const records: DailyRecord[] = [];
  for (const [day, points] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const startEquity = points[0].equity;
    const endEquity = points[points.length - 1].equity;
    const lowEquity = Math.min(...points.map((p) => p.equity));
    const peakEquity = Math.max(...points.map((p) => p.equity));

    records.push({
      day,
      startEquity,
      endEquity,
      lowEquity,
      peakEquity,
      pnl: endEquity - startEquity,
      pnlPct: ((endEquity - startEquity) / startEquity) * 100,
      maxIntradayLossPct: ((startEquity - lowEquity) / startEquity) * 100,
      trades: tradesByDay.get(day) ?? 0
    });
  }
  return records;
}

/**
 * Replays the equity curve against the FTMO rulebook.
 *
 * Deliberately strict: the daily check uses the *lowest* equity of the day,
 * because FTMO evaluates floating drawdown continuously, not at the close.
 * A day that dipped 5.2 % and recovered still fails the account.
 */
export function evaluateFtmo(
  curve: EquityPoint[],
  daily: DailyRecord[],
  rules: FtmoRuleSet,
  startEquity: number
): FtmoVerdict {
  const breaches: string[] = [];
  let dailyLimitBreached = false;
  let totalLimitBreached = false;
  let worstDayPct = 0;

  for (const record of daily) {
    worstDayPct = Math.max(worstDayPct, record.maxIntradayLossPct);
    if (record.maxIntradayLossPct >= rules.maxDailyLossPct) {
      dailyLimitBreached = true;
      breaches.push(
        `${record.day}: intraday loss ${record.maxIntradayLossPct.toFixed(2)}% >= ${rules.maxDailyLossPct}% daily limit`
      );
    }
  }

  const totalFloor = startEquity * (1 - rules.maxTotalLossPct / 100);
  let maxTotalDrawdownPct = 0;
  for (const point of curve) {
    const drawdown = ((startEquity - point.equity) / startEquity) * 100;
    maxTotalDrawdownPct = Math.max(maxTotalDrawdownPct, drawdown);
    if (point.equity <= totalFloor && !totalLimitBreached) {
      totalLimitBreached = true;
      breaches.push(
        `${new Date(point.time).toISOString()}: equity ${point.equity.toFixed(2)} breached the ` +
          `${rules.maxTotalLossPct}% max-loss floor of ${totalFloor.toFixed(2)}`
      );
    }
  }

  const targetEquity = startEquity * (1 + rules.profitTargetPct / 100);
  const targetPoint = rules.profitTargetPct > 0 ? curve.find((p) => p.equity >= targetEquity) : curve[0];
  const targetReached = Boolean(targetPoint);

  let daysToTarget: number | null = null;
  if (targetPoint && curve.length > 0) {
    daysToTarget = Math.ceil((targetPoint.time - curve[0].time) / 86_400_000);
  }

  const tradingDays = daily.filter((d) => d.trades > 0).length;
  if (tradingDays < rules.minTradingDays) {
    breaches.push(`only ${tradingDays} trading days, ${rules.minTradingDays} required`);
  }

  return {
    passed:
      targetReached &&
      !dailyLimitBreached &&
      !totalLimitBreached &&
      tradingDays >= rules.minTradingDays,
    targetReached,
    daysToTarget,
    dailyLimitBreached,
    totalLimitBreached,
    worstDayPct,
    maxTotalDrawdownPct,
    tradingDays,
    breaches
  };
}

export function computeMetrics(
  curve: EquityPoint[],
  trades: ClosedTrade[],
  rules: FtmoRuleSet
): BacktestMetrics {
  const startEquity = curve.length > 0 ? curve[0].equity : rules.accountSize;
  const endEquity = curve.length > 0 ? curve[curve.length - 1].equity : startEquity;

  // Partial closes are legs of one idea, not separate trades: counting them
  // separately would inflate the win rate with guaranteed winners.
  const fullTrades = trades.filter((t) => t.reason !== 'partial');

  const wins = fullTrades.filter((t) => t.netPnl > 0);
  const losses = fullTrades.filter((t) => t.netPnl < 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0));

  let maxLosingStreak = 0;
  let currentStreak = 0;
  for (const trade of fullTrades) {
    if (trade.netPnl < 0) {
      currentStreak++;
      maxLosingStreak = Math.max(maxLosingStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  let peak = startEquity;
  let maxDrawdownPct = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - point.equity) / peak) * 100);
  }

  const daily = buildDailyRecords(curve, trades, rules.dailyResetTimeZone);
  const dailyReturns = daily.map((d) => d.pnlPct / 100);
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (dailyReturns.length || 1);
  const sd = Math.sqrt(variance);
  // Annualised on 252 trading days.
  const sharpe = sd > 0 ? (meanReturn / sd) * Math.sqrt(252) : 0;

  // Counts, win rate and expectancy use whole trades only, but the money
  // column must include banked partials – otherwise the per-strategy PnL does
  // not add up to the account's net profit.
  const byStrategy: BacktestMetrics['byStrategy'] = {};
  for (const trade of trades) {
    const entry = byStrategy[trade.strategy] ?? { trades: 0, netPnl: 0, winRatePct: 0, expectancyR: 0 };
    if (trade.reason !== 'partial') entry.trades++;
    entry.netPnl += trade.netPnl;
    byStrategy[trade.strategy] = entry;
  }
  for (const [name, entry] of Object.entries(byStrategy)) {
    const subset = fullTrades.filter((t) => t.strategy === name);
    entry.winRatePct =
      subset.length > 0 ? Number(((subset.filter((t) => t.netPnl > 0).length / subset.length) * 100).toFixed(1)) : 0;
    entry.expectancyR =
      subset.length > 0 ? Number((subset.reduce((sum, t) => sum + t.rMultiple, 0) / subset.length).toFixed(3)) : 0;
    entry.netPnl = Number(entry.netPnl.toFixed(2));
  }

  return {
    startEquity: Number(startEquity.toFixed(2)),
    endEquity: Number(endEquity.toFixed(2)),
    netProfit: Number((endEquity - startEquity).toFixed(2)),
    netProfitPct: Number((((endEquity - startEquity) / startEquity) * 100).toFixed(2)),
    totalTrades: fullTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: fullTrades.length > 0 ? Number(((wins.length / fullTrades.length) * 100).toFixed(1)) : 0,
    averageWin: wins.length > 0 ? Number((grossProfit / wins.length).toFixed(2)) : 0,
    averageLoss: losses.length > 0 ? Number((grossLoss / losses.length).toFixed(2)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0,
    expectancyR:
      fullTrades.length > 0
        ? Number((fullTrades.reduce((sum, t) => sum + t.rMultiple, 0) / fullTrades.length).toFixed(3))
        : 0,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    maxLosingStreak,
    sharpe: Number(sharpe.toFixed(2)),
    totalCommission: Number(trades.reduce((sum, t) => sum + t.commission, 0).toFixed(2)),
    totalSwap: Number(trades.reduce((sum, t) => sum + t.swap, 0).toFixed(2)),
    byStrategy,
    daily,
    ftmo: evaluateFtmo(curve, daily, rules, startEquity)
  };
}

/** Renders the metrics as a console report. */
export function formatReport(metrics: BacktestMetrics, rules: FtmoRuleSet): string {
  const lines: string[] = [];
  const pass = metrics.ftmo.passed;

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push(`  FTMO ${rules.phase.toUpperCase()} VERDICT: ${pass ? '✅ PASSED' : '❌ NOT PASSED'}`);
  lines.push('════════════════════════════════════════════════════════════');
  lines.push(`  Profit target (${rules.profitTargetPct}%)   ${metrics.ftmo.targetReached ? 'reached' : 'not reached'}` +
    (metrics.ftmo.daysToTarget !== null ? ` after ${metrics.ftmo.daysToTarget} days` : ''));
  lines.push(`  Daily limit (${rules.maxDailyLossPct}%)      ${metrics.ftmo.dailyLimitBreached ? 'BREACHED' : 'respected'} (worst day: ${metrics.ftmo.worstDayPct.toFixed(2)}%)`);
  lines.push(`  Max loss (${rules.maxTotalLossPct}%)        ${metrics.ftmo.totalLimitBreached ? 'BREACHED' : 'respected'} (max DD: ${metrics.ftmo.maxTotalDrawdownPct.toFixed(2)}%)`);
  lines.push(`  Trading days              ${metrics.ftmo.tradingDays}`);

  if (metrics.ftmo.breaches.length > 0) {
    lines.push('');
    lines.push('  Rule breaches:');
    for (const breach of metrics.ftmo.breaches.slice(0, 10)) lines.push(`    - ${breach}`);
  }

  lines.push('');
  lines.push('──────────────────────── PERFORMANCE ────────────────────────');
  lines.push(`  Start equity              ${metrics.startEquity.toLocaleString()} ${rules.currency}`);
  lines.push(`  End equity                ${metrics.endEquity.toLocaleString()} ${rules.currency}`);
  lines.push(`  Net profit                ${metrics.netProfit.toLocaleString()} ${rules.currency} (${metrics.netProfitPct}%)`);
  lines.push(`  Trades                    ${metrics.totalTrades} (${metrics.wins}W / ${metrics.losses}L)`);
  lines.push(`  Win rate                  ${metrics.winRatePct}%`);
  lines.push(`  Profit factor             ${metrics.profitFactor}`);
  lines.push(`  Expectancy                ${metrics.expectancyR} R per trade`);
  lines.push(`  Max drawdown              ${metrics.maxDrawdownPct}%`);
  lines.push(`  Longest losing streak     ${metrics.maxLosingStreak}`);
  lines.push(`  Sharpe (annualised)       ${metrics.sharpe}`);
  lines.push(`  Costs                     ${metrics.totalCommission} commission / ${metrics.totalSwap} swap`);

  if (Object.keys(metrics.byStrategy).length > 0) {
    lines.push('');
    lines.push('──────────────────────── BY STRATEGY ────────────────────────');
    for (const [name, entry] of Object.entries(metrics.byStrategy)) {
      lines.push(
        `  ${name.padEnd(20)} ${String(entry.trades).padStart(4)} trades  ` +
          `${String(entry.winRatePct).padStart(5)}% win  ${String(entry.expectancyR).padStart(7)} R  ` +
          `${entry.netPnl.toLocaleString()} ${rules.currency}`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
