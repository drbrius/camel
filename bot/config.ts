/**
 * Configuration: FTMO rule presets, risk presets and environment loading.
 *
 * Design rule: the numbers FTMO publishes live in `FTMO_PRESETS`, the numbers
 * *we* trade with live in `RISK_PRESETS`. The internal limits are always
 * tighter than the firm's limits so that a breach of our own rules happens
 * long before a breach of theirs.
 */

import { TIMEFRAME_MINUTES, type FtmoPhase, type FtmoRuleSet, type RiskConfig, type Timeframe } from './types';

/**
 * Higher-timeframe bars the regime filter needs. The longest higher-timeframe
 * indicator in the bundled strategies is an EMA(50); 70 leaves warm-up room.
 */
const MIN_HIGHER_TIMEFRAME_BARS = 70;

export interface BotConfig {
  /** Broker implementation to use. */
  broker: 'paper' | 'metaapi';
  /** Market data source. */
  feed: 'synthetic' | 'csv' | 'metaapi';
  symbols: string[];
  primaryTimeframe: Timeframe;
  higherTimeframe: Timeframe;
  /** Seconds between engine iterations in live mode. */
  loopIntervalSeconds: number;
  /** Number of candles kept in memory per symbol/timeframe. */
  historyBars: number;
  rules: FtmoRuleSet;
  risk: RiskConfig;
  /** Strategy ids to enable. */
  strategies: string[];
  /** Directory for state, logs and trade journal. */
  dataDir: string;
  /** When true, no orders are sent – decisions are logged only. */
  dryRun: boolean;
  metaapi: {
    token: string;
    accountId: string;
    region: string;
  };
}

/**
 * Official FTMO limits per phase.
 *
 * Verified against FTMO's published rules for the standard (non-swing)
 * evaluation. Re-check these before every new account – prop firms change
 * their terms and the bot must never be looser than the live contract.
 */
export const FTMO_PRESETS: Record<FtmoPhase, Omit<FtmoRuleSet, 'accountSize' | 'currency'>> = {
  challenge: {
    phase: 'challenge',
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    maxLossIsTrailing: false,
    minTradingDays: 0,
    dailyResetTimeZone: 'Europe/Prague',
    holdOverWeekend: false,
    holdOverNews: false,
    newsBufferMinutes: 2
  },
  verification: {
    phase: 'verification',
    profitTargetPct: 5,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    maxLossIsTrailing: false,
    minTradingDays: 0,
    dailyResetTimeZone: 'Europe/Prague',
    holdOverWeekend: false,
    holdOverNews: false,
    newsBufferMinutes: 2
  },
  funded: {
    phase: 'funded',
    profitTargetPct: 0,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    maxLossIsTrailing: false,
    minTradingDays: 0,
    dailyResetTimeZone: 'Europe/Prague',
    holdOverWeekend: false,
    holdOverNews: false,
    newsBufferMinutes: 2
  }
};

const CORRELATION_GROUPS: Record<string, string[]> = {
  usd: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCHF', 'USDCAD'],
  eur: ['EURUSD', 'EURJPY', 'EURGBP', 'EURCHF', 'EURAUD'],
  gbp: ['GBPUSD', 'GBPJPY', 'EURGBP'],
  jpy: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY'],
  metals: ['XAUUSD', 'XAGUSD'],
  indices: ['US30', 'US100', 'GER40', 'SPX500']
};

/**
 * Risk presets.
 *
 * `conservative` is the default and the only preset recommended for a real
 * challenge: 0.25 % per trade means ~20 consecutive losers before the FTMO
 * max loss is even approached, and the daily hard stop fires at 2.5 %, i.e.
 * half the firm's limit.
 */
export const RISK_PRESETS: Record<'conservative' | 'balanced' | 'aggressive', RiskConfig> = {
  conservative: {
    riskPerTradePct: 0.25,
    maxRiskPerSymbolPct: 0.5,
    maxRiskPerGroupPct: 0.75,
    maxAggregateRiskPct: 1.0,
    maxConcurrentPositions: 3,
    maxPositionsPerSymbol: 1,
    maxTradesPerDay: 6,
    dailySoftStopPct: 1.5,
    dailyHardStopPct: 2.5,
    totalSoftStopPct: 5,
    totalHardStopPct: 6,
    maxConsecutiveLosses: 3,
    lossStreakCooldownMinutes: 240,
    minStopAtrMultiple: 0.75,
    maxStopAtrMultiple: 4,
    lockInProfitTarget: true,
    worstCaseBufferPct: 0.5,
    correlationGroups: CORRELATION_GROUPS
  },
  balanced: {
    riskPerTradePct: 0.4,
    maxRiskPerSymbolPct: 0.8,
    maxRiskPerGroupPct: 1.2,
    maxAggregateRiskPct: 1.6,
    maxConcurrentPositions: 4,
    maxPositionsPerSymbol: 1,
    maxTradesPerDay: 8,
    dailySoftStopPct: 2,
    dailyHardStopPct: 3,
    totalSoftStopPct: 6,
    totalHardStopPct: 7,
    maxConsecutiveLosses: 4,
    lossStreakCooldownMinutes: 180,
    minStopAtrMultiple: 0.75,
    maxStopAtrMultiple: 4,
    lockInProfitTarget: true,
    worstCaseBufferPct: 0.5,
    correlationGroups: CORRELATION_GROUPS
  },
  aggressive: {
    riskPerTradePct: 0.6,
    maxRiskPerSymbolPct: 1.2,
    maxRiskPerGroupPct: 1.8,
    maxAggregateRiskPct: 2.4,
    maxConcurrentPositions: 5,
    maxPositionsPerSymbol: 1,
    maxTradesPerDay: 10,
    dailySoftStopPct: 2.5,
    dailyHardStopPct: 3.5,
    totalSoftStopPct: 6.5,
    totalHardStopPct: 7.5,
    maxConsecutiveLosses: 4,
    lossStreakCooldownMinutes: 120,
    minStopAtrMultiple: 0.6,
    maxStopAtrMultiple: 4.5,
    lockInProfitTarget: true,
    worstCaseBufferPct: 0.5,
    correlationGroups: CORRELATION_GROUPS
  }
};

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

/**
 * Validates that our internal limits are strictly tighter than the prop firm's.
 * Throws on misconfiguration – a bot that can breach the firm's rules must not
 * be allowed to start.
 */
export function validateConfig(config: BotConfig): void {
  const errors: string[] = [];
  const { risk, rules } = config;

  if (risk.dailyHardStopPct >= rules.maxDailyLossPct) {
    errors.push(
      `dailyHardStopPct (${risk.dailyHardStopPct}%) must be below the FTMO daily limit (${rules.maxDailyLossPct}%)`
    );
  }
  if (risk.dailySoftStopPct > risk.dailyHardStopPct) {
    errors.push('dailySoftStopPct must not exceed dailyHardStopPct');
  }
  if (risk.totalHardStopPct >= rules.maxTotalLossPct) {
    errors.push(
      `totalHardStopPct (${risk.totalHardStopPct}%) must be below the FTMO max loss (${rules.maxTotalLossPct}%)`
    );
  }
  if (risk.totalSoftStopPct > risk.totalHardStopPct) {
    errors.push('totalSoftStopPct must not exceed totalHardStopPct');
  }
  if (risk.maxAggregateRiskPct >= risk.dailyHardStopPct) {
    errors.push(
      `maxAggregateRiskPct (${risk.maxAggregateRiskPct}%) must stay below dailyHardStopPct (${risk.dailyHardStopPct}%) ` +
        'so that simultaneous stop-outs cannot breach the daily stop'
    );
  }
  if (risk.riskPerTradePct <= 0 || risk.riskPerTradePct > 2) {
    errors.push('riskPerTradePct must be within (0, 2] – anything larger cannot survive a normal losing streak');
  }
  if (risk.maxRiskPerSymbolPct < risk.riskPerTradePct) {
    errors.push('maxRiskPerSymbolPct must be at least riskPerTradePct');
  }
  if (config.symbols.length === 0) {
    errors.push('at least one symbol must be configured');
  }

  // The higher-timeframe regime filter is built by resampling the primary
  // series. Too little history means it never warms up, and a filter that
  // always returns "no opinion" blocks every entry without saying so.
  const higherBars =
    (config.historyBars * TIMEFRAME_MINUTES[config.primaryTimeframe]) /
    TIMEFRAME_MINUTES[config.higherTimeframe];
  if (higherBars < MIN_HIGHER_TIMEFRAME_BARS) {
    errors.push(
      `historyBars=${config.historyBars} only yields ${Math.floor(higherBars)} ${config.higherTimeframe} bars; ` +
        `at least ${MIN_HIGHER_TIMEFRAME_BARS} are needed for the regime filter to warm up`
    );
  }
  if (config.broker === 'metaapi' && (!config.metaapi.token || !config.metaapi.accountId)) {
    errors.push('broker=metaapi requires METAAPI_TOKEN and METAAPI_ACCOUNT_ID');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid bot configuration:\n  - ${errors.join('\n  - ')}`);
  }
}

/** Builds the runtime configuration from environment variables plus defaults. */
export function loadConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  const phase = str('FTMO_PHASE', 'challenge') as FtmoPhase;
  const preset = FTMO_PRESETS[phase] ?? FTMO_PRESETS.challenge;
  const riskProfile = str('RISK_PROFILE', 'conservative') as keyof typeof RISK_PRESETS;
  const riskPreset = RISK_PRESETS[riskProfile] ?? RISK_PRESETS.conservative;

  const config: BotConfig = {
    broker: str('BOT_BROKER', 'paper') as BotConfig['broker'],
    feed: str('BOT_FEED', 'synthetic') as BotConfig['feed'],
    symbols: str('BOT_SYMBOLS', 'EURUSD,GBPUSD,XAUUSD')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    primaryTimeframe: str('BOT_TIMEFRAME', 'M15') as Timeframe,
    higherTimeframe: str('BOT_HIGHER_TIMEFRAME', 'H4') as Timeframe,
    loopIntervalSeconds: num('BOT_LOOP_SECONDS', 30),
    // Must cover the *higher* timeframe's warm-up, not the entry timeframe's:
    // an H4 EMA(50) needs 50 × 16 = 800 M15 bars before it produces a value,
    // and a filter that never produces a value silently blocks every trade.
    historyBars: num('BOT_HISTORY_BARS', 1_500),
    rules: {
      ...preset,
      accountSize: num('FTMO_ACCOUNT_SIZE', 100_000),
      currency: str('FTMO_CURRENCY', 'USD'),
      holdOverWeekend: bool('FTMO_SWING_ACCOUNT', false),
      holdOverNews: bool('FTMO_SWING_ACCOUNT', false)
    },
    risk: {
      ...riskPreset,
      riskPerTradePct: num('RISK_PER_TRADE_PCT', riskPreset.riskPerTradePct),
      maxTradesPerDay: num('RISK_MAX_TRADES_PER_DAY', riskPreset.maxTradesPerDay),
      maxConcurrentPositions: num('RISK_MAX_POSITIONS', riskPreset.maxConcurrentPositions)
    },
    strategies: str('BOT_STRATEGIES', 'trend-breakout,mean-reversion')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dataDir: str('BOT_DATA_DIR', 'data/bot'),
    dryRun: bool('BOT_DRY_RUN', false),
    metaapi: {
      token: str('METAAPI_TOKEN', ''),
      accountId: str('METAAPI_ACCOUNT_ID', ''),
      region: str('METAAPI_REGION', 'new-york')
    },
    ...overrides
  };

  return config;
}
