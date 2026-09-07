/**
 * Durable state.
 *
 * A 24/7 bot will be restarted – deployments, container recycles, crashes. If
 * the daily loss counter resets on restart, the loss limit resets with it, and
 * a restart loop can walk straight through the FTMO daily limit. Risk state is
 * therefore written to disk after every iteration and reloaded on boot.
 */

import fs from 'fs';
import path from 'path';
import type { ClosedTrade, RiskState } from '../types';

export interface PersistedState {
  version: number;
  savedAt: string;
  risk: RiskState;
  /** Rolling trade journal, newest last. */
  journal: ClosedTrade[];
}

const STATE_VERSION = 1;
const MAX_JOURNAL_ENTRIES = 2_000;

export class StateStore {
  private readonly file: string;
  private readonly journalFile: string;

  constructor(dataDir: string) {
    const dir = path.resolve(process.cwd(), dataDir);
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'state.json');
    this.journalFile = path.join(dir, 'trades.jsonl');
  }

  load(): PersistedState | null {
    if (!fs.existsSync(this.file)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8')) as PersistedState;
      if (parsed.version !== STATE_VERSION) return null;
      return parsed;
    } catch {
      // A corrupt state file must not silently become "fresh start with a full
      // loss budget" – the caller decides, and we surface it as a null.
      return null;
    }
  }

  save(risk: RiskState, journal: ClosedTrade[]): void {
    const payload: PersistedState = {
      version: STATE_VERSION,
      savedAt: new Date().toISOString(),
      risk,
      journal: journal.slice(-MAX_JOURNAL_ENTRIES)
    };

    // Write-then-rename so a crash mid-write cannot leave a truncated file.
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(payload, null, 2));
    fs.renameSync(temp, this.file);
  }

  /** Appends one closed trade to the append-only journal. */
  appendTrade(trade: ClosedTrade): void {
    try {
      fs.appendFileSync(this.journalFile, `${JSON.stringify(trade)}\n`);
    } catch {
      // The journal is for analysis; losing a line must never stop trading.
    }
  }

  readJournal(): ClosedTrade[] {
    if (!fs.existsSync(this.journalFile)) return [];
    return fs
      .readFileSync(this.journalFile, 'utf-8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as ClosedTrade;
        } catch {
          return null;
        }
      })
      .filter((t): t is ClosedTrade => t !== null);
  }

  path(): string {
    return this.file;
  }
}
