import fs from 'fs';
import path from 'path';
import { ServerLog, TradeCalculationResult, DBStats, TradeItemCategory } from '../src/types';

// Establish paths for simulated PostgreSQL file storage and server logging
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'posgres_sim_db.json');
const LOG_FILE = path.join(DATA_DIR, 'server.log');

// Ensure database and logs folder exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Write empty structures if not present
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ trades: [], logCount: 0 }, null, 2));
}

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] [INFO] Core simulated PostgreSQL cluster initialized successfully.\n`);
}

// PostgreSQL real schema definition for production reuse
export const POSTGRES_SCHEMA = `
-- Optimized PostgreSQL Production-Ready Schema for Camel Trade Calculator
-- Run this directly inside psql, RDS, or Cloud SQL

CREATE TABLE IF NOT EXISTS camel_breeds (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    scientific_name VARCHAR(100),
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    speed VARCHAR(50),
    temperament VARCHAR(50),
    description TEXT,
    rarity VARCHAR(20) NOT NULL DEFAULT 'Common'
);

CREATE TABLE IF NOT EXISTS trade_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category VARCHAR(50) NOT NULL,
    breed_id VARCHAR(50) REFERENCES camel_breeds(id),
    camel_count INT NOT NULL CHECK (camel_count >= 0),
    deal_grade VARCHAR(50) NOT NULL,
    input_details JSONB NOT NULL,
    formula_breakdown TEXT[] NOT NULL
);

-- Advanced Indexing for Enterprise Scalability and Query Optimization
CREATE INDEX IF NOT EXISTS idx_trades_category ON trade_calculations (category);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trade_calculations (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_breed_id ON trade_calculations (breed_id);
CREATE INDEX IF NOT EXISTS idx_trades_camel_count ON trade_calculations (camel_count DESC);
CREATE INDEX IF NOT EXISTS idx_trades_composite_analytics ON trade_calculations (category, camel_count);

-- Logging and Audit Trigger Setup
CREATE TABLE IF NOT EXISTS system_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    duration_ms NUMERIC(10,2),
    query_text TEXT
);

CREATE OR REPLACE FUNCTION audit_trade_calculation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO system_activity_logs (level, message, duration_ms)
    VALUES ('INFO', 'Audit Trigger Activated: Insert executed on trade_calculations with ID ' || NEW.id, 0.15);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_trades
AFTER INSERT ON trade_calculations
FOR EACH ROW
EXECUTE FUNCTION audit_trade_calculation();
`;

// In-Memory Connection Pool states
let activeConnections = 0;
const MAX_POOL_SIZE = 15;
let cacheHits = 0;
let queryCount = 0;

function appendSystemLog(level: 'INFO' | 'WARN' | 'ERROR' | 'QUERY', message: string, durationMs?: number, query?: string) {
  const timestamp = new Date().toISOString();
  const logObj: ServerLog = {
    id: `log_${Math.random().toString(36).substring(2, 9)}`,
    timestamp,
    level,
    message,
    durationMs,
    query
  };
  
  const logLine = `[${timestamp}] [${level}] ${message}` + 
    (durationMs ? ` (Latency: ${durationMs.toFixed(2)}ms)` : '') + 
    (query ? ` | SQL: "${query}"` : '') + '\n';
  
  fs.appendFileSync(LOG_FILE, logLine);
  return logObj;
}

export class DBManager {
  // Premium subscription state accessors
  static getPremiumStatus(): boolean {
    try {
      if (!fs.existsSync(DB_FILE)) return false;
      const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return !!dbData.premiumUnlocked;
    } catch {
      return false;
    }
  }

  static setPremiumStatus(status: boolean): void {
    try {
      const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      dbData.premiumUnlocked = status;
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    } catch (err) {
      console.error('Failed to write premium status:', err);
    }
  }

  // DB query implementation with telemetry audit logs
  static async query<T>(sql: string, params: any[] = []): Promise<{ rows: T[]; explain: string[] }> {
    queryCount++;
    const startTime = performance.now();
    activeConnections++;
    
    // Simulate connection pool acquisition throttling
    if (activeConnections > MAX_POOL_SIZE) {
      appendSystemLog('WARN', 'PostgreSQL Connection pool exhausted! Queue delay triggered.', 12.5);
    }
    
    // Simulating index resolution and query plan
    let queryPlan = 'Seq Scan on trade_calculations';
    let indexUsed = 'None';
    
    if (sql.includes('INDEX') || sql.includes('WHERE category') || sql.includes('GROUP BY category')) {
      indexUsed = 'idx_trades_category';
      queryPlan = `Index Scan using idx_trades_category on trade_calculations (cost=0.15..12.50 rows=15 width=48)`;
    } else if (sql.includes('ORDER BY timestamp DESC')) {
      indexUsed = 'idx_trades_timestamp';
      queryPlan = `Index Only Scan backward using idx_trades_timestamp on trade_calculations (cost=0.20..35.40 rows=50 width=32)`;
    } else if (sql.includes('camel_count DESC')) {
      indexUsed = 'idx_trades_camel_count';
      queryPlan = `Index Scan using idx_trades_camel_count on trade_calculations (cost=0.15..45.20 rows=100 width=164)`;
    }

    const explainLogs = [
      `QUERY PLAN:`,
      `->  ${queryPlan}`,
      `    Index Cond: (matching criteria applied)`,
      `    Planning Time: 0.124 ms`,
      `    Execution Time: ${(performance.now() - startTime).toFixed(3)} ms`,
      `    Index Used: ${indexUsed}`,
      `    Simulated Connection Pool Usage: ${activeConnections}/${MAX_POOL_SIZE} active connections`
    ];

    // Read local database json file
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    activeConnections = Math.max(0, activeConnections - 1);
    
    const duration = performance.now() - startTime;
    appendSystemLog('QUERY', sql, duration, `${sql} [params: ${JSON.stringify(params)}]`);
    
    return {
      rows: dbData.trades as unknown as T[],
      explain: explainLogs
    };
  }

  // Insert trade calculation result into database
  static async insertTrade(trade: TradeCalculationResult): Promise<TradeCalculationResult> {
    const startTime = performance.now();
    
    // Database access
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    dbData.trades.unshift(trade);
    
    // Maintain database safe limits (delete older if excessive to keep local filesystem lean)
    if (dbData.trades.length > 500) {
      dbData.trades = dbData.trades.slice(0, 500);
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    
    const duration = performance.now() - startTime;
    appendSystemLog(
      'INFO', 
      `Successfully inserted trade result ID: ${trade.id} with ${trade.camelCount} camels for category ${trade.category}`,
      duration,
      `INSERT INTO trade_calculations (id, timestamp, category, breed_id, camel_count, deal_grade, formula_breakdown) VALUES ('${trade.id}', NOW(), '${trade.category}', '${trade.breedId}', ${trade.camelCount}, '${trade.dealGrade}', ARRAY[...]);`
    );
    
    return trade;
  }

  // Clear system db (mainly for diagnostics/dev refresh)
  static async clearAll(): Promise<void> {
    const dbData = { trades: [], logCount: 0 };
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    appendSystemLog('WARN', 'RESET TABLE trade_calculations executed by Administrator; database cleared.');
  }

  // Retrieve advanced database reports
  static async getStats(): Promise<DBStats> {
    const startTime = performance.now();
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const trades: TradeCalculationResult[] = dbData.trades;
    
    const stats: DBStats = {
      totalTrades: trades.length,
      byCategory: {
        car: 0,
        wife_girlfriend: 0,
        husband_boyfriend: 0,
        device: 0,
        soul: 0
      },
      byBreed: {},
      averageCamels: 0,
      totalErrors: 0,
      dbSizeKb: 0,
      cacheHitRatio: 0
    };

    let totalCamels = 0;
    trades.forEach((t) => {
      if (stats.byCategory[t.category] !== undefined) {
        stats.byCategory[t.category]++;
      }
      stats.byBreed[t.breedId] = (stats.byBreed[t.breedId] || 0) + 1;
      totalCamels += t.camelCount;
    });

    if (trades.length > 0) {
      stats.averageCamels = Math.round((totalCamels / trades.length) * 10) / 10;
    }

    // Read logs count
    const systemLogs = fs.readFileSync(LOG_FILE, 'utf-8');
    const logsLines = systemLogs.split('\n');
    stats.totalErrors = logsLines.filter(line => line.includes('[ERROR]')).length;

    // Simulated filesystem statistics
    const statsObj = fs.statSync(DB_FILE);
    stats.dbSizeKb = Math.round((statsObj.size / 1024) * 10) / 10;
    
    // Simulated index cache efficiency ratios
    cacheHits += Math.floor(Math.random() * 2) + 1;
    stats.cacheHitRatio = Math.round((cacheHits / (cacheHits + queryCount || 1)) * 100);

    const duration = performance.now() - startTime;
    appendSystemLog(
      'QUERY', 
      'SELECT COUNT(*), AVG(camel_count), category, breed_id FROM trade_calculations GROUP BY category, breed_id;',
      duration
    );

    return stats;
  }

  // Fetch log lines
  static getLogs(limit = 100): string[] {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-limit).reverse();
  }

  // Write custom log line from routes
  static logDirectly(level: 'INFO' | 'WARN' | 'ERROR' | 'QUERY', message: string, duration?: number) {
    appendSystemLog(level, message, duration);
  }
}
