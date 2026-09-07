/**
 * MetaApi adapter – the bridge to a real FTMO MetaTrader 5 account.
 *
 * FTMO trades on MT5, which has no native REST API. MetaApi (metaapi.cloud)
 * hosts an MT5 terminal and exposes it over HTTPS, which is the standard way
 * to drive an FTMO account from Node.
 *
 * IMPORTANT before going live:
 *   - Verify the endpoint paths and payload field names against the current
 *     MetaApi REST documentation. They are stable but not frozen, and a silent
 *     404 here means orders that are never placed.
 *   - Run at least a full week on an FTMO *demo* account first and reconcile
 *     `getPositions()` against the MT5 terminal.
 *   - Confirm the symbol names on your server: FTMO appends suffixes on some
 *     account types (e.g. "EURUSD.raw"), and an unknown symbol fails silently
 *     at the order stage.
 */

import type {
  AccountSnapshot,
  Candle,
  ClosedTrade,
  CloseReason,
  OrderRequest,
  Position,
  Quote,
  Timeframe
} from '../types';
import { type Broker, BrokerError } from './types';

export interface MetaApiOptions {
  token: string;
  accountId: string;
  /** MetaApi region, e.g. "new-york" or "london". */
  region: string;
  /** Milliseconds before a request is abandoned. */
  timeoutMs?: number;
  /** Maps our canonical symbol to the broker's symbol (suffixes etc.). */
  symbolMap?: Record<string, string>;
}

/** MetaTrader timeframe codes used by the MetaApi market-data endpoints. */
const TIMEFRAME_CODE: Record<Timeframe, string> = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d'
};

interface MetaApiPosition {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  time: string;
  comment?: string;
  profit?: number;
}

export class MetaApiBroker implements Broker {
  readonly name = 'metaapi';

  private readonly clientBase: string;
  private readonly marketDataBase: string;
  private readonly timeoutMs: number;
  private readonly symbolMap: Record<string, string>;
  private readonly reverseMap: Record<string, string>;
  /** Local mirror of risk metadata MT5 does not store for us. */
  private meta = new Map<string, { strategy: string; initialRiskPrice: number; riskAmount: number }>();

  constructor(private readonly options: MetaApiOptions) {
    if (!options.token || !options.accountId) {
      throw new BrokerError('MetaApi requires both a token and an account id');
    }
    this.clientBase = `https://mt-client-api-v1.${options.region}.agiliumtrade.ai/users/current/accounts/${options.accountId}`;
    this.marketDataBase = `https://mt-market-data-client-api-v1.${options.region}.agiliumtrade.ai/users/current/accounts/${options.accountId}`;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.symbolMap = options.symbolMap ?? {};
    this.reverseMap = Object.fromEntries(Object.entries(this.symbolMap).map(([k, v]) => [v, k]));
  }

  private brokerSymbol(symbol: string): string {
    return this.symbolMap[symbol] ?? symbol;
  }

  private canonicalSymbol(symbol: string): string {
    return this.reverseMap[symbol] ?? symbol;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'auth-token': this.options.token,
          'content-type': 'application/json',
          ...(init.headers ?? {})
        }
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        // 429 and 5xx are transient; the engine retries those with backoff.
        const retryable = response.status === 429 || response.status >= 500;
        throw new BrokerError(`MetaApi ${response.status} on ${url}: ${body.slice(0, 400)}`, retryable);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error: any) {
      if (error instanceof BrokerError) throw error;
      // Network-level failures are always worth retrying.
      throw new BrokerError(`MetaApi request failed: ${error?.message ?? error}`, true);
    } finally {
      clearTimeout(timer);
    }
  }

  async connect(): Promise<void> {
    // A successful account-information call proves token, account id and region.
    await this.getAccount();
  }

  async disconnect(): Promise<void> {}

  async getAccount(): Promise<AccountSnapshot> {
    const info = await this.request<{
      balance: number;
      equity: number;
      margin: number;
      freeMargin: number;
      currency: string;
    }>(`${this.clientBase}/account-information`);

    return {
      time: Date.now(),
      balance: info.balance,
      equity: info.equity,
      marginUsed: info.margin,
      marginFree: info.freeMargin,
      currency: info.currency
    };
  }

  async getPositions(): Promise<Position[]> {
    const raw = await this.request<MetaApiPosition[]>(`${this.clientBase}/positions`);

    return raw.map((item) => {
      const symbol = this.canonicalSymbol(item.symbol);
      const meta = this.meta.get(item.id);
      const stopLoss = item.stopLoss ?? item.openPrice;
      return {
        id: item.id,
        symbol,
        side: item.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
        volume: item.volume,
        entryPrice: item.openPrice,
        stopLoss,
        takeProfit: item.takeProfit,
        openedAt: new Date(item.time).getTime(),
        strategy: meta?.strategy ?? 'external',
        initialRiskPrice: meta?.initialRiskPrice ?? Math.abs(item.openPrice - stopLoss),
        riskAmount: meta?.riskAmount ?? 0,
        breakEvenDone: false,
        partialDone: false,
        trailAnchor: item.openPrice,
        comment: item.comment
      } satisfies Position;
    });
  }

  async getQuote(symbol: string): Promise<Quote> {
    const price = await this.request<{ bid: number; ask: number; time: string }>(
      `${this.clientBase}/symbols/${encodeURIComponent(this.brokerSymbol(symbol))}/current-price`
    );
    return {
      symbol,
      time: new Date(price.time).getTime(),
      bid: price.bid,
      ask: price.ask
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    const url =
      `${this.marketDataBase}/historical-market-data/symbols/${encodeURIComponent(this.brokerSymbol(symbol))}` +
      `/timeframes/${TIMEFRAME_CODE[timeframe]}/candles?limit=${Math.min(count, 1000)}`;

    const raw = await this.request<
      Array<{ time: string; open: number; high: number; low: number; close: number; tickVolume: number }>
    >(url);

    return raw
      .map((c) => ({
        time: new Date(c.time).getTime(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.tickVolume
      }))
      .sort((a, b) => a.time - b.time);
  }

  async placeMarketOrder(request: OrderRequest): Promise<Position> {
    const payload = {
      actionType: request.side === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      symbol: this.brokerSymbol(request.symbol),
      volume: request.volume,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      comment: (request.comment ?? request.strategy).slice(0, 31)
    };

    const result = await this.request<{ orderId?: string; positionId?: string; stringCode?: string }>(
      `${this.clientBase}/trade`,
      { method: 'POST', body: JSON.stringify(payload) }
    );

    if (result.stringCode && !['TRADE_RETCODE_DONE', 'ERR_NO_ERROR'].includes(result.stringCode)) {
      throw new BrokerError(`order rejected by the server: ${result.stringCode}`);
    }

    const positionId = result.positionId ?? result.orderId;
    if (!positionId) {
      throw new BrokerError('order accepted but no position id was returned – reconcile manually');
    }

    this.meta.set(positionId, {
      strategy: request.strategy,
      initialRiskPrice: request.initialRiskPrice,
      riskAmount: request.riskAmount
    });

    // Read the position back so entry price and volume come from the server,
    // never from our own assumptions about the fill.
    const positions = await this.getPositions();
    const opened = positions.find((p) => p.id === positionId);
    if (!opened) {
      throw new BrokerError(`position ${positionId} not found after placement – reconcile manually`);
    }
    return opened;
  }

  async modifyPosition(
    positionId: string,
    changes: { stopLoss?: number; takeProfit?: number }
  ): Promise<void> {
    await this.request(`${this.clientBase}/trade`, {
      method: 'POST',
      body: JSON.stringify({
        actionType: 'POSITION_MODIFY',
        positionId,
        stopLoss: changes.stopLoss,
        takeProfit: changes.takeProfit
      })
    });
  }

  async closePosition(positionId: string, reason: CloseReason, volume?: number): Promise<ClosedTrade> {
    const before = (await this.getPositions()).find((p) => p.id === positionId);
    if (!before) throw new BrokerError(`unknown position ${positionId}`);

    await this.request(`${this.clientBase}/trade`, {
      method: 'POST',
      body: JSON.stringify(
        volume === undefined
          ? { actionType: 'POSITION_CLOSE_ID', positionId }
          : { actionType: 'POSITION_PARTIAL', positionId, volume }
      )
    });

    const quote = await this.getQuote(before.symbol);
    const closePrice = before.side === 'buy' ? quote.bid : quote.ask;
    const direction = before.side === 'buy' ? 1 : -1;
    // Approximate: MT5 books the authoritative PnL in the deal history. This
    // value is for the journal only – account state always comes from
    // `getAccount()`, never from this number.
    const grossPnl = (closePrice - before.entryPrice) * direction * before.volume;

    if (volume === undefined) this.meta.delete(positionId);

    return {
      id: positionId,
      symbol: before.symbol,
      side: before.side,
      volume: volume ?? before.volume,
      strategy: before.strategy,
      entryPrice: before.entryPrice,
      closePrice,
      openedAt: before.openedAt,
      closedAt: Date.now(),
      grossPnl,
      commission: 0,
      swap: 0,
      netPnl: grossPnl,
      rMultiple:
        before.initialRiskPrice > 0
          ? ((closePrice - before.entryPrice) * direction) / before.initialRiskPrice
          : 0,
      reason
    };
  }

  async closeAll(reason: CloseReason): Promise<ClosedTrade[]> {
    const positions = await this.getPositions();
    const results: ClosedTrade[] = [];
    for (const position of positions) {
      results.push(await this.closePosition(position.id, reason));
    }
    return results;
  }
}
