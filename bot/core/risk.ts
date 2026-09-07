/**
 * The risk manager – the only component that is allowed to say "yes" to a trade.
 *
 * It enforces two layers of limits:
 *
 *   1. The FTMO contract itself (5 % daily, 10 % overall, profit target,
 *      weekend/news restrictions). Breaching these means the account is gone.
 *   2. Our own, strictly tighter, internal limits. These fire first, which is
 *      the entire point: by the time an internal rule halts trading there is
 *      still a full percentage point of headroom to the firm's limit.
 *
 * The most important rule here is `worst-case-floor`: before any position is
 * opened we compute what the account would be worth if *every* open position,
 * including the new one, were stopped out simultaneously. If that number is
 * below the daily hard floor, the trade is rejected. This is what makes a
 * daily-loss breach structurally impossible rather than merely unlikely.
 */

import type {
  AccountSnapshot,
  CloseReason,
  ClosedTrade,
  FtmoRuleSet,
  InstrumentSpec,
  NewsEvent,
  Position,
  RiskAction,
  RiskConfig,
  RiskDecision,
  RiskState,
  Side
} from '../types';
import { CurrencyConverter } from './instruments';
import { openRiskOf } from './sizing';
import { brokerDayKey, isMarketClosed, isRolloverWindow, isWeekendFlatWindow } from './time';

export interface RiskManagerOptions {
  rules: FtmoRuleSet;
  config: RiskConfig;
  converter: CurrencyConverter;
  /** Restored state from a previous process, if any. */
  state?: RiskState;
}

export interface OrderIntent {
  symbol: string;
  side: Side;
  volume: number;
  entryPrice: number;
  stopLoss: number;
  spec: InstrumentSpec;
  /** Money at risk for this intent, including commission. */
  riskAmount: number;
  /** Current ATR on the entry timeframe – used for stop-distance sanity checks. */
  atr: number;
  /** Current spread in pips. */
  spreadPips: number;
  now: number;
}

export interface RiskLevels {
  /** Equity level at which FTMO fails the account for the day. */
  ftmoDailyFloor: number;
  /** Equity level at which FTMO fails the account outright. */
  ftmoTotalFloor: number;
  /** Our internal stop-trading level for the day. */
  internalDailySoftFloor: number;
  /** Our internal flatten-everything level for the day. */
  internalDailyHardFloor: number;
  internalTotalSoftFloor: number;
  internalTotalHardFloor: number;
  /** Equity that would trigger the profit-target lock. */
  profitTargetEquity: number;
}

export class RiskManager {
  readonly rules: FtmoRuleSet;
  readonly config: RiskConfig;
  private readonly converter: CurrencyConverter;
  private newsEvents: NewsEvent[] = [];
  state: RiskState;

  constructor(options: RiskManagerOptions) {
    this.rules = options.rules;
    this.config = options.config;
    this.converter = options.converter;

    const initial = options.rules.accountSize;
    this.state =
      options.state ??
      ({
        dayKey: '',
        dayStartBalance: initial,
        dayStartEquity: initial,
        dayPeakEquity: initial,
        initialBalance: initial,
        peakEquity: initial,
        realizedPnlToday: 0,
        tradesToday: 0,
        consecutiveLosses: 0,
        haltedUntil: 0,
        killSwitch: false,
        tradingDays: [],
        targetReached: false
      } satisfies RiskState);
  }

  /** Replaces the economic calendar used by the news filter. */
  setNewsEvents(events: NewsEvent[]): void {
    this.newsEvents = [...events].sort((a, b) => a.time - b.time);
  }

  /**
   * All relevant equity thresholds for the current day.
   *
   * The FTMO daily baseline is the day-start balance. We deliberately take the
   * *lower* of day-start balance and day-start equity: if the day opened with
   * a floating loss, using the balance would overstate the available budget.
   */
  levels(): RiskLevels {
    const { state, rules, config } = this;
    const dailyBaseline = Math.min(state.dayStartBalance, state.dayStartEquity);

    const totalBaseline = rules.maxLossIsTrailing
      ? Math.max(state.peakEquity, state.initialBalance)
      : state.initialBalance;

    return {
      ftmoDailyFloor: dailyBaseline * (1 - rules.maxDailyLossPct / 100),
      ftmoTotalFloor: totalBaseline * (1 - rules.maxTotalLossPct / 100),
      internalDailySoftFloor: dailyBaseline * (1 - config.dailySoftStopPct / 100),
      internalDailyHardFloor: dailyBaseline * (1 - config.dailyHardStopPct / 100),
      internalTotalSoftFloor: totalBaseline * (1 - config.totalSoftStopPct / 100),
      internalTotalHardFloor: totalBaseline * (1 - config.totalHardStopPct / 100),
      profitTargetEquity: state.initialBalance * (1 + rules.profitTargetPct / 100)
    };
  }

  /**
   * Rolls the trading day over when the broker-day key changes.
   * Returns true when a rollover happened.
   */
  syncDay(snapshot: AccountSnapshot): boolean {
    const key = brokerDayKey(snapshot.time, this.rules.dailyResetTimeZone);
    if (key === this.state.dayKey) return false;

    this.state.dayKey = key;
    this.state.dayStartBalance = snapshot.balance;
    this.state.dayStartEquity = snapshot.equity;
    this.state.dayPeakEquity = snapshot.equity;
    this.state.realizedPnlToday = 0;
    this.state.tradesToday = 0;
    // A new day resets the daily budget but never the kill switch: an account
    // that breached an overall rule stays halted until a human clears it.
    return true;
  }

  /** Updates equity high-water marks. Call on every account snapshot. */
  observe(snapshot: AccountSnapshot): void {
    this.state.peakEquity = Math.max(this.state.peakEquity, snapshot.equity);
    this.state.dayPeakEquity = Math.max(this.state.dayPeakEquity, snapshot.equity);

    const levels = this.levels();
    if (
      this.config.lockInProfitTarget &&
      this.rules.profitTargetPct > 0 &&
      snapshot.equity >= levels.profitTargetEquity
    ) {
      this.state.targetReached = true;
    }
  }

  /**
   * Continuous monitoring. Returns the action the engine must take right now.
   * Called on every loop iteration, before any strategy is consulted.
   */
  monitor(snapshot: AccountSnapshot, positions: Position[]): RiskAction {
    this.observe(snapshot);
    const levels = this.levels();
    const equity = snapshot.equity;

    if (this.state.killSwitch) {
      return {
        type: 'flatten-all',
        rule: 'kill-switch',
        reason: this.state.killSwitchReason ?? 'kill switch engaged',
        closeReason: 'risk-halt'
      };
    }

    // --- Hard floors: flatten immediately and stop for the day. ---
    if (equity <= levels.internalTotalHardFloor) {
      this.engageKillSwitch(
        `equity ${equity.toFixed(2)} breached the internal total floor ${levels.internalTotalHardFloor.toFixed(2)}`
      );
      return {
        type: 'kill-switch',
        rule: 'total-hard-stop',
        reason: this.state.killSwitchReason!,
        closeReason: 'risk-halt'
      };
    }

    if (equity <= levels.internalDailyHardFloor) {
      this.haltForRestOfDay(snapshot.time);
      return {
        type: 'flatten-all',
        rule: 'daily-hard-stop',
        reason:
          `equity ${equity.toFixed(2)} breached the internal daily floor ` +
          `${levels.internalDailyHardFloor.toFixed(2)} (FTMO floor: ${levels.ftmoDailyFloor.toFixed(2)})`,
        closeReason: 'risk-halt'
      };
    }

    // --- Contractual obligations that require being flat. ---
    if (!this.rules.holdOverWeekend && positions.length > 0 && isWeekendFlatWindow(snapshot.time)) {
      return {
        type: 'flatten-all',
        rule: 'weekend-flat',
        reason: 'non-swing account: all positions must be closed before the weekend',
        closeReason: 'weekend-flat'
      };
    }

    if (!this.rules.holdOverNews && positions.length > 0) {
      const event = this.activeNewsEvent(snapshot.time, positions.map((p) => p.symbol));
      if (event) {
        return {
          type: 'flatten-all',
          rule: 'news-flat',
          reason: `high-impact ${event.currency} release "${event.title}" inside the restricted window`,
          closeReason: 'news-flat'
        };
      }
    }

    // --- Soft floors: keep existing positions, open nothing new. ---
    if (equity <= levels.internalTotalSoftFloor) {
      return {
        type: 'halt-new-trades',
        rule: 'total-soft-stop',
        reason: `equity ${equity.toFixed(2)} is below the internal total soft floor`
      };
    }

    if (equity <= levels.internalDailySoftFloor) {
      return {
        type: 'halt-new-trades',
        rule: 'daily-soft-stop',
        reason: `equity ${equity.toFixed(2)} is below the internal daily soft floor`
      };
    }

    if (this.state.targetReached) {
      return {
        type: 'halt-new-trades',
        rule: 'profit-target-lock',
        reason: `profit target of ${this.rules.profitTargetPct}% reached – protecting the result`
      };
    }

    return { type: 'none', rule: 'ok', reason: 'within all limits' };
  }

  /**
   * Pre-trade gate. Every rule that can reject a trade lives here, in order of
   * increasing cost to evaluate.
   */
  evaluateOrder(intent: OrderIntent, positions: Position[], snapshot: AccountSnapshot): RiskDecision {
    const { config, rules } = this;
    const levels = this.levels();
    const reject = (rule: string, reason: string): RiskDecision => ({ verdict: 'reject', rule, reason });

    if (this.state.killSwitch) {
      return reject('kill-switch', this.state.killSwitchReason ?? 'kill switch engaged');
    }
    if (intent.now < this.state.haltedUntil) {
      const minutes = Math.ceil((this.state.haltedUntil - intent.now) / 60_000);
      return reject('cooldown', `trading paused for another ${minutes} minute(s)`);
    }
    if (this.state.targetReached && config.lockInProfitTarget) {
      return reject('profit-target-lock', 'profit target reached – no new risk');
    }

    // --- Market/session gates ---
    if (isMarketClosed(intent.now)) {
      return reject('market-closed', 'market is closed');
    }
    if (isRolloverWindow(intent.now, rules.dailyResetTimeZone)) {
      return reject('rollover-window', 'inside the daily rollover window (wide spreads, swap charges)');
    }
    if (!rules.holdOverWeekend && isWeekendFlatWindow(intent.now, 120)) {
      return reject('weekend-flat', 'too close to the weekend for a non-swing account');
    }
    if (!rules.holdOverNews) {
      const event = this.activeNewsEvent(intent.now, [intent.symbol]);
      if (event) {
        return reject('news-window', `restricted news window: ${event.title}`);
      }
    }

    const hour = new Date(intent.now).getUTCHours();
    const { from, to } = intent.spec.tradingHoursUtc;
    if (hour < from || hour >= to) {
      return reject('outside-trading-hours', `${intent.symbol} is only traded between ${from}:00 and ${to}:00 UTC`);
    }

    // --- Execution-quality gates ---
    if (intent.spreadPips > intent.spec.maxSpreadPips) {
      return reject(
        'spread-too-wide',
        `spread ${intent.spreadPips.toFixed(1)} pips exceeds the ${intent.spec.maxSpreadPips} pip limit`
      );
    }

    const stopDistance = Math.abs(intent.entryPrice - intent.stopLoss);
    if (!(stopDistance > 0)) {
      return reject('invalid-stop', 'stop loss must differ from the entry price');
    }
    if (intent.atr > 0) {
      const atrMultiple = stopDistance / intent.atr;
      if (atrMultiple < config.minStopAtrMultiple) {
        return reject(
          'stop-too-tight',
          `stop is ${atrMultiple.toFixed(2)} ATR, below the ${config.minStopAtrMultiple} ATR minimum`
        );
      }
      if (atrMultiple > config.maxStopAtrMultiple) {
        return reject(
          'stop-too-wide',
          `stop is ${atrMultiple.toFixed(2)} ATR, above the ${config.maxStopAtrMultiple} ATR maximum`
        );
      }
    }

    // --- Frequency and exposure gates ---
    if (this.state.tradesToday >= config.maxTradesPerDay) {
      return reject('max-trades-per-day', `daily trade limit of ${config.maxTradesPerDay} reached`);
    }
    if (positions.length >= config.maxConcurrentPositions) {
      return reject('max-positions', `already holding ${positions.length} positions`);
    }

    const sameSymbol = positions.filter((p) => p.symbol === intent.symbol);
    if (sameSymbol.length >= config.maxPositionsPerSymbol) {
      return reject('max-positions-per-symbol', `already holding a position in ${intent.symbol}`);
    }
    // Hedging the same instrument locks in the spread on both sides and is
    // treated as a bug in the strategy, not a legitimate intent.
    if (sameSymbol.some((p) => p.side !== intent.side)) {
      return reject('opposite-exposure', `an opposing ${intent.symbol} position is already open`);
    }

    const equity = snapshot.equity;
    const symbolRisk = this.openRisk(positions.filter((p) => p.symbol === intent.symbol), snapshot);
    if (symbolRisk + intent.riskAmount > equity * (config.maxRiskPerSymbolPct / 100)) {
      return reject(
        'symbol-risk-cap',
        `open risk on ${intent.symbol} would exceed ${config.maxRiskPerSymbolPct}% of equity`
      );
    }

    const groups = this.groupsOf(intent.symbol);
    for (const group of groups) {
      const members = config.correlationGroups[group] ?? [];
      const groupPositions = positions.filter((p) => members.includes(p.symbol));
      const groupRisk = this.openRisk(groupPositions, snapshot);
      if (groupRisk + intent.riskAmount > equity * (config.maxRiskPerGroupPct / 100)) {
        return reject(
          'correlation-risk-cap',
          `correlated exposure in group "${group}" would exceed ${config.maxRiskPerGroupPct}% of equity`
        );
      }
    }

    const portfolioRisk = this.openRisk(positions, snapshot);
    if (portfolioRisk + intent.riskAmount > equity * (config.maxAggregateRiskPct / 100)) {
      return reject(
        'aggregate-risk-cap',
        `total open risk would exceed ${config.maxAggregateRiskPct}% of equity`
      );
    }

    // --- The structural guarantee ---
    // If everything stops out at once, where does equity land? That number,
    // minus a safety buffer, must stay above both the internal daily floor and
    // the FTMO floor. This single check is what prevents a rule breach.
    const buffer = equity * (config.worstCaseBufferPct / 100);
    const worstCaseEquity = equity - portfolioRisk - intent.riskAmount;

    if (worstCaseEquity - buffer <= levels.internalDailyHardFloor) {
      return reject(
        'worst-case-floor',
        `worst case equity ${worstCaseEquity.toFixed(2)} would come within the buffer of the ` +
          `internal daily floor ${levels.internalDailyHardFloor.toFixed(2)}`
      );
    }
    if (worstCaseEquity - buffer <= levels.ftmoDailyFloor) {
      return reject(
        'ftmo-daily-floor',
        `worst case equity ${worstCaseEquity.toFixed(2)} would approach the FTMO daily floor ` +
          `${levels.ftmoDailyFloor.toFixed(2)}`
      );
    }
    if (worstCaseEquity - buffer <= levels.ftmoTotalFloor) {
      return reject(
        'ftmo-total-floor',
        `worst case equity ${worstCaseEquity.toFixed(2)} would approach the FTMO max-loss floor ` +
          `${levels.ftmoTotalFloor.toFixed(2)}`
      );
    }

    return { verdict: 'allow', rule: 'ok', volume: intent.volume };
  }

  /** Summed money at risk across the given positions, in account currency. */
  openRisk(positions: Position[], snapshot: AccountSnapshot, prices?: Map<string, number>): number {
    let total = 0;
    for (const position of positions) {
      const spec = this.specOf(position.symbol);
      if (!spec) {
        // Without a spec we cannot measure the risk – assume the full initial risk.
        total += position.riskAmount;
        continue;
      }
      const price = prices?.get(position.symbol) ?? position.entryPrice;
      total += openRiskOf(position.side, position.volume, price, position.stopLoss, spec, this.converter);
    }
    void snapshot;
    return total;
  }

  private specResolver: ((symbol: string) => InstrumentSpec | undefined) | null = null;

  /** Injects the instrument lookup so risk can be measured at live prices. */
  setSpecResolver(resolver: (symbol: string) => InstrumentSpec | undefined): void {
    this.specResolver = resolver;
  }

  private specOf(symbol: string): InstrumentSpec | undefined {
    return this.specResolver ? this.specResolver(symbol) : undefined;
  }

  private groupsOf(symbol: string): string[] {
    return Object.entries(this.config.correlationGroups)
      .filter(([, members]) => members.includes(symbol))
      .map(([group]) => group);
  }

  /** High-impact release within the restricted window for any of the symbols. */
  private activeNewsEvent(now: number, symbols: string[]): NewsEvent | undefined {
    if (this.newsEvents.length === 0) return undefined;
    const bufferMs = this.rules.newsBufferMinutes * 60_000;
    const currencies = new Set<string>();
    for (const symbol of symbols) {
      currencies.add(symbol.slice(0, 3));
      currencies.add(symbol.slice(3, 6));
    }

    return this.newsEvents.find(
      (event) =>
        event.impact === 'high' &&
        currencies.has(event.currency) &&
        Math.abs(now - event.time) <= bufferMs
    );
  }

  /** Records a fill so frequency limits stay accurate. */
  registerOpen(position: Position): void {
    this.state.tradesToday += 1;
    void position;
  }

  /** Records a close: updates the loss streak, daily PnL and trading-day count. */
  registerClose(trade: ClosedTrade): void {
    this.state.realizedPnlToday += trade.netPnl;

    const dayKey = brokerDayKey(trade.closedAt, this.rules.dailyResetTimeZone);
    if (!this.state.tradingDays.includes(dayKey)) {
      this.state.tradingDays.push(dayKey);
    }

    // Partial closes are exits of a still-running idea; they must not reset or
    // extend the losing streak.
    if (trade.reason === 'partial') return;

    if (trade.netPnl < 0) {
      this.state.consecutiveLosses += 1;
      if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.state.haltedUntil = trade.closedAt + this.config.lossStreakCooldownMinutes * 60_000;
        this.state.consecutiveLosses = 0;
      }
    } else if (trade.netPnl > 0) {
      this.state.consecutiveLosses = 0;
    }
  }

  /**
   * Halts until well past the next broker midnight; `syncDay` clears it.
   *
   * The time must come from the caller, never from the wall clock: the engine
   * runs on an injected clock, and a backtest whose halts are measured against
   * `Date.now()` either never halts or halts forever.
   */
  private haltForRestOfDay(now: number): void {
    this.state.haltedUntil = now + 24 * 60 * 60_000;
  }

  engageKillSwitch(reason: string): void {
    this.state.killSwitch = true;
    this.state.killSwitchReason = reason;
  }

  /** Manual operator reset after a kill switch – never automatic. */
  releaseKillSwitch(): void {
    this.state.killSwitch = false;
    this.state.killSwitchReason = undefined;
    this.state.haltedUntil = 0;
  }

  /** Human-readable status line for dashboards and heartbeat logs. */
  describe(snapshot: AccountSnapshot): Record<string, unknown> {
    const levels = this.levels();
    const dailyBaseline = Math.min(this.state.dayStartBalance, this.state.dayStartEquity);
    return {
      day: this.state.dayKey,
      equity: Number(snapshot.equity.toFixed(2)),
      dayPnlPct: Number((((snapshot.equity - dailyBaseline) / dailyBaseline) * 100).toFixed(3)),
      totalPnlPct: Number(
        (((snapshot.equity - this.state.initialBalance) / this.state.initialBalance) * 100).toFixed(3)
      ),
      dailyBudgetLeft: Number((snapshot.equity - levels.internalDailyHardFloor).toFixed(2)),
      ftmoDailyFloor: Number(levels.ftmoDailyFloor.toFixed(2)),
      ftmoTotalFloor: Number(levels.ftmoTotalFloor.toFixed(2)),
      tradesToday: this.state.tradesToday,
      targetReached: this.state.targetReached,
      killSwitch: this.state.killSwitch
    };
  }
}

/** Maps a risk action to the reason recorded on the resulting closes. */
export function closeReasonFor(action: RiskAction): CloseReason {
  return action.closeReason ?? 'risk-halt';
}
