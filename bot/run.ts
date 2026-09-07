/**
 * Live / paper runner – the 24/7 entry point.
 *
 *   npm run bot            # paper trading on synthetic data (safe default)
 *   npm run bot -- --dry   # live data, decisions logged, no orders sent
 *   BOT_BROKER=metaapi npm run bot   # real FTMO MT5 account via MetaApi
 *
 * The default is deliberately harmless: running this file with no arguments
 * and no environment cannot place a real order.
 */

import 'dotenv/config';
import { loadConfig, validateConfig, type BotConfig } from './config';
import { MetaApiBroker } from './brokers/metaapi';
import { PaperBroker } from './brokers/paper';
import type { Broker } from './brokers/types';
import { Engine } from './core/engine';
import { CurrencyConverter, getSpec } from './core/instruments';
import { Logger } from './core/logger';
import { RiskManager } from './core/risk';
import { StateStore } from './core/state';
import { SyntheticTicker, generateSeries, startPriceFor } from './data/synthetic';
import { createStrategies } from './strategies';
import { TIMEFRAME_MINUTES, type ClosedTrade } from './types';

interface BrokerSetup {
  broker: Broker;
  /** Clock the engine should run on. Paper mode uses the simulated clock. */
  clock?: () => number;
  /** Starts any background feed. Fills are reported through the callback. */
  start?: (onFill: (trade: ClosedTrade) => void) => void;
}

function buildLiveBroker(config: BotConfig, logger: Logger): BrokerSetup {
  logger.warn('Connecting to a LIVE MetaApi account', { accountId: config.metaapi.accountId });
  return {
    broker: new MetaApiBroker({
      token: config.metaapi.token,
      accountId: config.metaapi.accountId,
      region: config.metaapi.region
    })
  };
}

function buildPaperBroker(config: BotConfig, converter: CurrencyConverter, logger: Logger): BrokerSetup {
  const broker = new PaperBroker({
    startingBalance: config.rules.accountSize,
    currency: config.rules.currency,
    converter
  });

  const stepMs = TIMEFRAME_MINUTES[config.primaryTimeframe] * 60_000;
  const tickers: SyntheticTicker[] = [];

  for (const symbol of config.symbols) {
    getSpec(symbol); // fail fast on an unknown symbol
    const candles = generateSeries({
      symbol,
      bars: config.historyBars,
      timeframe: config.primaryTimeframe,
      startPrice: startPriceFor(symbol),
      startTime: Date.now() - config.historyBars * stepMs
    });
    broker.setHistory(symbol, candles);
    if (candles.length > 0) broker.syncCandle(symbol, candles[candles.length - 1]);

    const ticker = new SyntheticTicker(symbol, startPriceFor(symbol));
    ticker.seedFrom(candles);
    tickers.push(ticker);
  }

  logger.info('Paper broker seeded with synthetic history – no real money is at risk', {
    bars: config.historyBars,
    barIntervalMinutes: TIMEFRAME_MINUTES[config.primaryTimeframe]
  });

  return {
    broker,
    // The engine must read the same clock the candles carry, or session
    // filters and the day rollover would disagree with the price series.
    clock: () => broker.currentTime(),
    start: (onFill) => {
      let syntheticTime = Date.now();
      // Bars are emitted on an accelerated clock so a paper session produces
      // meaningful activity in minutes rather than days. Timestamps still
      // advance on the real timeframe grid, so session and day-rollover logic
      // behaves exactly as it will live.
      const interval = setInterval(
        () => {
          syntheticTime += stepMs;
          for (const ticker of tickers) {
            for (const trade of broker.syncCandle(ticker.name, ticker.next(syntheticTime))) {
              onFill(trade);
            }
          }
        },
        Math.max(500, (config.loopIntervalSeconds * 1_000) / 2)
      );
      interval.unref?.();
    }
  };
}

async function main() {
  const dryFlag = process.argv.includes('--dry');
  const config = loadConfig(dryFlag ? { dryRun: true } : {});
  validateConfig(config);

  const logger = new Logger({ dataDir: config.dataDir });
  const converter = new CurrencyConverter(config.rules.currency);
  const store = new StateStore(config.dataDir);

  const risk = new RiskManager({ rules: config.rules, config: config.risk, converter });
  const setup =
    config.broker === 'metaapi'
      ? buildLiveBroker(config, logger)
      : buildPaperBroker(config, converter, logger);
  const { broker } = setup;

  await broker.connect();
  const account = await broker.getAccount();

  // The account we are about to trade must match the rule set we validated
  // against. A 100k rule set on a 10k account would size every trade 10x.
  if (config.broker === 'metaapi') {
    if (Math.abs(account.balance - config.rules.accountSize) > config.rules.accountSize * 0.5) {
      throw new Error(
        `Account balance ${account.balance} ${account.currency} does not match the configured ` +
          `FTMO_ACCOUNT_SIZE of ${config.rules.accountSize}. Fix the configuration before trading.`
      );
    }
    if (account.currency !== config.rules.currency) {
      throw new Error(
        `Account currency ${account.currency} does not match FTMO_CURRENCY=${config.rules.currency}.`
      );
    }
  }

  const levels = risk.levels();
  logger.info('Risk envelope', {
    phase: config.rules.phase,
    accountSize: config.rules.accountSize,
    riskPerTradePct: config.risk.riskPerTradePct,
    internalDailyStop: `${config.risk.dailyHardStopPct}%`,
    ftmoDailyLimit: `${config.rules.maxDailyLossPct}%`,
    ftmoDailyFloor: Number(levels.ftmoDailyFloor.toFixed(2)),
    ftmoTotalFloor: Number(levels.ftmoTotalFloor.toFixed(2)),
    profitTargetEquity: Number(levels.profitTargetEquity.toFixed(2))
  });

  const engine = new Engine({
    config,
    broker,
    strategies: createStrategies(config.strategies),
    risk,
    converter,
    logger,
    store,
    clock: setup.clock
  });

  if (risk.state.killSwitch) {
    logger.error('Kill switch is engaged from a previous session – refusing to start', {
      reason: risk.state.killSwitchReason
    });
    console.error(
      '\nThe kill switch is set. Review the journal, then clear it by deleting ' +
        `${store.path()} or resetting "killSwitch" to false in that file.\n`
    );
    process.exit(1);
  }

  // Fills that happen between iterations (stops, targets) must reach the risk
  // manager, or the daily loss counter and the losing-streak guard go blind.
  setup.start?.((trade) => engine.registerExternalClose(trade));

  await engine.run();
}

main().catch((error) => {
  console.error(`\nBot failed to start: ${error?.message ?? error}`);
  process.exit(1);
});
