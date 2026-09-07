/**
 * Core domain types for the FTMO-compatible trading bot.
 *
 * Everything here is broker-agnostic: the same types are used by the
 * backtester, the paper broker and the live MetaApi/MT5 adapter.
 */

export type Side = 'buy' | 'sell';

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

/** Minutes per timeframe – used for resampling and warm-up calculations. */
export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440
};

export interface Candle {
  /** Bar open time, epoch milliseconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  time: number;
  bid: number;
  ask: number;
}

export interface InstrumentSpec {
  symbol: string;
  /** Price decimals as quoted by the broker (e.g. 5 for EURUSD, 3 for USDJPY). */
  digits: number;
  /** Price movement of one pip (0.0001 for most FX pairs, 0.01 for JPY pairs). */
  pipSize: number;
  /** Units of base currency in 1.00 lot. */
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  /** Round-turn commission per lot in account currency. */
  commissionPerLot: number;
  /** Spread we expect under normal conditions, in pips. */
  typicalSpreadPips: number;
  /** Hard veto: never open a trade when the spread exceeds this, in pips. */
  maxSpreadPips: number;
  /** Currency the instrument is quoted in – used for PnL conversion. */
  quoteCurrency: string;
  /** UTC hour window in which the instrument may be traded (inclusive start, exclusive end). */
  tradingHoursUtc: { from: number; to: number };
  /** Optional multiplier for how aggressively this symbol may be sized. */
  riskWeight: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  /** Position size in lots. */
  volume: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  openedAt: number;
  strategy: string;
  /** Absolute price distance between entry and the *initial* stop (defines 1R). */
  initialRiskPrice: number;
  /** Money at risk in account currency when the position was opened. */
  riskAmount: number;
  breakEvenDone: boolean;
  partialDone: boolean;
  /** Best price seen since entry – anchor for the trailing stop. */
  trailAnchor: number;
  comment?: string;
}

export type CloseReason =
  | 'stop-loss'
  | 'take-profit'
  | 'trailing-stop'
  | 'strategy-exit'
  | 'partial'
  | 'risk-halt'
  | 'weekend-flat'
  | 'news-flat'
  | 'session-flat'
  | 'manual'
  | 'shutdown';

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: Side;
  volume: number;
  strategy: string;
  entryPrice: number;
  closePrice: number;
  openedAt: number;
  closedAt: number;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  /** Profit expressed in multiples of the initial risk. */
  rMultiple: number;
  reason: CloseReason;
}

export interface AccountSnapshot {
  time: number;
  balance: number;
  equity: number;
  marginUsed: number;
  marginFree: number;
  currency: string;
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  volume: number;
  stopLoss: number;
  takeProfit?: number;
  strategy: string;
  /** Absolute price distance to the stop – kept so 1R survives stop moves. */
  initialRiskPrice: number;
  riskAmount: number;
  comment?: string;
}

/** Phase of the FTMO journey the bot is currently running against. */
export type FtmoPhase = 'challenge' | 'verification' | 'funded';

export interface FtmoRuleSet {
  phase: FtmoPhase;
  /** Starting balance of the evaluation account. */
  accountSize: number;
  currency: string;
  /** Profit target in percent of the account size. 0 = no target (funded). */
  profitTargetPct: number;
  /** FTMO maximum daily loss, percent of the day-start balance. */
  maxDailyLossPct: number;
  /** FTMO maximum overall loss, percent of the initial balance (static for FTMO). */
  maxTotalLossPct: number;
  /**
   * Some prop firms trail the max-loss level with the equity high-water mark.
   * FTMO does not, but the engine supports it for other firms / stricter runs.
   */
  maxLossIsTrailing: boolean;
  /** Minimum number of distinct trading days (0 since FTMO dropped the rule). */
  minTradingDays: number;
  /** IANA timezone in which the trading day rolls over (FTMO: Europe/Prague). */
  dailyResetTimeZone: string;
  /** Swing accounts may hold over the weekend; normal accounts may not. */
  holdOverWeekend: boolean;
  /** Swing accounts may trade through high-impact news; normal accounts may not. */
  holdOverNews: boolean;
  /** Minutes before/after a high-impact release that trading is blocked. */
  newsBufferMinutes: number;
}

export interface RiskConfig {
  /** Risk per trade, percent of current equity. */
  riskPerTradePct: number;
  /** Cap on the summed open risk for a single symbol. */
  maxRiskPerSymbolPct: number;
  /** Cap on the summed open risk of one correlation group. */
  maxRiskPerGroupPct: number;
  /** Cap on the summed open risk across the whole portfolio. */
  maxAggregateRiskPct: number;
  maxConcurrentPositions: number;
  maxPositionsPerSymbol: number;
  maxTradesPerDay: number;
  /** Stop opening new trades once the day is down this much (percent of day-start balance). */
  dailySoftStopPct: number;
  /** Flatten everything once the day is down this much. Must stay below the FTMO limit. */
  dailyHardStopPct: number;
  /** Stop opening new trades once total drawdown reaches this. */
  totalSoftStopPct: number;
  /** Flatten everything and halt once total drawdown reaches this. */
  totalHardStopPct: number;
  maxConsecutiveLosses: number;
  /** Cool-down after the loss streak limit is hit, in minutes. */
  lossStreakCooldownMinutes: number;
  /** Minimum stop distance expressed as a multiple of ATR – blocks over-leveraged entries. */
  minStopAtrMultiple: number;
  /** Maximum stop distance as a multiple of ATR – blocks nonsense-wide stops. */
  maxStopAtrMultiple: number;
  /**
   * Once the profit target is reached, stop trading and protect the result.
   * Prevents giving a passed challenge back on the same day.
   */
  lockInProfitTarget: boolean;
  /** Extra safety margin (percent of equity) kept between worst case and the hard floor. */
  worstCaseBufferPct: number;
  /** Groups of symbols that move together; risk is aggregated per group. */
  correlationGroups: Record<string, string[]>;
}

export interface RiskState {
  /** Broker-day key in the FTMO reset timezone, e.g. "2026-09-07". */
  dayKey: string;
  dayStartBalance: number;
  dayStartEquity: number;
  dayPeakEquity: number;
  initialBalance: number;
  /** Highest equity ever seen – anchor for trailing max-loss models. */
  peakEquity: number;
  realizedPnlToday: number;
  tradesToday: number;
  consecutiveLosses: number;
  /** Epoch ms until which no new position may be opened. */
  haltedUntil: number;
  /** Set when a hard rule fired; requires explicit operator reset. */
  killSwitch: boolean;
  killSwitchReason?: string;
  /** Distinct days on which at least one trade was closed. */
  tradingDays: string[];
  targetReached: boolean;
}

export type RiskVerdict = 'allow' | 'reject';

export interface RiskDecision {
  verdict: RiskVerdict;
  /** Machine-readable rule id, e.g. "daily-soft-stop". */
  rule?: string;
  reason?: string;
  /** Volume the risk manager is willing to accept (may be smaller than requested). */
  volume?: number;
}

export type RiskActionType =
  | 'none'
  | 'halt-new-trades'
  | 'flatten-all'
  | 'kill-switch';

export interface RiskAction {
  type: RiskActionType;
  rule: string;
  reason: string;
  closeReason?: CloseReason;
}

export interface NewsEvent {
  /** Epoch ms of the scheduled release. */
  time: number;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  title: string;
}
