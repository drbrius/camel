/**
 * Test suite for the trading bot.
 *
 * The priority order is deliberate: the risk tests matter more than the
 * strategy tests. A strategy that underperforms costs money slowly; a risk
 * bug costs the whole account in one afternoon. Every rule that can fail a
 * challenge has a test that proves it fires.
 */

import { FTMO_PRESETS, RISK_PRESETS, loadConfig, validateConfig, type BotConfig } from './config';
import { PaperBroker } from './brokers/paper';
import { runBacktest } from './backtest/backtester';
import { computeMetrics } from './backtest/metrics';
import { atr, bollinger, donchian, ema, last, rsi, sma, stdev } from './core/indicators';
import { CurrencyConverter, getSpec, roundLots } from './core/instruments';
import { RiskManager, type OrderIntent } from './core/risk';
import { computePositionSize, openRiskOf } from './core/sizing';
import {
  brokerDayKey,
  isMarketClosed,
  isWeekendFlatWindow,
  resample
} from './core/time';
import { generateSeries, startPriceFor } from './data/synthetic';
import type { AccountSnapshot, Candle, ClosedTrade, Position } from './types';

let testsRun = 0;
let testsFailed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string): void {
  testsRun++;
  if (condition) {
    console.log(`✅ PASS: ${name}`);
  } else {
    testsFailed++;
    failures.push(name);
    console.error(`❌ FAIL: ${name}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, name: string): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  assert(ok, `${name} (expected ≈${expected}, got ${actual})`);
}

function section(title: string): void {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`);
}

function testConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    broker: 'paper',
    feed: 'synthetic',
    symbols: ['EURUSD'],
    primaryTimeframe: 'M15',
    higherTimeframe: 'H4',
    loopIntervalSeconds: 30,
    historyBars: 1200,
    rules: { ...FTMO_PRESETS.challenge, accountSize: 100_000, currency: 'USD' },
    risk: { ...RISK_PRESETS.conservative },
    strategies: ['trend-breakout', 'mean-reversion'],
    dataDir: 'data/bot-test',
    dryRun: false,
    metaapi: { token: '', accountId: '', region: 'new-york' },
    ...overrides
  };
}

function snapshot(equity: number, balance = equity): AccountSnapshot {
  return {
    time: Date.UTC(2026, 2, 10, 13, 0),
    balance,
    equity,
    marginUsed: 0,
    marginFree: equity,
    currency: 'USD'
  };
}

function makeCandles(closes: number[], startTime = Date.UTC(2026, 0, 5, 8, 0)): Candle[] {
  return closes.map((close, i) => ({
    time: startTime + i * 15 * 60_000,
    open: i === 0 ? close : closes[i - 1],
    high: Math.max(close, i === 0 ? close : closes[i - 1]) + 0.0002,
    low: Math.min(close, i === 0 ? close : closes[i - 1]) - 0.0002,
    close,
    volume: 100
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
function testIndicators(): void {
  section('Indicators');

  const flat = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const smaResult = sma(flat, 5);
  assertClose(smaResult[4], 3, 1e-9, 'SMA(5) of 1..5 is 3');
  assertClose(smaResult[9], 8, 1e-9, 'SMA(5) of 6..10 is 8');
  assert(Number.isNaN(smaResult[3]), 'SMA leaves the warm-up region as NaN');

  const emaResult = ema(flat, 5);
  // Seed is SMA(1..5)=3; next value: 6*(2/6) + 3*(4/6) = 4.
  assertClose(emaResult[5], 4, 1e-9, 'EMA(5) applies the correct smoothing factor');

  // Running-sum stdev must match the textbook definition exactly.
  const noisy = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const fast = stdev(noisy, 5);
  const naive = noisy.map((_, i) => {
    if (i < 4) return NaN;
    const window = noisy.slice(i - 4, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / 5;
    return Math.sqrt(window.reduce((s, v) => s + (v - mean) ** 2, 0) / 5);
  });
  const stdevMatches = fast.every(
    (v, i) => (Number.isNaN(v) && Number.isNaN(naive[i])) || Math.abs(v - naive[i]) < 1e-9
  );
  assert(stdevMatches, 'O(n) rolling stdev matches the naive computation');

  // Donchian must exclude the current bar, otherwise no breakout can exist.
  const candles = makeCandles([1.1, 1.2, 1.3, 1.15, 1.25, 1.5]);
  const channel = donchian(candles, 3);
  const expectedUpper = Math.max(candles[1].high, candles[2].high, candles[3].high);
  assertClose(channel.upper[4], expectedUpper, 1e-9, 'Donchian upper uses the previous N bars only');
  assert(
    candles[5].close > channel.upper[5],
    'a new high closes beyond the channel it is tested against'
  );

  const rsiResult = rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
  const lastRsi = last(rsiResult);
  assert(lastRsi === 100, 'RSI of a monotonically rising series is 100');

  const atrResult = atr(makeCandles([1.0, 1.001, 1.002, 1.003, 1.004, 1.005, 1.006]), 3);
  assert((last(atrResult) ?? 0) > 0, 'ATR is positive on a moving series');

  const bands = bollinger([10, 10, 10, 10, 10, 10], 5, 2);
  assertClose(bands.upper[5] - bands.lower[5], 0, 1e-9, 'Bollinger bands collapse on a constant series');
}

// ═══════════════════════════════════════════════════════════════════════════
function testTime(): void {
  section('Time and sessions');

  // 23:30 UTC on 6 March is already 7 March in Prague (UTC+1).
  const lateNight = Date.UTC(2026, 2, 6, 23, 30);
  assert(
    brokerDayKey(lateNight, 'Europe/Prague') === '2026-03-07',
    'broker day rolls over at Prague midnight, not UTC midnight'
  );
  assert(
    brokerDayKey(lateNight, 'UTC') === '2026-03-06',
    'the same instant is still the previous day in UTC'
  );

  assert(isMarketClosed(Date.UTC(2026, 2, 7, 12, 0)), 'Saturday counts as market closed');
  assert(!isMarketClosed(Date.UTC(2026, 2, 4, 12, 0)), 'Wednesday midday is open');
  assert(isMarketClosed(Date.UTC(2026, 2, 6, 22, 0)), 'Friday after 21:00 UTC is closed');

  assert(
    isWeekendFlatWindow(Date.UTC(2026, 2, 6, 20, 30)),
    'the pre-weekend flat window is active an hour before the Friday close'
  );
  assert(
    !isWeekendFlatWindow(Date.UTC(2026, 2, 6, 12, 0)),
    'Friday midday is not yet inside the flat window'
  );

  const m15 = makeCandles([1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]);
  const h1 = resample(m15, 'H1');
  assert(h1.length === 2, 'eight M15 bars resample into two H1 bars');
  assertClose(h1[0].open, m15[0].open, 1e-9, 'resampled open comes from the first bar in the bucket');
  assertClose(h1[0].close, m15[3].close, 1e-9, 'resampled close comes from the last bar in the bucket');
  assertClose(h1[0].high, Math.max(...m15.slice(0, 4).map((c) => c.high)), 1e-9, 'resampled high is the bucket max');
}

// ═══════════════════════════════════════════════════════════════════════════
function testSizing(): void {
  section('Position sizing');

  const converter = new CurrencyConverter('USD');
  const spec = getSpec('EURUSD');

  // 0.25 % of 100k = 250 USD budget, 20 pip stop.
  const result = computePositionSize({
    equity: 100_000,
    riskPct: 0.25,
    stopDistance: 0.0020,
    spec,
    converter
  });

  assert(result.ok, 'a normal trade produces a valid size');
  const actualLoss = result.volume * 0.0020 * 100_000 + result.volume * spec.commissionPerLot;
  assert(actualLoss <= 250 + 1e-6, `realised loss ${actualLoss.toFixed(2)} never exceeds the 250 budget`);
  assert(actualLoss > 200, 'the budget is actually used rather than being wildly under-sized');
  assert(result.commission > 0, 'commission is included in the risk calculation');

  // Never size above the budget when the stop is very tight.
  const tight = computePositionSize({ equity: 100_000, riskPct: 0.25, stopDistance: 0.0002, spec, converter });
  const tightLoss = tight.volume * 0.0002 * 100_000 + tight.volume * spec.commissionPerLot;
  assert(tightLoss <= 250 + 1e-6, 'a tight stop does not blow through the risk budget');

  // A tiny account cannot afford the minimum lot – the trade must be refused.
  const tooSmall = computePositionSize({ equity: 300, riskPct: 0.25, stopDistance: 0.0050, spec, converter });
  assert(!tooSmall.ok, 'a trade that cannot be sized within budget is rejected, not rounded up');
  assert(tooSmall.volume === 0, 'a rejected sizing returns zero volume');

  assert(!computePositionSize({ equity: 100_000, riskPct: 0.25, stopDistance: 0, spec, converter }).ok,
    'a zero stop distance is rejected');
  assert(!computePositionSize({ equity: -1, riskPct: 0.25, stopDistance: 0.002, spec, converter }).ok,
    'a non-positive equity is rejected');

  assertClose(roundLots(0.3799, spec), 0.37, 1e-9, 'lot sizes round down to the broker lot step');
  assert(roundLots(1.005, spec) === 1.0, 'lot rounding does not leak binary float noise');

  // Gold carries riskWeight 0.7, so the same nominal risk yields less exposure.
  const gold = getSpec('XAUUSD');
  const goldSize = computePositionSize({ equity: 100_000, riskPct: 0.25, stopDistance: 5, spec: gold, converter });
  const goldLoss = goldSize.volume * 5 * 100 + goldSize.volume * gold.commissionPerLot;
  assert(goldLoss <= 250 * 0.7 + 1e-6, 'instrument risk weighting reduces size on volatile symbols');

  // A stop already in profit must contribute zero open risk, not negative risk.
  const lockedIn = openRiskOf('buy', 1, 1.1000, 1.1050, spec, converter);
  assert(lockedIn === 0, 'a stop beyond entry contributes no open risk');
  const stillExposed = openRiskOf('buy', 1, 1.1000, 1.0980, spec, converter);
  assertClose(stillExposed, 0.0020 * 100_000 + spec.commissionPerLot, 1e-6, 'open risk equals distance × value + commission');
}

// ═══════════════════════════════════════════════════════════════════════════
function makeRiskManager(overrides: Partial<BotConfig['risk']> = {}) {
  const converter = new CurrencyConverter('USD');
  const config = testConfig();
  const risk = new RiskManager({
    rules: config.rules,
    config: { ...config.risk, ...overrides },
    converter
  });
  risk.setSpecResolver((symbol) => {
    try {
      return getSpec(symbol);
    } catch {
      return undefined;
    }
  });
  return { risk, converter };
}

function makeIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    symbol: 'EURUSD',
    side: 'buy',
    volume: 0.5,
    entryPrice: 1.1,
    stopLoss: 1.098,
    spec: getSpec('EURUSD'),
    riskAmount: 250,
    atr: 0.0015,
    spreadPips: 0.6,
    // Tuesday 13:00 UTC – inside the London/NY overlap, far from any boundary.
    now: Date.UTC(2026, 2, 10, 13, 0),
    ...overrides
  };
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'p1',
    symbol: 'EURUSD',
    side: 'buy',
    volume: 0.5,
    entryPrice: 1.1,
    stopLoss: 1.098,
    openedAt: Date.UTC(2026, 2, 10, 12, 0),
    strategy: 'trend-breakout',
    initialRiskPrice: 0.002,
    riskAmount: 250,
    breakEvenDone: false,
    partialDone: false,
    trailAnchor: 1.1,
    ...overrides
  };
}

function testRiskGates(): void {
  section('Risk manager – pre-trade gates');

  const { risk } = makeRiskManager();
  const account = snapshot(100_000);
  risk.syncDay(account);

  assert(
    risk.evaluateOrder(makeIntent(), [], account).verdict === 'allow',
    'a normal trade inside all limits is allowed'
  );

  // --- Session and market gates ---
  assert(
    risk.evaluateOrder(makeIntent({ now: Date.UTC(2026, 2, 7, 12, 0) }), [], account).rule === 'market-closed',
    'trading is blocked when the market is closed'
  );
  assert(
    risk.evaluateOrder(makeIntent({ now: Date.UTC(2026, 2, 6, 20, 0) }), [], account).rule === 'weekend-flat',
    'entries are blocked in the pre-weekend window on a non-swing account'
  );
  assert(
    risk.evaluateOrder(makeIntent({ now: Date.UTC(2026, 2, 10, 3, 0) }), [], account).rule ===
      'outside-trading-hours',
    'entries outside the instrument trading hours are blocked'
  );

  // --- Execution quality ---
  assert(
    risk.evaluateOrder(makeIntent({ spreadPips: 5 }), [], account).rule === 'spread-too-wide',
    'a spread beyond the instrument limit blocks the trade'
  );
  assert(
    risk.evaluateOrder(makeIntent({ stopLoss: 1.1 }), [], account).rule === 'invalid-stop',
    'a stop equal to the entry is rejected'
  );
  assert(
    risk.evaluateOrder(makeIntent({ stopLoss: 1.0999, atr: 0.0015 }), [], account).rule === 'stop-too-tight',
    'a stop far inside the ATR noise band is rejected'
  );
  assert(
    risk.evaluateOrder(makeIntent({ stopLoss: 1.08, atr: 0.0015 }), [], account).rule === 'stop-too-wide',
    'an absurdly wide stop is rejected'
  );

  // --- Exposure gates ---
  const existing = makePosition();
  assert(
    risk.evaluateOrder(makeIntent(), [existing], account).rule === 'max-positions-per-symbol',
    'a second position in the same symbol is blocked'
  );
  assert(
    risk.evaluateOrder(makeIntent({ symbol: 'GBPUSD', spec: getSpec('GBPUSD'), entryPrice: 1.27, stopLoss: 1.268 }),
      [existing, makePosition({ id: 'p2', symbol: 'USDCHF' }), makePosition({ id: 'p3', symbol: 'USDJPY' })],
      account
    ).rule === 'max-positions',
    'the concurrent position limit is enforced'
  );

  // Correlation: EURUSD + GBPUSD + AUDUSD are all short USD.
  // 1.2 lots over a 20 pip stop is ~250 USD of live risk per position, which
  // is what the risk manager measures – the stored riskAmount is not trusted.
  const usdCluster = [
    makePosition({ id: 'c1', symbol: 'EURUSD', volume: 1.2, riskAmount: 250 }),
    makePosition({ id: 'c2', symbol: 'GBPUSD', volume: 1.2, riskAmount: 250, entryPrice: 1.27, stopLoss: 1.268 })
  ];
  const correlated = risk.evaluateOrder(
    makeIntent({ symbol: 'AUDUSD', spec: getSpec('AUDUSD'), entryPrice: 0.66, stopLoss: 0.658, riskAmount: 400 }),
    usdCluster,
    account
  );
  assert(
    correlated.rule === 'correlation-risk-cap' || correlated.rule === 'aggregate-risk-cap',
    `stacking correlated USD exposure is blocked (rule: ${correlated.rule})`
  );
}

function testRiskFloors(): void {
  section('Risk manager – drawdown floors');

  const { risk } = makeRiskManager();
  const dayStart = snapshot(100_000);
  risk.syncDay(dayStart);

  const levels = risk.levels();
  assertClose(levels.ftmoDailyFloor, 95_000, 0.01, 'the FTMO daily floor is 5% below the day-start balance');
  assertClose(levels.ftmoTotalFloor, 90_000, 0.01, 'the FTMO total floor is 10% below the initial balance');
  assertClose(levels.internalDailyHardFloor, 97_500, 0.01, 'the internal daily floor sits at 2.5%');
  assert(
    levels.internalDailyHardFloor > levels.ftmoDailyFloor,
    'the internal daily floor is always reached before the FTMO one'
  );

  // The structural guarantee: a trade that could take the worst case to the
  // floor must be refused even though nothing has been lost yet.
  //
  // At 98,300 equity the floor is 97,500 and the buffer is 491.50, so any
  // trade risking more than ~308 is refused – while still passing the symbol
  // cap (491.50) and the aggregate cap (983). That isolates the worst-case
  // rule from the exposure caps, which would otherwise fire first.
  const nearFloor = snapshot(98_300);
  risk.observe(nearFloor);
  const decision = risk.evaluateOrder(makeIntent({ riskAmount: 400 }), [], nearFloor);
  assert(
    decision.verdict === 'reject' && decision.rule === 'worst-case-floor',
    `the worst-case check refuses a trade that could breach the daily floor (rule: ${decision.rule})`
  );

  // Same account, a smaller trade that keeps the worst case clear, is fine.
  const small = risk.evaluateOrder(makeIntent({ riskAmount: 100 }), [], nearFloor);
  assert(
    small.verdict === 'allow',
    `a small enough trade is still allowed at the same equity (rule: ${small.rule})`
  );

  // Soft stop: existing positions are kept, no new ones are opened.
  const softBreach = risk.monitor(snapshot(98_400), [makePosition()]);
  assert(
    softBreach.type === 'halt-new-trades' && softBreach.rule === 'daily-soft-stop',
    `crossing the daily soft stop halts new trades (got ${softBreach.type}/${softBreach.rule})`
  );

  // Hard stop: everything is closed immediately.
  const hardBreach = risk.monitor(snapshot(97_400), [makePosition()]);
  assert(
    hardBreach.type === 'flatten-all' && hardBreach.rule === 'daily-hard-stop',
    `crossing the daily hard stop flattens the book (got ${hardBreach.type}/${hardBreach.rule})`
  );
  assert(
    97_400 > risk.levels().ftmoDailyFloor,
    'the hard stop fires while still comfortably above the FTMO floor'
  );

  // Total drawdown: kill switch, and it must survive a new day.
  const { risk: risk2 } = makeRiskManager();
  risk2.syncDay(snapshot(100_000));
  const killed = risk2.monitor(snapshot(93_500), []);
  assert(killed.type === 'kill-switch', 'breaching the internal total floor engages the kill switch');
  assert(risk2.state.killSwitch, 'the kill switch is recorded in the persisted state');

  risk2.syncDay({ ...snapshot(93_500), time: Date.UTC(2026, 2, 11, 13, 0) });
  assert(risk2.state.killSwitch, 'a new trading day does NOT clear the kill switch');
  assert(
    risk2.evaluateOrder(makeIntent(), [], snapshot(93_500)).rule === 'kill-switch',
    'no order is accepted while the kill switch is engaged'
  );
  risk2.releaseKillSwitch();
  assert(!risk2.state.killSwitch, 'the kill switch can only be cleared explicitly');
}

function testRiskCounters(): void {
  section('Risk manager – counters and day rollover');

  const { risk } = makeRiskManager({ maxTradesPerDay: 2, maxConsecutiveLosses: 2, lossStreakCooldownMinutes: 60 });
  const account = snapshot(100_000);
  risk.syncDay(account);

  risk.registerOpen(makePosition());
  risk.registerOpen(makePosition({ id: 'p2' }));
  assert(
    risk.evaluateOrder(makeIntent(), [], account).rule === 'max-trades-per-day',
    'the daily trade limit blocks further entries'
  );

  // A new broker day resets the daily counters.
  risk.syncDay({ ...account, time: Date.UTC(2026, 2, 11, 13, 0) });
  assert(risk.state.tradesToday === 0, 'the daily trade counter resets on a new broker day');
  assert(risk.state.dayStartBalance === 100_000, 'the day-start balance is re-anchored on rollover');

  // Two losses in a row trigger the cool-down.
  const loss = (id: string, at: number): ClosedTrade => ({
    id,
    symbol: 'EURUSD',
    side: 'buy',
    volume: 0.5,
    strategy: 'trend-breakout',
    entryPrice: 1.1,
    closePrice: 1.098,
    openedAt: at - 3_600_000,
    closedAt: at,
    grossPnl: -100,
    commission: 3.5,
    swap: 0,
    netPnl: -103.5,
    rMultiple: -1,
    reason: 'stop-loss'
  });

  const now = Date.UTC(2026, 2, 11, 13, 0);
  risk.registerClose(loss('l1', now));
  risk.registerClose(loss('l2', now));
  assert(risk.state.haltedUntil > now, 'a losing streak triggers a cool-down');
  assert(
    risk.evaluateOrder(makeIntent({ now: now + 60_000 }), [], account).rule === 'cooldown',
    'no trades are accepted during the cool-down'
  );
  assert(
    risk.evaluateOrder(makeIntent({ now: now + 61 * 60_000 }), [], account).verdict === 'allow',
    'trading resumes once the cool-down expires'
  );

  // A partial close is a leg of one idea, not an independent loser.
  const { risk: risk3 } = makeRiskManager({ maxConsecutiveLosses: 2 });
  risk3.syncDay(account);
  risk3.registerClose({ ...loss('pl', now), reason: 'partial', netPnl: -5 });
  assert(risk3.state.consecutiveLosses === 0, 'a partial close does not count towards the losing streak');

  // Profit target lock.
  const { risk: risk4 } = makeRiskManager();
  risk4.syncDay(account);
  const atTarget = risk4.monitor(snapshot(110_500), []);
  assert(
    atTarget.rule === 'profit-target-lock',
    `reaching the profit target stops new risk (got ${atTarget.rule})`
  );
  assert(
    risk4.evaluateOrder(makeIntent(), [], snapshot(110_500)).rule === 'profit-target-lock',
    'no further trades are opened once the target is locked in'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function testConfigValidation(): void {
  section('Configuration validation');

  assert(
    (() => {
      try {
        validateConfig(testConfig());
        return true;
      } catch {
        return false;
      }
    })(),
    'the shipped conservative configuration validates'
  );

  const tooLoose = testConfig({
    risk: { ...RISK_PRESETS.conservative, dailyHardStopPct: 5 }
  });
  assert(
    (() => {
      try {
        validateConfig(tooLoose);
        return false;
      } catch {
        return true;
      }
    })(),
    'an internal daily stop equal to the FTMO limit is rejected'
  );

  const overSized = testConfig({
    risk: { ...RISK_PRESETS.conservative, riskPerTradePct: 5, maxRiskPerSymbolPct: 5 }
  });
  assert(
    (() => {
      try {
        validateConfig(overSized);
        return false;
      } catch {
        return true;
      }
    })(),
    'a 5% per-trade risk is rejected outright'
  );

  const stackedRisk = testConfig({
    risk: { ...RISK_PRESETS.conservative, maxAggregateRiskPct: 3, dailyHardStopPct: 2.5 }
  });
  assert(
    (() => {
      try {
        validateConfig(stackedRisk);
        return false;
      } catch {
        return true;
      }
    })(),
    'aggregate open risk above the daily stop is rejected'
  );

  // Every preset must be internally consistent against every phase.
  let presetsValid = true;
  for (const [presetName, preset] of Object.entries(RISK_PRESETS)) {
    for (const phase of Object.keys(FTMO_PRESETS) as Array<keyof typeof FTMO_PRESETS>) {
      try {
        validateConfig(
          testConfig({ risk: preset, rules: { ...FTMO_PRESETS[phase], accountSize: 100_000, currency: 'USD' } })
        );
      } catch (error: any) {
        presetsValid = false;
        console.error(`   preset ${presetName} / phase ${phase}: ${error.message}`);
      }
    }
  }
  assert(presetsValid, 'every shipped risk preset validates against every FTMO phase');

  // Environment loading must not silently produce a live-trading default.
  const fromEnv = loadConfig();
  assert(fromEnv.broker === 'paper', 'the default broker is paper – running the bot cannot place real orders');
}

// ═══════════════════════════════════════════════════════════════════════════
async function testPaperBroker(): Promise<void> {
  section('Paper broker');

  const converter = new CurrencyConverter('USD');
  const broker = new PaperBroker({ startingBalance: 100_000, currency: 'USD', converter, slippagePips: 0 });

  const base = Date.UTC(2026, 2, 10, 13, 0);
  broker.syncCandle('EURUSD', { time: base, open: 1.1, high: 1.1005, low: 1.0995, close: 1.1, volume: 100 });

  const position = await broker.placeMarketOrder({
    symbol: 'EURUSD',
    side: 'buy',
    volume: 1,
    stopLoss: 1.098,
    takeProfit: 1.104,
    strategy: 'test',
    initialRiskPrice: 0.002,
    riskAmount: 200
  });

  assert(position.entryPrice > 1.1, 'a buy fills at the ask, not the mid');
  const afterOpen = await broker.getAccount();
  assertClose(afterOpen.balance, 100_000 - 3.5, 0.01, 'the entry commission leg is charged on open');

  // A stop on the wrong side of the fill must be refused.
  let wrongSideRejected = false;
  try {
    await broker.placeMarketOrder({
      symbol: 'GBPUSD',
      side: 'buy',
      volume: 1,
      stopLoss: 2.0,
      strategy: 'test',
      initialRiskPrice: 0.002,
      riskAmount: 200
    });
  } catch {
    wrongSideRejected = true;
  }
  assert(wrongSideRejected, 'a stop on the wrong side of the entry is refused');

  // A bar that spans both stop and target must resolve as the stop.
  const filled = broker.syncCandle('EURUSD', {
    time: base + 900_000,
    open: 1.1,
    high: 1.105,
    low: 1.097,
    close: 1.1,
    volume: 100
  });
  assert(filled.length === 1, 'the ambiguous bar closes exactly one position');
  assert(
    filled[0].reason === 'stop-loss',
    'when a bar contains both the stop and the target, the stop is assumed first'
  );
  assert(filled[0].netPnl < 0, 'the stop-out is booked as a loss');
  assertClose(filled[0].rMultiple, -1, 0.15, 'a stop-out is approximately -1R');

  const final = await broker.getAccount();
  assert(final.balance < 100_000, 'the loss is reflected in the balance');
  assert((await broker.getPositions()).length === 0, 'the position is removed after the stop-out');
}

// ═══════════════════════════════════════════════════════════════════════════
async function testEndToEnd(): Promise<void> {
  section('End-to-end backtest');

  const config = testConfig({ symbols: ['EURUSD', 'GBPUSD'], dataDir: 'data/bot-test' });
  validateConfig(config);

  const data: Record<string, Candle[]> = {};
  for (const symbol of config.symbols) {
    data[symbol] = generateSeries({
      symbol,
      bars: 9_000,
      timeframe: 'M15',
      startPrice: startPriceFor(symbol),
      seed: 4242
    });
  }

  // Reproducibility is a precondition for comparing strategies at all: a
  // series anchored to the wall clock shifts its weekday alignment between
  // runs, which silently changes every session filter.
  const repeat = generateSeries({
    symbol: 'EURUSD',
    bars: 500,
    timeframe: 'M15',
    startPrice: startPriceFor('EURUSD'),
    seed: 4242
  });
  assert(
    repeat.length === data.EURUSD.slice(0, repeat.length).length &&
      repeat.every((c, i) => c.time === data.EURUSD[i].time && c.close === data.EURUSD[i].close),
    'the same seed produces an identical series on every run'
  );

  const result = await runBacktest({ config, data, warmupBars: 250 });
  const { metrics } = result;

  assert(metrics.totalTrades > 0, `the engine actually traded (${metrics.totalTrades} trades)`);
  assert(
    !metrics.ftmo.dailyLimitBreached,
    `the 5% daily limit was never breached (worst day: ${metrics.ftmo.worstDayPct.toFixed(2)}%)`
  );
  assert(
    !metrics.ftmo.totalLimitBreached,
    `the 10% max loss was never breached (max DD: ${metrics.ftmo.maxTotalDrawdownPct.toFixed(2)}%)`
  );
  assert(
    metrics.ftmo.worstDayPct < config.risk.dailyHardStopPct + 1.0,
    `the worst day (${metrics.ftmo.worstDayPct.toFixed(2)}%) stayed near the internal ${config.risk.dailyHardStopPct}% stop`
  );

  // Every individual trade must have respected the per-trade risk budget.
  const maxRiskPerTrade = config.rules.accountSize * (config.risk.riskPerTradePct / 100);
  const worstLoss = Math.min(0, ...result.trades.map((t) => t.netPnl));
  assert(
    Math.abs(worstLoss) < maxRiskPerTrade * 2.5,
    `the worst single loss (${worstLoss.toFixed(2)}) stayed within a sane multiple of the ` +
      `${maxRiskPerTrade.toFixed(0)} per-trade budget`
  );

  // Costs must actually be modelled – a backtest with zero costs is fiction.
  assert(metrics.totalCommission > 0, 'commission is charged in the simulation');

  // Books must balance: the journal is the only record a prop trader has, so
  // a per-trade PnL that does not reconcile with the account is a real bug.
  const journalSum = result.trades.reduce((sum, t) => sum + t.netPnl, 0);
  assertClose(
    journalSum,
    metrics.netProfit,
    Math.max(1, Math.abs(metrics.netProfit) * 0.001),
    'the summed trade journal reconciles with the account net profit'
  );

  const strategySum = Object.values(metrics.byStrategy).reduce((sum, s) => sum + s.netPnl, 0);
  assertClose(
    strategySum,
    metrics.netProfit,
    Math.max(1, Math.abs(metrics.netProfit) * 0.001),
    'the per-strategy breakdown adds up to the account net profit'
  );

  console.log(`   ${metrics.totalTrades} trades · ${metrics.netProfitPct}% net · ` +
    `${metrics.maxDrawdownPct}% max DD · PF ${metrics.profitFactor} · worst day ${metrics.ftmo.worstDayPct.toFixed(2)}%`);
}

// ═══════════════════════════════════════════════════════════════════════════
function testMetrics(): void {
  section('Metrics');

  const rules = { ...FTMO_PRESETS.challenge, accountSize: 100_000, currency: 'USD' };
  const day1 = Date.UTC(2026, 2, 10, 8, 0);
  const day2 = Date.UTC(2026, 2, 11, 8, 0);

  // A day that dipped 6% intraday and recovered still fails the account.
  const curve = [
    { time: day1, equity: 100_000, balance: 100_000 },
    { time: day1 + 3_600_000, equity: 94_000, balance: 94_000 },
    { time: day1 + 7_200_000, equity: 101_000, balance: 101_000 },
    { time: day2, equity: 101_000, balance: 101_000 }
  ];

  const metrics = computeMetrics(curve, [], rules);
  assert(
    metrics.ftmo.dailyLimitBreached,
    'an intraday dip beyond 5% is a breach even if the day closes green'
  );
  assert(!metrics.ftmo.passed, 'a breached account never counts as passed');

  // Partial closes must not inflate the win rate.
  const trades: ClosedTrade[] = [
    { id: '1', symbol: 'EURUSD', side: 'buy', volume: 0.5, strategy: 's', entryPrice: 1, closePrice: 1.01,
      openedAt: day1, closedAt: day1 + 1000, grossPnl: 100, commission: 3, swap: 0, netPnl: 97, rMultiple: 2, reason: 'partial' },
    { id: '1', symbol: 'EURUSD', side: 'buy', volume: 0.5, strategy: 's', entryPrice: 1, closePrice: 0.995,
      openedAt: day1, closedAt: day1 + 2000, grossPnl: -50, commission: 3, swap: 0, netPnl: -53, rMultiple: -1, reason: 'stop-loss' }
  ];
  const tradeMetrics = computeMetrics(curve, trades, rules);
  assert(tradeMetrics.totalTrades === 1, 'partial closes are not counted as separate trades');
  assert(tradeMetrics.winRatePct === 0, 'the win rate is not inflated by banked partials');
}

// ═══════════════════════════════════════════════════════════════════════════
async function runAll(): Promise<void> {
  console.log('🤖 FTMO Trading Bot – test suite\n');

  try {
    testIndicators();
    testTime();
    testSizing();
    testRiskGates();
    testRiskFloors();
    testRiskCounters();
    testConfigValidation();
    testMetrics();
    await testPaperBroker();
    await testEndToEnd();
  } catch (error: any) {
    testsFailed++;
    console.error(`\n💥 Suite crashed: ${error?.stack ?? error}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Tests run:    ${testsRun}`);
  console.log(`  Passed:       ${testsRun - testsFailed}`);
  console.log(`  Failed:       ${testsFailed}`);
  console.log('═══════════════════════════════════════════════════════');

  if (testsFailed > 0) {
    console.error('\nFailed tests:');
    for (const name of failures) console.error(`  - ${name}`);
    process.exit(1);
  }

  console.log('\n✅ All risk and execution guarantees verified.\n');
}

runAll();
