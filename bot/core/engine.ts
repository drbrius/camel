/**
 * The trading engine.
 *
 * One iteration, always in this order:
 *
 *   1. Read the account and open positions from the broker (never from memory).
 *   2. Roll the trading day over if the broker date changed.
 *   3. Ask the risk manager what must happen right now. If it says flatten,
 *      nothing else runs this iteration.
 *   4. Manage existing positions – trailing stops, partials, strategy exits.
 *   5. Only then look for new entries.
 *
 * The ordering is not cosmetic. Protecting open risk always outranks finding
 * new risk, and reading state from the broker rather than trusting a local
 * cache is what keeps the bot correct after a restart, a manual intervention
 * in the MT5 terminal, or a missed fill.
 */

import type {
  AccountSnapshot,
  Candle,
  ClosedTrade,
  Position,
  Quote,
  Timeframe
} from '../types';
import type { BotConfig } from '../config';
import type { Broker } from '../brokers/types';
import type { Signal, Strategy, StrategyContext } from '../strategies/types';
import { CurrencyConverter, getSpec, priceToPips } from './instruments';
import { atr, last } from './indicators';
import { Logger } from './logger';
import { RiskManager, type OrderIntent } from './risk';
import { computePositionSize } from './sizing';
import { StateStore } from './state';
import { isMarketClosed, resample } from './time';

/**
 * Bars handed to a strategy's entry logic. Comfortably above the longest
 * warm-up any bundled strategy needs (~62 bars) with room for new ones.
 */
const STRATEGY_WINDOW_BARS = 300;

export interface EngineOptions {
  config: BotConfig;
  broker: Broker;
  strategies: Strategy[];
  risk: RiskManager;
  converter: CurrencyConverter;
  logger: Logger;
  store?: StateStore;
  /** Injected clock – the backtester supplies simulated time. */
  clock?: () => number;
}

export interface IterationResult {
  time: number;
  snapshot: AccountSnapshot;
  openPositions: number;
  ordersPlaced: number;
  tradesClosed: ClosedTrade[];
  haltReason?: string;
}

export class Engine {
  private readonly config: BotConfig;
  private readonly broker: Broker;
  private readonly strategies: Strategy[];
  private readonly risk: RiskManager;
  private readonly converter: CurrencyConverter;
  private readonly logger: Logger;
  private readonly store?: StateStore;
  private readonly clock: () => number;

  private journal: ClosedTrade[] = [];
  private running = false;
  private lastHeartbeat = 0;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.broker = options.broker;
    this.strategies = options.strategies;
    this.risk = options.risk;
    this.converter = options.converter;
    this.logger = options.logger;
    this.store = options.store;
    this.clock = options.clock ?? (() => Date.now());

    this.risk.setSpecResolver((symbol) => {
      try {
        return getSpec(symbol);
      } catch {
        return undefined;
      }
    });

    const restored = this.store?.load();
    if (restored) {
      this.risk.state = restored.risk;
      this.journal = restored.journal;
      this.logger.info('Restored risk state from disk', {
        day: restored.risk.dayKey,
        killSwitch: restored.risk.killSwitch,
        savedAt: restored.savedAt
      });
    }
  }

  /** Runs a single decision cycle. Safe to call from a loop or a backtest. */
  async iterate(): Promise<IterationResult> {
    const now = this.clock();
    const snapshot = await this.broker.getAccount();
    // Prefer the broker's own timestamp where it provides one.
    snapshot.time = snapshot.time || now;

    const positions = await this.broker.getPositions();
    const closedThisIteration: ClosedTrade[] = [];

    if (this.risk.syncDay(snapshot)) {
      this.logger.info('New trading day', {
        day: this.risk.state.dayKey,
        startBalance: snapshot.balance,
        startEquity: snapshot.equity,
        ...this.risk.describe(snapshot)
      });
    }

    const action = this.risk.monitor(snapshot, positions);

    if (action.type === 'flatten-all' || action.type === 'kill-switch') {
      this.logger.risk(`${action.rule}: ${action.reason}`, this.risk.describe(snapshot));
      if (positions.length > 0 && !this.config.dryRun) {
        const closes = await this.broker.closeAll(action.closeReason ?? 'risk-halt');
        for (const trade of closes) this.bookClose(trade);
        closedThisIteration.push(...closes);
      }
      this.persist();
      return {
        time: now,
        snapshot,
        openPositions: 0,
        ordersPlaced: 0,
        tradesClosed: closedThisIteration,
        haltReason: `${action.rule}: ${action.reason}`
      };
    }

    // --- Manage what is already open ---
    const contexts = new Map<string, StrategyContext>();
    for (const position of positions) {
      const ctx = await this.buildContext(position.symbol, positions, now);
      if (!ctx) continue;
      contexts.set(position.symbol, ctx);

      const strategy = this.strategies.find((s) => s.id === position.strategy);
      if (!strategy) continue;

      const decision = strategy.manage(position, { ...ctx, positions: [position] });
      const closed = await this.applyPositionAction(position, decision, ctx);
      if (closed) {
        closedThisIteration.push(closed);
      }
    }

    if (action.type === 'halt-new-trades') {
      this.logger.risk(`no new trades: ${action.rule} – ${action.reason}`);
      this.heartbeat(snapshot, positions.length);
      this.persist();
      return {
        time: now,
        snapshot,
        openPositions: (await this.broker.getPositions()).length,
        ordersPlaced: 0,
        tradesClosed: closedThisIteration,
        haltReason: `${action.rule}: ${action.reason}`
      };
    }

    if (isMarketClosed(now)) {
      this.heartbeat(snapshot, positions.length);
      return {
        time: now,
        snapshot,
        openPositions: positions.length,
        ordersPlaced: 0,
        tradesClosed: closedThisIteration,
        haltReason: 'market closed'
      };
    }

    // --- Look for new entries ---
    let ordersPlaced = 0;
    const livePositions = await this.broker.getPositions();

    for (const symbol of this.config.symbols) {
      const ctx = contexts.get(symbol) ?? (await this.buildContext(symbol, livePositions, now));
      if (!ctx) continue;

      const signal = this.bestSignal(ctx);
      if (!signal) continue;

      const placed = await this.tryPlace(signal, ctx, await this.broker.getPositions(), snapshot);
      if (placed) ordersPlaced++;
    }

    this.heartbeat(snapshot, livePositions.length);
    this.persist();

    return {
      time: now,
      snapshot,
      openPositions: (await this.broker.getPositions()).length,
      ordersPlaced,
      tradesClosed: closedThisIteration
    };
  }

  /**
   * Picks the highest-confidence signal across all strategies for a symbol.
   * Conflicting directions cancel each other out: when two strategies disagree
   * the honest reading is that there is no edge, not that one of them is right.
   */
  private bestSignal(ctx: StrategyContext): Signal | null {
    const signals: Signal[] = [];
    for (const strategy of this.strategies) {
      if (ctx.candles.length < strategy.warmupBars) continue;
      try {
        const signal = strategy.evaluate(ctx);
        if (signal) signals.push(signal);
      } catch (error: any) {
        this.logger.error(`strategy ${strategy.id} threw on ${ctx.symbol}`, {
          message: error?.message ?? String(error)
        });
      }
    }

    if (signals.length === 0) return null;
    if (signals.length > 1 && new Set(signals.map((s) => s.side)).size > 1) {
      this.logger.debug(`conflicting signals on ${ctx.symbol} – standing aside`);
      return null;
    }

    return signals.reduce((best, current) => (current.confidence > best.confidence ? current : best));
  }

  /** Sizes a signal, runs it past the risk manager and places it if allowed. */
  private async tryPlace(
    signal: Signal,
    ctx: StrategyContext,
    positions: Position[],
    snapshot: AccountSnapshot
  ): Promise<boolean> {
    const spec = ctx.spec;
    const entryPrice = signal.side === 'buy' ? ctx.quote.ask : ctx.quote.bid;
    const stopDistance = Math.abs(entryPrice - signal.stopPrice);

    // Confidence scales risk between 60 % and 100 % of the configured budget.
    // It never scales above it: a strategy cannot talk the risk manager into a
    // bigger position than the configuration allows.
    const scaledRiskPct = this.config.risk.riskPerTradePct * (0.6 + 0.4 * Math.min(1, signal.confidence));

    const sizing = computePositionSize({
      equity: snapshot.equity,
      riskPct: scaledRiskPct,
      stopDistance,
      spec,
      converter: this.converter
    });

    if (!sizing.ok) {
      this.logger.debug(`sizing rejected ${signal.symbol}`, { reason: sizing.reason });
      return false;
    }

    const intent: OrderIntent = {
      symbol: signal.symbol,
      side: signal.side,
      volume: sizing.volume,
      entryPrice,
      stopLoss: signal.stopPrice,
      spec,
      riskAmount: sizing.riskAmount,
      atr: ctx.atr,
      spreadPips: ctx.spreadPips,
      now: ctx.now
    };

    const decision = this.risk.evaluateOrder(intent, positions, snapshot);
    if (decision.verdict === 'reject') {
      this.logger.risk(`order rejected on ${signal.symbol}`, {
        rule: decision.rule,
        reason: decision.reason,
        strategy: signal.strategy
      });
      return false;
    }

    if (this.config.dryRun) {
      this.logger.trade(`DRY RUN – would open ${signal.side} ${sizing.volume} ${signal.symbol}`, {
        entry: entryPrice,
        stop: signal.stopPrice,
        target: signal.takeProfitPrice,
        risk: Number(sizing.riskAmount.toFixed(2)),
        reason: signal.reason
      });
      return false;
    }

    try {
      const position = await this.broker.placeMarketOrder({
        symbol: signal.symbol,
        side: signal.side,
        volume: sizing.volume,
        stopLoss: signal.stopPrice,
        takeProfit: signal.takeProfitPrice,
        strategy: signal.strategy,
        initialRiskPrice: stopDistance,
        riskAmount: sizing.riskAmount,
        comment: signal.strategy
      });

      this.risk.registerOpen(position);
      this.logger.trade(`OPEN ${position.side} ${position.volume} ${position.symbol} @ ${position.entryPrice}`, {
        stop: position.stopLoss,
        target: position.takeProfit,
        riskAmount: Number(sizing.riskAmount.toFixed(2)),
        riskPct: Number(((sizing.riskAmount / snapshot.equity) * 100).toFixed(3)),
        strategy: signal.strategy,
        reason: signal.reason
      });
      return true;
    } catch (error: any) {
      this.logger.error(`failed to open ${signal.symbol}`, { message: error?.message ?? String(error) });
      return false;
    }
  }

  /** Applies a strategy's management decision. Returns a close if one happened. */
  private async applyPositionAction(
    position: Position,
    action: ReturnType<Strategy['manage']>,
    ctx: StrategyContext
  ): Promise<ClosedTrade | null> {
    if (action.type === 'hold') return null;
    if (this.config.dryRun) {
      this.logger.trade(`DRY RUN – would ${action.type} on ${position.symbol}`, { action });
      return null;
    }

    try {
      switch (action.type) {
        case 'move-stop': {
          await this.broker.modifyPosition(position.id, { stopLoss: action.stopLoss });
          this.logger.trade(`STOP ${position.symbol} -> ${action.stopLoss.toFixed(ctx.spec.digits)}`, {
            reason: action.reason
          });
          return null;
        }
        case 'partial-close': {
          const trade = await this.broker.closePosition(position.id, 'partial', action.volume);
          this.bookClose(trade);
          this.logger.trade(`PARTIAL ${position.symbol} ${action.volume} lots`, {
            reason: action.reason,
            netPnl: trade.netPnl
          });
          return trade;
        }
        case 'close': {
          const trade = await this.broker.closePosition(position.id, 'strategy-exit');
          this.bookClose(trade);
          this.logger.trade(`CLOSE ${position.symbol}`, { reason: action.reason, netPnl: trade.netPnl });
          return trade;
        }
      }
    } catch (error: any) {
      this.logger.error(`position action failed on ${position.symbol}`, {
        action: action.type,
        message: error?.message ?? String(error)
      });
    }
    return null;
  }

  /** Assembles everything a strategy needs to make a decision on one symbol. */
  private async buildContext(
    symbol: string,
    positions: Position[],
    now: number
  ): Promise<StrategyContext | null> {
    let spec;
    try {
      spec = getSpec(symbol);
    } catch (error: any) {
      this.logger.error(`no instrument spec for ${symbol}`, { message: error?.message });
      return null;
    }

    let candles: Candle[];
    let quote: Quote;
    try {
      candles = await this.broker.getCandles(symbol, this.config.primaryTimeframe, this.config.historyBars);
      quote = await this.broker.getQuote(symbol);
    } catch (error: any) {
      this.logger.warn(`market data unavailable for ${symbol}`, { message: error?.message ?? String(error) });
      return null;
    }

    if (candles.length < 60) return null;

    // Keep the FX conversion table fresh from the quotes we already have.
    this.updateConversionRates(symbol, quote);

    // The higher-timeframe filter needs the full history (an H4 EMA(50) is
    // 800 M15 bars), but the entry indicators only look back a few dozen bars.
    // Trimming the primary window keeps every iteration cheap enough that a
    // multi-month backtest finishes in seconds.
    const higher = resample(candles, this.config.higherTimeframe as Timeframe);
    const primary = candles.slice(-STRATEGY_WINDOW_BARS);
    const currentAtr = last(atr(primary, 14)) ?? 0;
    const spreadPips = priceToPips(quote.ask - quote.bid, spec);

    return {
      symbol,
      spec,
      candles: primary,
      higher,
      quote,
      now,
      positions: positions.filter((p) => p.symbol === symbol),
      atr: currentAtr,
      spreadPips
    };
  }

  /**
   * Derives conversion rates from live quotes so PnL on cross pairs is valued
   * correctly rather than with the stale defaults in `CurrencyConverter`.
   */
  private updateConversionRates(symbol: string, quote: Quote): void {
    if (symbol.length !== 6) return;
    const base = symbol.slice(0, 3);
    const term = symbol.slice(3);
    const mid = (quote.bid + quote.ask) / 2;
    if (mid > 0) this.converter.setRate(base, term, mid);
  }

  private bookClose(trade: ClosedTrade): void {
    this.risk.registerClose(trade);
    this.journal.push(trade);
    this.store?.appendTrade(trade);
  }

  /**
   * Books a close the engine did not initiate: a stop or target filled by the
   * broker between iterations. The backtester calls this; a live deployment
   * would call it from the broker's fill stream.
   */
  registerExternalClose(trade: ClosedTrade): void {
    this.bookClose(trade);
    this.logger.trade(`FILLED ${trade.reason} ${trade.symbol}`, {
      netPnl: trade.netPnl,
      r: trade.rMultiple
    });
  }

  private heartbeat(snapshot: AccountSnapshot, openPositions: number): void {
    const now = this.clock();
    if (now - this.lastHeartbeat < 15 * 60_000) return;
    this.lastHeartbeat = now;
    this.logger.info('heartbeat', { ...this.risk.describe(snapshot), openPositions });
  }

  private persist(): void {
    this.store?.save(this.risk.state, this.journal);
  }

  closedTrades(): ClosedTrade[] {
    return [...this.journal];
  }

  /**
   * 24/7 loop. Errors inside an iteration never stop the loop – a transient
   * broker outage must not leave open positions unmanaged – but consecutive
   * failures back off exponentially and eventually raise the alarm.
   */
  async run(): Promise<void> {
    this.running = true;
    let consecutiveFailures = 0;

    const shutdown = async (signal: string) => {
      this.logger.warn(`received ${signal} – shutting down`);
      this.running = false;
      this.persist();
      try {
        await this.broker.disconnect();
      } catch {
        // Nothing useful to do while exiting.
      }
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    this.logger.info('engine started', {
      broker: this.broker.name,
      symbols: this.config.symbols,
      strategies: this.strategies.map((s) => s.id),
      phase: this.config.rules.phase,
      dryRun: this.config.dryRun
    });

    while (this.running) {
      try {
        const result = await this.iterate();
        consecutiveFailures = 0;
        if (result.haltReason) {
          this.logger.debug('iteration halted', { reason: result.haltReason });
        }
      } catch (error: any) {
        consecutiveFailures++;
        this.logger.error('iteration failed', {
          attempt: consecutiveFailures,
          message: error?.message ?? String(error)
        });

        // After sustained failures we can no longer guarantee that stops are
        // being managed. Engage the kill switch so a human looks at it.
        if (consecutiveFailures >= 10) {
          this.risk.engageKillSwitch(`${consecutiveFailures} consecutive engine failures`);
          this.persist();
          this.logger.error('KILL SWITCH ENGAGED – manual intervention required');
        }
      }

      const backoff = consecutiveFailures > 0 ? Math.min(2 ** consecutiveFailures, 300) : 0;
      const waitMs = (this.config.loopIntervalSeconds + backoff) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  stop(): void {
    this.running = false;
  }
}
