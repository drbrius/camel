import { TradeCalculationResult, DBStats, TradeItemCategory } from '../types';
import { calculateCamels } from './calculator';

// Standard schema SQL to return
export const SQL_SCHEMA = `CREATE TABLE IF NOT EXISTS trade_calculations (
    id VARCHAR(100) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(50) NOT NULL,
    breed_id VARCHAR(50) NOT NULL,
    breed_name VARCHAR(100) NOT NULL,
    camel_count INTEGER NOT NULL,
    deal_grade VARCHAR(100) NOT NULL,
    formula_breakdown TEXT[] NOT NULL,
    input_summary TEXT NOT NULL,
    pro_analysis_unlocked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_trades_category_timestamp 
ON trade_calculations (category, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_trades_camel_count 
ON trade_calculations (camel_count DESC);`;

// Initial dummy trades to seed database if empty
const SEED_TRADES: TradeCalculationResult[] = [
  {
    id: 'trade_seed1',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    category: 'car',
    breedId: 'dromedary',
    breedName: 'Arabian Dromedary',
    camelCount: 18,
    dealGrade: '🥈 High Oasis Merchant',
    formulaBreakdown: [
      '🚗 Standard commuter sedan base tier: +12 camels.',
      '📅 Modern digital dashboard year bonus (>= 2018): +5 camels.',
      '🧼 Pristine, wax-coated exterior condition: x1.5 multiplier.'
    ],
    inputSummary: '2020 sedan (excellent condition, fueled by gasoline)',
    proAnalysisUnlocked: false
  },
  {
    id: 'trade_seed2',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    category: 'wife_girlfriend',
    breedId: 'bactrian',
    breedName: 'Double-Humped Bactrian',
    camelCount: 48,
    dealGrade: '🥇 Golden Sultan Deal',
    formulaBreakdown: [
      '👩 Partner base caravan tier: +25 camels.',
      '💡 Highly integrated intelligence & balance bracket (26-35): +15 camels.',
      '🔥 Elegant rare hair color (red): +3 camels.',
      '🐫 Selected Breed Multiplier [Double-Humped Bactrian (x1.4)]: Calculated core camel output.'
    ],
    inputSummary: '29-year-old partner, red hair, green eyes, cooking: average',
    proAnalysisUnlocked: true
  }
];

// Helper to write a system log line
export function appendLocalLog(level: 'INFO' | 'WARN' | 'ERROR' | 'QUERY', message: string, durationMs?: number) {
  const timestamp = new Date().toISOString();
  const rawLogs = localStorage.getItem('camel_sim_logs');
  const logsList: string[] = rawLogs ? JSON.parse(rawLogs) : [];
  
  const durationStr = durationMs !== undefined ? ` (${durationMs}ms)` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${durationStr}`;
  
  // Keep last 150 logs to prevent memory overflow
  const newLogs = [logLine, ...logsList].slice(0, 150);
  localStorage.setItem('camel_sim_logs', JSON.stringify(newLogs));
}

// Initialize datastores
export function initializeLocalDb() {
  if (!localStorage.getItem('camel_trades')) {
    localStorage.setItem('camel_trades', JSON.stringify(SEED_TRADES));
    appendLocalLog('INFO', 'Database tables partitioned and initialized successfully on device cluster.');
    appendLocalLog('INFO', 'Seeded camel_trades table with typical historical samples.');
  }
  if (!localStorage.getItem('camel_premium_unlocked')) {
    localStorage.setItem('camel_premium_unlocked', 'false');
  }
  if (!localStorage.getItem('camel_sim_logs')) {
    localStorage.setItem('camel_sim_logs', JSON.stringify([
      `[${new Date().toISOString()}] [INFO] PostgreSQL 15.4 Emulator Server online at port 5432`
    ]));
  }
}

// Get premium status
export function getPremiumStatus(): boolean {
  initializeLocalDb();
  return localStorage.getItem('camel_premium_unlocked') === 'true';
}

// Set premium status
export function setPremiumStatus(status: boolean) {
  localStorage.setItem('camel_premium_unlocked', status ? 'true' : 'false');
  appendLocalLog('INFO', `Camel Pro premium licensing key verified. License: ${status ? 'UNLOCKED' : 'LOCKED'}`);
}

// Clear all trades & logs
export function resetLocalDb() {
  localStorage.setItem('camel_trades', JSON.stringify([]));
  localStorage.setItem('camel_premium_unlocked', 'false');
  localStorage.setItem('camel_sim_logs', JSON.stringify([
    `[${new Date().toISOString()}] [INFO] DATABASE CLEAN: Truncated tables trade_calculations;`
  ]));
  appendLocalLog('WARN', 'Purged all user appraisal records from local cache index.');
}

// Get trades (optionally filtered by category)
export function getLocalTrades(categoryFilter?: string): { 
  data: TradeCalculationResult[]; 
  sqlUsed: string; 
  explainPlan: string[] 
} {
  initializeLocalDb();
  const rawTrades = localStorage.getItem('camel_trades');
  let data: TradeCalculationResult[] = rawTrades ? JSON.parse(rawTrades) : [];
  
  // Sort reverse-chronological by default
  data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let sqlUsed = 'SELECT * FROM trade_calculations ORDER BY timestamp DESC;';
  
  if (categoryFilter) {
    data = data.filter(item => item.category === categoryFilter);
    sqlUsed = `SELECT * FROM trade_calculations WHERE category = '${categoryFilter}' ORDER BY timestamp DESC;`;
  }

  // Simulate EXPLAIN ANALYZE
  const cost = 10 + data.length * 1.5;
  const explainPlan = [
    `Limit  (cost=0.00..${cost.toFixed(2)} rows=${data.length} width=248)`,
    `  ->  Index Scan Backward using idx_trades_category_timestamp on trade_calculations  (cost=0.00..${cost.toFixed(2)} rows=${data.length} width=248)`,
    categoryFilter ? `        Index Cond: (category = '${categoryFilter}'::text)` : '        Filter: (true)',
    `Planning Time: 0.182 ms`,
    `Execution Time: ${(0.3 + data.length * 0.1).toFixed(3)} ms`
  ];

  appendLocalLog('QUERY', sqlUsed, Math.round(1 + data.length * 0.1));

  return {
    data,
    sqlUsed,
    explainPlan
  };
}

// Insert single trade
export function insertLocalTrade(input: any): TradeCalculationResult {
  initializeLocalDb();
  const rawTrades = localStorage.getItem('camel_trades');
  const trades: TradeCalculationResult[] = rawTrades ? JSON.parse(rawTrades) : [];
  
  const result = calculateCamels(input);
  
  trades.unshift(result);
  localStorage.setItem('camel_trades', JSON.stringify(trades));

  const runMs = Math.round(12 + Math.random() * 8);
  const sql = `INSERT INTO trade_calculations (id, timestamp, category, breed_id, breed_name, camel_count, deal_grade, formula_breakdown, input_summary, pro_analysis_unlocked) VALUES ('${result.id}', '${result.timestamp}', '${result.category}', '${result.breedId}', '${result.breedName}', ${result.camelCount}, '${result.dealGrade}', ARRAY[...], '${result.inputSummary.replace(/'/g, "''")}', FALSE);`;
  
  appendLocalLog('QUERY', sql, runMs);
  appendLocalLog('INFO', `Inserted appraisal node '${result.id}' into caravan index pool.`);

  return result;
}

// Calculate enterprise database analytics
export function getLocalAnalytics(): DBStats {
  initializeLocalDb();
  const rawTrades = localStorage.getItem('camel_trades');
  const trades: TradeCalculationResult[] = rawTrades ? JSON.parse(rawTrades) : [];

  const totalTrades = trades.length;
  
  const byCategory: Record<TradeItemCategory, number> = {
    car: 0,
    wife_girlfriend: 0,
    husband_boyfriend: 0,
    device: 0,
    soul: 0
  };

  const byBreed: Record<string, number> = {};

  let sumCamels = 0;
  trades.forEach(t => {
    if (byCategory[t.category] !== undefined) {
      byCategory[t.category]++;
    }
    byBreed[t.breedId] = (byBreed[t.breedId] || 0) + 1;
    sumCamels += t.camelCount;
  });

  const averageCamels = totalTrades > 0 ? parseFloat((sumCamels / totalTrades).toFixed(2)) : 0;
  
  // Calculate size in Kb based on character length
  const dbSizeKb = Math.round(Math.max(12, (rawTrades?.length || 0) / 1024));

  // Sim cache metrics
  const cacheHitRatio = totalTrades > 0 ? 0.94 : 1.0;

  appendLocalLog('QUERY', 'SELECT COUNT(*), AVG(camel_count), category FROM trade_calculations GROUP BY category;', 8);

  return {
    totalTrades,
    byCategory,
    byBreed,
    averageCamels,
    totalErrors: 0,
    dbSizeKb,
    cacheHitRatio
  };
}

// Get system logs for displaying in logger
export function getLocalLogs(): string[] {
  initializeLocalDb();
  const rawLogs = localStorage.getItem('camel_sim_logs');
  return rawLogs ? JSON.parse(rawLogs) : [];
}
