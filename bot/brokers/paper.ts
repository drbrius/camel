/**
 * Paper broker: a full simulation of an MT5 hedging-free account.
 *
 * It models the things that actually decide whether a challenge passes –
 * spread, commission, swap and slippage – rather than filling at the ideal
 * price. A backtest that ignores them typically overstates net profit by more
 * than the entire FTMO profit target.
 *
 * The same class powers both the backtester and `--paper` live runs; the only
 * difference is who calls `syncPrice()`.
 */

import {
  TIMEFRAME_MINUTES,
  type AccountSnapshot,
  type Candle,
  type ClosedTrade,
  type CloseReason,
  type OrderRequest,
  type Position,
  type Quote,
  type Timeframe
} from '../types';
import { CurrencyConverter, getSpec } from '../core/instruments';
import { resample } from '../core/time';
import { type Broker, BrokerError } from './types';

export interface PaperBrokerOptions {
  startingBalance: number;
  currency: string;
  converter: CurrencyConverter;
  /** Extra adverse price movement applied to every fill, in pips. */
  slippagePips?: number;
  /** Daily swap charge per lot, in account currency. Negative = cost. */
  swapPerLotPerDay?: number;
  /** Multiplies each instrument's typical spread – use >1 to stress-test. */
  spreadMultiplier?: number;
}

interface PriceState {
  bid: number;
  ask: number;
  time: number;
}

export class PaperBroker implements Broker {
  readonly name = 'paper';

  private balance: number;
  private readonly currency: string;
  private readonly converter: CurrencyConverter;
  private readonly slippagePips: number;
  private readonly swapPerLotPerDay: number;
  private readonly spreadMultiplier: number;

  private positions = new Map<string, Position>();
  private prices = new Map<string, PriceState>();
  private history = new Map<string, Candle[]>();
  private closed: ClosedTrade[] = [];
  private nextId = 1;
  private now = Date.now();

  constructor(options: PaperBrokerOptions) {
    this.balance = options.startingBalance;
    this.currency = options.currency;
    this.converter = options.converter;
    this.slippagePips = options.slippagePips ?? 0.3;
    this.swapPerLotPerDay = options.swapPerLotPerDay ?? -2;
    this.spreadMultiplier = options.spreadMultiplier ?? 1;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  /** Feeds a new bar in. Returns the trades that the bar closed. */
  syncCandle(symbol: string, candle: Candle): ClosedTrade[] {
    const spec = getSpec(symbol);
    const halfSpread = (spec.typicalSpreadPips * this.spreadMultiplier * spec.pipSize) / 2;

    this.now = candle.time;
    const series = this.history.get(symbol) ?? [];
    series.push(candle);
    // Keep memory bounded during long backtests.
    if (series.length > 5_000) series.splice(0, series.length - 5_000);
    this.history.set(symbol, series);

    this.prices.set(symbol, {
      bid: candle.close - halfSpread,
      ask: candle.close + halfSpread,
      time: candle.time
    });

    return this.resolveBar(symbol, candle);
  }

  /** Feeds a raw quote in (live paper trading). */
  syncPrice(quote: Quote): void {
    this.now = quote.time;
    this.prices.set(quote.symbol, { bid: quote.bid, ask: quote.ask, time: quote.time });
  }

  setHistory(symbol: string, candles: Candle[]): void {
    this.history.set(symbol, [...candles]);
  }

  /**
   * Checks stops and targets against a completed bar.
   *
   * When both the stop and the target lie inside the same bar we assume the
   * stop was hit first. Without tick data that ordering is unknowable, and
   * assuming the favourable one is how backtests turn into losing live systems.
   */
  private resolveBar(symbol: string, candle: Candle): ClosedTrade[] {
    const closedNow: ClosedTrade[] = [];

    for (const position of [...this.positions.values()]) {
      if (position.symbol !== symbol) continue;

      const stopHit =
        position.side === 'buy' ? candle.low <= position.stopLoss : candle.high >= position.stopLoss;
      const targetHit =
        position.takeProfit !== undefined &&
        (position.side === 'buy' ? candle.high >= position.takeProfit : candle.low <= position.takeProfit);

      if (stopHit) {
        closedNow.push(this.settle(position, position.stopLoss, 'stop-loss', candle.time));
      } else if (targetHit && position.takeProfit !== undefined) {
        closedNow.push(this.settle(position, position.takeProfit, 'take-profit', candle.time));
      }
    }

    return closedNow;
  }

  async getAccount(): Promise<AccountSnapshot> {
    const floating = this.floatingPnl();
    return {
      time: this.now,
      balance: Number(this.balance.toFixed(2)),
      equity: Number((this.balance + floating).toFixed(2)),
      marginUsed: this.marginUsed(),
      marginFree: Number((this.balance + floating - this.marginUsed()).toFixed(2)),
      currency: this.currency
    };
  }

  async getPositions(): Promise<Position[]> {
    return [...this.positions.values()].map((p) => ({ ...p }));
  }

  async getQuote(symbol: string): Promise<Quote> {
    const price = this.prices.get(symbol);
    if (!price) throw new BrokerError(`no price for ${symbol}`, true);
    return { symbol, time: price.time, bid: price.bid, ask: price.ask };
  }

  async getCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    const series = this.history.get(symbol) ?? [];
    if (series.length === 0) return [];

    // Resampling the whole stored history on every call is the backtester's
    // hottest path. Bound the raw slice to what the request can possibly need:
    // one target bar consumes `targetMinutes / baseMinutes` base bars.
    const baseMinutes = this.baseBarMinutes(series);
    const ratio = Math.max(1, Math.ceil(TIMEFRAME_MINUTES[timeframe] / baseMinutes));
    const rawNeeded = Math.min(series.length, (count + 2) * ratio);
    const window = series.slice(-rawNeeded);

    if (ratio === 1) return window.slice(-count);
    return resample(window, timeframe).slice(-count);
  }

  /**
   * Infers the stored bar size. Uses the smallest of the recent gaps because
   * weekend and session breaks produce gaps many times the real bar size.
   */
  private baseBarMinutes(series: Candle[]): number {
    if (series.length < 2) return 1;
    let smallest = Infinity;
    for (let i = Math.max(1, series.length - 20); i < series.length; i++) {
      const gap = series[i].time - series[i - 1].time;
      if (gap > 0) smallest = Math.min(smallest, gap);
    }
    return Number.isFinite(smallest) ? Math.max(1, Math.round(smallest / 60_000)) : 1;
  }

  async placeMarketOrder(request: OrderRequest): Promise<Position> {
    const spec = getSpec(request.symbol);
    const price = this.prices.get(request.symbol);
    if (!price) throw new BrokerError(`no price for ${request.symbol}`, true);

    const slip = this.slippagePips * spec.pipSize;
    const entryPrice = request.side === 'buy' ? price.ask + slip : price.bid - slip;

    // A stop on the wrong side of the fill would mean an instant loss – reject
    // rather than let slippage silently invert the trade's logic.
    const stopIsValid =
      request.side === 'buy' ? request.stopLoss < entryPrice : request.stopLoss > entryPrice;
    if (!stopIsValid) {
      throw new BrokerError(
        `stop ${request.stopLoss} is on the wrong side of the ${request.side} fill at ${entryPrice}`
      );
    }

    const position: Position = {
      id: `paper-${this.nextId++}`,
      symbol: request.symbol,
      side: request.side,
      volume: request.volume,
      entryPrice,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      openedAt: this.now,
      strategy: request.strategy,
      initialRiskPrice: Math.abs(entryPrice - request.stopLoss),
      riskAmount: request.riskAmount,
      breakEvenDone: false,
      partialDone: false,
      trailAnchor: entryPrice,
      comment: request.comment
    };

    // MT5 charges commission per leg. Book the entry leg now so floating
    // equity is honest immediately; `settle` books the exit leg.
    this.balance -= request.volume * spec.commissionPerLot * 0.5;
    this.positions.set(position.id, position);
    return { ...position };
  }

  async modifyPosition(
    positionId: string,
    changes: { stopLoss?: number; takeProfit?: number }
  ): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) throw new BrokerError(`unknown position ${positionId}`);
    if (changes.stopLoss !== undefined) position.stopLoss = changes.stopLoss;
    if (changes.takeProfit !== undefined) position.takeProfit = changes.takeProfit;
  }

  async closePosition(positionId: string, reason: CloseReason, volume?: number): Promise<ClosedTrade> {
    const position = this.positions.get(positionId);
    if (!position) throw new BrokerError(`unknown position ${positionId}`);

    const price = this.prices.get(position.symbol);
    if (!price) throw new BrokerError(`no price for ${position.symbol}`, true);

    const spec = getSpec(position.symbol);
    const slip = this.slippagePips * spec.pipSize;
    const exitPrice = position.side === 'buy' ? price.bid - slip : price.ask + slip;

    return this.settle(position, exitPrice, reason, this.now, volume);
  }

  async closeAll(reason: CloseReason): Promise<ClosedTrade[]> {
    const results: ClosedTrade[] = [];
    for (const id of [...this.positions.keys()]) {
      results.push(await this.closePosition(id, reason));
    }
    return results;
  }

  /** Books a (partial) close: PnL, commission, swap, and the R-multiple. */
  private settle(
    position: Position,
    exitPrice: number,
    reason: CloseReason,
    time: number,
    volume?: number
  ): ClosedTrade {
    const spec = getSpec(position.symbol);
    const closeVolume = Math.min(volume ?? position.volume, position.volume);
    const valuePerLot = this.converter.valuePerLotPerPricePoint(spec);

    const direction = position.side === 'buy' ? 1 : -1;
    const grossPnl = (exitPrice - position.entryPrice) * direction * closeVolume * valuePerLot;

    const daysHeld = Math.max(0, (time - position.openedAt) / 86_400_000);
    const swap = this.swapPerLotPerDay * closeVolume * daysHeld;

    // The entry leg was already deducted from the balance when the position
    // opened, so only the exit leg moves the balance here. The *reported*
    // trade, however, carries the full round turn – otherwise the journal
    // would understate costs and the summed trade PnL would not reconcile
    // with the account's net profit.
    const exitCommission = closeVolume * spec.commissionPerLot * 0.5;
    const commission = closeVolume * spec.commissionPerLot;
    const netPnl = grossPnl + swap - commission;

    this.balance += grossPnl + swap - exitCommission;

    const riskForVolume = position.initialRiskPrice * closeVolume * valuePerLot;
    const trade: ClosedTrade = {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      volume: closeVolume,
      strategy: position.strategy,
      entryPrice: position.entryPrice,
      closePrice: exitPrice,
      openedAt: position.openedAt,
      closedAt: time,
      grossPnl: Number(grossPnl.toFixed(2)),
      commission: Number(commission.toFixed(2)),
      swap: Number(swap.toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      rMultiple: riskForVolume > 0 ? Number((netPnl / riskForVolume).toFixed(3)) : 0,
      reason
    };

    if (closeVolume >= position.volume - 1e-9) {
      this.positions.delete(position.id);
    } else {
      position.volume = Number((position.volume - closeVolume).toFixed(4));
      position.partialDone = true;
    }

    this.closed.push(trade);
    return trade;
  }

  private floatingPnl(): number {
    let total = 0;
    for (const position of this.positions.values()) {
      const price = this.prices.get(position.symbol);
      if (!price) continue;
      const spec = getSpec(position.symbol);
      const marketPrice = position.side === 'buy' ? price.bid : price.ask;
      const direction = position.side === 'buy' ? 1 : -1;
      total +=
        (marketPrice - position.entryPrice) *
        direction *
        position.volume *
        this.converter.valuePerLotPerPricePoint(spec);
    }
    return total;
  }

  private marginUsed(): number {
    // Simplified 1:30 retail leverage – enough to flag over-sizing, not a
    // substitute for the broker's real margin model.
    let total = 0;
    for (const position of this.positions.values()) {
      const spec = getSpec(position.symbol);
      const notional = position.volume * spec.contractSize * position.entryPrice;
      total += (notional * this.converter.rate(spec.quoteCurrency)) / 30;
    }
    return Number(total.toFixed(2));
  }

  closedTrades(): ClosedTrade[] {
    return [...this.closed];
  }

  currentTime(): number {
    return this.now;
  }
}
