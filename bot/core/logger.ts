/**
 * Structured logger. Everything the bot decides is written to disk so that a
 * failed challenge can be reconstructed line by line afterwards.
 */

import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'TRADE' | 'RISK';

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  TRADE: 25,
  RISK: 30,
  WARN: 30,
  ERROR: 40
};

/**
 * EPIPE on stdout/stderr surfaces as an asynchronous stream error, not a
 * thrown exception, and an unhandled one terminates the process. A bot with
 * open positions must never die because its console went away, so the
 * handlers are installed once, on first use.
 */
let pipeGuardsInstalled = false;
function installPipeGuards(): void {
  if (pipeGuardsInstalled) return;
  pipeGuardsInstalled = true;
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error: NodeJS.ErrnoException) => {
      if (error?.code !== 'EPIPE') throw error;
    });
  }
}

export interface LoggerOptions {
  dataDir: string;
  /** Minimum level written to stdout. Everything is always written to file. */
  consoleLevel?: LogLevel;
  /** Silence stdout entirely – used by the backtester. */
  silent?: boolean;
}

export class Logger {
  private readonly logFile: string;
  private readonly consoleLevel: number;
  private readonly silent: boolean;

  constructor(options: LoggerOptions) {
    installPipeGuards();
    const dir = path.resolve(process.cwd(), options.dataDir);
    fs.mkdirSync(dir, { recursive: true });
    this.logFile = path.join(dir, 'bot.log');
    this.consoleLevel = LEVEL_ORDER[options.consoleLevel ?? 'INFO'];
    this.silent = options.silent ?? false;
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const suffix = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    const line = `[${timestamp}] [${level}] ${message}${suffix}\n`;

    try {
      fs.appendFileSync(this.logFile, line);
    } catch {
      // Never let logging failures kill a running trading session.
    }

    if (!this.silent && LEVEL_ORDER[level] >= this.consoleLevel) {
      try {
        const stream = level === 'ERROR' || level === 'WARN' ? process.stderr : process.stdout;
        stream.write(line);
      } catch {
        // A closed stdout (piped into `head`, a detached terminal, a killed
        // log collector) raises EPIPE. A trading bot must survive losing its
        // console – the file log is the record that matters.
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.write('DEBUG', message, context);
  }
  info(message: string, context?: Record<string, unknown>) {
    this.write('INFO', message, context);
  }
  warn(message: string, context?: Record<string, unknown>) {
    this.write('WARN', message, context);
  }
  error(message: string, context?: Record<string, unknown>) {
    this.write('ERROR', message, context);
  }
  /** Order placements, fills and closes. */
  trade(message: string, context?: Record<string, unknown>) {
    this.write('TRADE', message, context);
  }
  /** Every risk decision that blocks or halts trading. */
  risk(message: string, context?: Record<string, unknown>) {
    this.write('RISK', message, context);
  }
}

/** No-op logger for unit tests and tight backtest loops. */
export const nullLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  trade() {},
  risk() {}
} as unknown as Logger;
