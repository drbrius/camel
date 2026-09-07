/**
 * Backtest CLI.
 *
 *   npm run bot:backtest                          # synthetic data, quick smoke test
 *   npm run bot:backtest -- --csv data/history    # real data, <SYMBOL>.csv per symbol
 *   npm run bot:backtest -- --walk-forward 6      # out-of-sample consistency check
 *   npm run bot:backtest -- --stress              # doubled spread + heavy slippage
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, validateConfig } from '../config';
import { loadSymbolDirectory } from '../data/csv';
import { generateSeries, startPriceFor } from '../data/synthetic';
import type { Candle } from '../types';
import { runBacktest, runWalkForward } from './backtester';

interface CliArgs {
  csv?: string;
  bars: number;
  walkForward?: number;
  stress: boolean;
  out?: string;
  seed?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { bars: 12_000, stress: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    switch (arg) {
      case '--csv':
        args.csv = value;
        i++;
        break;
      case '--bars':
        args.bars = Number(value);
        i++;
        break;
      case '--walk-forward':
        args.walkForward = Number(value);
        i++;
        break;
      case '--out':
        args.out = value;
        i++;
        break;
      case '--seed':
        args.seed = Number(value);
        i++;
        break;
      case '--stress':
        args.stress = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option ${arg}`);
        }
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  validateConfig(config);

  console.log(`Configuration: ${config.rules.phase} · ${config.rules.accountSize.toLocaleString()} ` +
    `${config.rules.currency} · risk ${config.risk.riskPerTradePct}%/trade · ` +
    `daily stop ${config.risk.dailyHardStopPct}% (FTMO ${config.rules.maxDailyLossPct}%)`);
  console.log(`Symbols: ${config.symbols.join(', ')} · strategies: ${config.strategies.join(', ')}`);

  let data: Record<string, Candle[]>;
  if (args.csv) {
    console.log(`Loading historical data from ${args.csv} …`);
    data = loadSymbolDirectory(args.csv, config.symbols);
  } else {
    console.log(
      `No --csv given: generating ${args.bars} synthetic bars per symbol.\n` +
        '⚠️  Synthetic results say nothing about real edge – they only prove the plumbing works.'
    );
    data = {};
    for (const symbol of config.symbols) {
      data[symbol] = generateSeries({
        symbol,
        bars: args.bars,
        timeframe: config.primaryTimeframe,
        startPrice: startPriceFor(symbol),
        seed: args.seed
      });
    }
  }

  for (const [symbol, candles] of Object.entries(data)) {
    const from = new Date(candles[0].time).toISOString().slice(0, 10);
    const to = new Date(candles[candles.length - 1].time).toISOString().slice(0, 10);
    console.log(`  ${symbol.padEnd(8)} ${String(candles.length).padStart(7)} bars  ${from} → ${to}`);
  }

  const stress = args.stress
    ? { slippagePips: 1.0, spreadMultiplier: 2 }
    : { slippagePips: 0.3, spreadMultiplier: 1 };
  if (args.stress) {
    console.log('\nStress mode: spreads doubled, slippage 1.0 pips.');
  }

  const started = Date.now();

  if (args.walkForward && args.walkForward > 1) {
    const { windows, summary } = await runWalkForward({
      config,
      data,
      windows: args.walkForward,
      ...stress
    });
    console.log(summary);
    console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    if (args.out) writeJson(args.out, windows.map((w) => w.metrics));
    return;
  }

  const result = await runBacktest({ config, data, ...stress });
  console.log(result.report);
  console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (args.out) {
    writeJson(args.out, {
      metrics: result.metrics,
      equityCurve: result.equityCurve,
      trades: result.trades
    });
    console.log(`Full results written to ${args.out}`);
  }

  // A backtest that breached a hard limit must fail loudly, not scroll past.
  if (result.metrics.ftmo.dailyLimitBreached || result.metrics.ftmo.totalLimitBreached) {
    console.error('\n❌ A hard FTMO limit was breached in this backtest. Do not deploy this configuration.');
    process.exit(1);
  }
}

function writeJson(file: string, payload: unknown): void {
  const resolved = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(`\nBacktest failed: ${error?.message ?? error}`);
  process.exit(1);
});
