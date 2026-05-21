import { useState, useEffect } from 'react';
import { Terminal, Database, RefreshCw, Layers, Cpu, Code } from 'lucide-react';
import { getLocalLogs, SQL_SCHEMA } from '../utils/localDb';

interface LogMessage {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'QUERY';
  message: string;
  durationMs?: number;
  query?: string;
}

export default function ServerLogger() {
  const [logs, setLogs] = useState<string[]>([]);
  const [schemaStr, setSchemaStr] = useState<string>('');
  const [showSchema, setShowSchema] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    try {
      const logsList = getLocalLogs();
      setLogs(logsList);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchema = () => {
    try {
      setSchemaStr(SQL_SCHEMA);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchSchema();
    const interval = setInterval(fetchLogs, 4000); // Poll every 4 seconds for immediate trace feedback
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="trace-logs-panel" className="border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 rounded-2xl p-5 font-mono text-xs shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="font-sans font-bold text-sm tracking-tight text-white flex items-center gap-2">
            <Database size={15} className="text-amber-500" />
            <span>PostgreSQL Sim Pool Telemetry</span>
          </h3>
          <p className="font-sans text-[11px] text-zinc-400 mt-0.5">
            Real-time execution diagnostics, cluster health, and index planner maps
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSchema(!showSchema)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all flex items-center gap-1 text-[11px] font-sans font-medium hover:text-white cursor-pointer"
          >
            <Code size={12} className="text-amber-500" />
            <span>{showSchema ? 'Hide SQL Schema' : 'Show DB Schema'}</span>
          </button>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white cursor-pointer"
            title="Refresh Logs Connection"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showSchema && (
        <div className="space-y-2 border-b border-zinc-850 pb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
            <Layers size={12} />
            <span>PostgreSQL Enterprise Data Definition (DDL) Script</span>
          </div>
          <pre className="p-3 bg-zinc-900 text-zinc-300 rounded-xl max-h-60 overflow-y-auto leading-relaxed border border-zinc-850 overflow-x-auto text-[10px]">
            {schemaStr}
          </pre>
          <p className="font-sans text-[10px] text-zinc-400 leading-normal">
            💡 This script implements indexing optimizations (composite, conditional, cluster index keys) matching our optimized PostgreSQL design target. Use this when connecting a production database!
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">
          QUERY PLANNING & SYSTEM TRANSACTION FLOW
        </label>
        <div className="p-3 bg-zinc-900 rounded-xl space-y-2 max-h-64 overflow-y-auto border border-zinc-850 text-[11px]">
          {logs.length === 0 ? (
            <p className="text-zinc-500 italic py-2">Waiting for transaction packets to commit...</p>
          ) : (
            logs.map((log, idx) => {
              let color = 'text-zinc-300';
              if (log.includes('[ERROR]')) color = 'text-rose-400 font-bold';
              else if (log.includes('[WARN]')) color = 'text-amber-400 font-bold';
              else if (log.includes('[QUERY]')) color = 'text-blue-400';
              
              return (
                <div key={idx} className={`leading-relaxed whitespace-pre-wrap ${color}`}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-400 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850/50">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Postgres Status: ONLINE</span>
        </span>
        <span>•</span>
        <span>Pool Size: 15 Max</span>
        <span>•</span>
        <span>Sim Driver: Node native persistent JSON</span>
        <span>•</span>
        <span className="text-amber-400 font-semibold">Active indexes: 5</span>
      </div>
    </div>
  );
}
