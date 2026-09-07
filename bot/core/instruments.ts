/**
 * Instrument specifications and quote-currency conversion.
 *
 * Position sizing is only as good as these numbers. `contractSize`, `pipSize`
 * and `commissionPerLot` must match what FTMO's MT5 server actually reports –
 * verify them with `getSpecFromBroker()` before going live rather than trusting
 * the defaults below.
 */

import type { InstrumentSpec } from '../types';

const FX_MAJOR = {
  digits: 5,
  pipSize: 0.0001,
  contractSize: 100_000,
  minLot: 0.01,
  maxLot: 50,
  lotStep: 0.01,
  commissionPerLot: 7,
  typicalSpreadPips: 0.6,
  maxSpreadPips: 2.0,
  tradingHoursUtc: { from: 6, to: 21 },
  riskWeight: 1
};

const FX_JPY = {
  ...FX_MAJOR,
  digits: 3,
  pipSize: 0.01,
  maxSpreadPips: 2.2
};

export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  EURUSD: { ...FX_MAJOR, symbol: 'EURUSD', quoteCurrency: 'USD' },
  GBPUSD: { ...FX_MAJOR, symbol: 'GBPUSD', quoteCurrency: 'USD', typicalSpreadPips: 0.9, maxSpreadPips: 2.5 },
  AUDUSD: { ...FX_MAJOR, symbol: 'AUDUSD', quoteCurrency: 'USD', typicalSpreadPips: 0.8, maxSpreadPips: 2.5 },
  NZDUSD: { ...FX_MAJOR, symbol: 'NZDUSD', quoteCurrency: 'USD', typicalSpreadPips: 1.4, maxSpreadPips: 3.0 },
  USDCAD: { ...FX_MAJOR, symbol: 'USDCAD', quoteCurrency: 'CAD', typicalSpreadPips: 1.1, maxSpreadPips: 3.0 },
  USDCHF: { ...FX_MAJOR, symbol: 'USDCHF', quoteCurrency: 'CHF', typicalSpreadPips: 1.1, maxSpreadPips: 3.0 },
  EURGBP: { ...FX_MAJOR, symbol: 'EURGBP', quoteCurrency: 'GBP', typicalSpreadPips: 1.0, maxSpreadPips: 2.8 },
  USDJPY: { ...FX_JPY, symbol: 'USDJPY', quoteCurrency: 'JPY', typicalSpreadPips: 0.7 },
  EURJPY: { ...FX_JPY, symbol: 'EURJPY', quoteCurrency: 'JPY', typicalSpreadPips: 1.2, maxSpreadPips: 3.0 },
  GBPJPY: { ...FX_JPY, symbol: 'GBPJPY', quoteCurrency: 'JPY', typicalSpreadPips: 1.8, maxSpreadPips: 4.0 },
  XAUUSD: {
    symbol: 'XAUUSD',
    digits: 2,
    pipSize: 0.1,
    contractSize: 100,
    minLot: 0.01,
    maxLot: 20,
    lotStep: 0.01,
    commissionPerLot: 7,
    typicalSpreadPips: 2.5,
    maxSpreadPips: 6,
    quoteCurrency: 'USD',
    tradingHoursUtc: { from: 7, to: 20 },
    // Gold is roughly twice as volatile as the FX majors; size it down.
    riskWeight: 0.7
  },
  US100: {
    symbol: 'US100',
    digits: 2,
    pipSize: 1,
    contractSize: 1,
    minLot: 0.1,
    maxLot: 50,
    lotStep: 0.1,
    commissionPerLot: 0,
    typicalSpreadPips: 1.5,
    maxSpreadPips: 5,
    quoteCurrency: 'USD',
    tradingHoursUtc: { from: 13, to: 20 },
    riskWeight: 0.6
  },
  US30: {
    symbol: 'US30',
    digits: 2,
    pipSize: 1,
    contractSize: 1,
    minLot: 0.1,
    maxLot: 50,
    lotStep: 0.1,
    commissionPerLot: 0,
    typicalSpreadPips: 2.5,
    maxSpreadPips: 8,
    quoteCurrency: 'USD',
    tradingHoursUtc: { from: 13, to: 20 },
    riskWeight: 0.6
  },
  GER40: {
    symbol: 'GER40',
    digits: 2,
    pipSize: 1,
    contractSize: 1,
    minLot: 0.1,
    maxLot: 50,
    lotStep: 0.1,
    commissionPerLot: 0,
    typicalSpreadPips: 1.2,
    maxSpreadPips: 4,
    quoteCurrency: 'EUR',
    tradingHoursUtc: { from: 7, to: 20 },
    riskWeight: 0.6
  }
};

export function getSpec(symbol: string): InstrumentSpec {
  const spec = INSTRUMENTS[symbol.toUpperCase()];
  if (!spec) {
    throw new Error(
      `Unknown instrument "${symbol}". Add its specification to bot/core/instruments.ts ` +
        'before trading it – sizing without a verified contract size is unsafe.'
    );
  }
  return spec;
}

export function hasSpec(symbol: string): boolean {
  return Boolean(INSTRUMENTS[symbol.toUpperCase()]);
}

/** Rounds a lot size down to the broker's lot step. */
export function roundLots(volume: number, spec: InstrumentSpec): number {
  const steps = Math.floor(volume / spec.lotStep + 1e-9);
  const rounded = steps * spec.lotStep;
  // Avoid binary float noise like 0.30000000000000004 reaching the broker.
  return Number(rounded.toFixed(4));
}

export function priceToPips(priceDistance: number, spec: InstrumentSpec): number {
  return priceDistance / spec.pipSize;
}

export function pipsToPrice(pips: number, spec: InstrumentSpec): number {
  return pips * spec.pipSize;
}

/**
 * Converts an amount in the instrument's quote currency into the account
 * currency. Rates are updated from live quotes where possible; the static
 * fallbacks only exist so backtests and dry runs remain deterministic.
 */
export class CurrencyConverter {
  private rates = new Map<string, number>();

  constructor(private readonly accountCurrency: string) {
    // Conservative defaults; overwritten by `setRate` as soon as live quotes arrive.
    this.rates.set('USD:USD', 1);
    this.rates.set('EUR:USD', 1.08);
    this.rates.set('GBP:USD', 1.27);
    this.rates.set('CHF:USD', 1.13);
    this.rates.set('CAD:USD', 0.73);
    this.rates.set('JPY:USD', 0.0065);
    this.rates.set('AUD:USD', 0.66);
    this.rates.set('NZD:USD', 0.61);
  }

  setRate(from: string, to: string, rate: number): void {
    if (rate > 0) this.rates.set(`${from}:${to}`, rate);
  }

  /** Multiplier that turns one unit of `quoteCurrency` into account currency. */
  rate(quoteCurrency: string): number {
    if (quoteCurrency === this.accountCurrency) return 1;

    const direct = this.rates.get(`${quoteCurrency}:${this.accountCurrency}`);
    if (direct) return direct;

    const inverse = this.rates.get(`${this.accountCurrency}:${quoteCurrency}`);
    if (inverse) return 1 / inverse;

    // Triangulate through USD when we have both legs.
    const toUsd = this.rates.get(`${quoteCurrency}:USD`);
    const accountToUsd = this.rates.get(`${this.accountCurrency}:USD`);
    if (toUsd && accountToUsd) return toUsd / accountToUsd;

    throw new Error(
      `No conversion rate from ${quoteCurrency} to ${this.accountCurrency}. ` +
        'Register one via CurrencyConverter.setRate() before sizing positions.'
    );
  }

  /** Money value of a 1.0 price move on 1.00 lot, in account currency. */
  valuePerLotPerPricePoint(spec: InstrumentSpec): number {
    return spec.contractSize * this.rate(spec.quoteCurrency);
  }
}
