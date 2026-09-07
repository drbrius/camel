/**
 * Broker abstraction.
 *
 * The engine only ever talks to this interface, so the exact same strategy and
 * risk code runs against the backtester, the paper broker and a live FTMO MT5
 * account. Anything broker-specific (MetaApi payload shapes, MT5 quirks) stays
 * behind an adapter.
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

export interface Broker {
  readonly name: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getAccount(): Promise<AccountSnapshot>;
  getPositions(): Promise<Position[]>;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, timeframe: Timeframe, count: number): Promise<Candle[]>;

  placeMarketOrder(request: OrderRequest): Promise<Position>;
  modifyPosition(positionId: string, changes: { stopLoss?: number; takeProfit?: number }): Promise<void>;
  closePosition(positionId: string, reason: CloseReason, volume?: number): Promise<ClosedTrade>;
  closeAll(reason: CloseReason): Promise<ClosedTrade[]>;
}

export class BrokerError extends Error {
  constructor(message: string, readonly retryable: boolean = false) {
    super(message);
    this.name = 'BrokerError';
  }
}
