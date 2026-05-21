import { useState, useEffect } from 'react';
import { DBStats, TradeItemCategory } from '../types';
import { Sparkles, CheckCircle2, DollarSign, BarChart3, TrendingUp, ShieldAlert, Cpu } from 'lucide-react';

export default function CamelProAnalytics() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isUnlocked) {
      setLoading(true);
      fetch('/api/analytics')
        .then(res => res.json())
        .then(data => {
          setStats(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isUnlocked]);

  // Handle premium upgrade
  const handleUnlockTrial = () => {
    setIsUnlocked(true);
  };

  const formatCategoryLabel = (category: string) => {
    switch (category) {
      case 'car': return 'Cars 🚗';
      case 'wife_girlfriend': return 'Wives / Girlfriends 👩';
      case 'husband_boyfriend': return 'Husbands / Boyfriends 👨';
      case 'device': return 'Devices 📱';
      case 'soul': return 'Souls 🔮';
      default: return category;
    }
  };

  const formatBreedId = (id: string) => {
    return id.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div id="camel-pro-analytics-card" className="border border-amber-200 dark:border-zinc-800 bg-gradient-to-br from-amber-50/45 to-white dark:from-zinc-900/45 dark:to-zinc-900 rounded-2xl shadow-sm p-6 overflow-hidden relative">
      
      {/* Premium Badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-amber-600 dark:bg-amber-500 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full shadow-sm">
        <Sparkles size={11} />
        <span>PRO SUITE</span>
      </div>

      <div className="mb-6 space-y-1">
        <h3 className="font-sans font-bold text-lg text-amber-900 dark:text-amber-100">
          Camel Pro Analytics™
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Unlock enterprise trade reports, market indexes, and active connection metrics
        </p>
      </div>

      {!isUnlocked ? (
        // Premium Paywall Screen
        <div id="pro-paywall-screen" className="py-6 flex flex-col items-center text-center space-y-6 max-w-lg mx-auto">
          <div className="p-4 bg-amber-100/60 dark:bg-amber-950/40 rounded-full border border-amber-200/55 text-amber-800 dark:text-amber-400">
            <TrendingUp size={36} />
          </div>

          <div className="space-y-2">
            <h4 className="font-sans font-bold text-gray-800 dark:text-gray-100 text-base">
              Activate Market Intelligence Reports
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Why settle for simple calculations? Join elite camel merchants and gain premium visibility into global asset distributions, real-time index calibrations, and active PostgreSQL execution plans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left text-xs bg-amber-50/40 dark:bg-zinc-900/60 p-4 rounded-xl border border-amber-200/20">
            <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
              <span>Real-Time Market Indexes</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
              <span>Postgres Index Hit Ratios</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
              <span>Breeds Global distribution chart</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
              <span>Unlimited export actions</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              id="activate-analytics-btn"
              type="button"
              onClick={handleUnlockTrial}
              className="px-6 py-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Unlock Advanced Analytics (Free Trial)</span>
            </button>
            <button
              disabled
              id="buy-enterprise-btn"
              className="px-6 py-3 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-750 flex items-center justify-center gap-1 cursor-default opacity-80"
            >
              <DollarSign size={13} />
              <span>Subscribe ($9.99/mo)</span>
            </button>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 block mt-2">🛡️ Secured with SSL & instant activation guarantees.</span>
        </div>
      ) : (
        // unlocked Report Layout
        <div id="unlocked-pro-analytics" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-amber-600 border-t-transparent rounded-full" />
            </div>
          ) : !stats ? (
            <p className="text-xs text-rose-500">Failed to aggregate stats from database clusters.</p>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider">Total Evaluated Trades</span>
                  <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
                    {stats.totalTrades}
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider">Average Camels Awarded</span>
                  <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-500 mt-1">
                    {stats.averageCamels} 🐪
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider">DB Size / Index</span>
                  <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
                    {stats.dbSizeKb} KB
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider">Cache Hit Ratio</span>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-500 mt-1">
                    {stats.cacheHitRatio}%
                  </div>
                </div>
              </div>

              {/* Data Visualization Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Share Chart */}
                <div className="border border-zinc-100 dark:border-zinc-850 p-4 rounded-xl bg-white dark:bg-zinc-900 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 uppercase font-mono">
                    <BarChart3 size={13} className="text-amber-600" />
                    <span>Calculations by Traded Asset Type</span>
                  </h4>
                  {stats.totalTrades === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-6 text-center">No trades logged yet. Create some trades to view market charts!</p>
                  ) : (
                    <div className="space-y-2.5 pt-2">
                      {Object.entries(stats.byCategory).map(([cat, count]) => {
                        const countNum = count as number;
                        const pct = stats.totalTrades > 0 ? (countNum / stats.totalTrades) * 100 : 0;
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-350">
                              <span>{formatCategoryLabel(cat)}</span>
                              <span className="font-mono">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-600 dark:bg-amber-500 rounded-full transition-all duration-300" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Popular Breed distribution index */}
                <div className="border border-zinc-100 dark:border-zinc-850 p-4 rounded-xl bg-white dark:bg-zinc-900 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 uppercase font-mono">
                    <ShieldAlert size={13} className="text-amber-600" />
                    <span>Distribution Index by Camel Breed</span>
                  </h4>
                  {stats.totalTrades === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-6 text-center">No breeds requested. Run calculation to trigger logs.</p>
                  ) : (
                    <div className="space-y-2.5 pt-2">
                      {Object.entries(stats.byBreed).map(([breedId, count]) => {
                        const countNum = count as number;
                        const pct = stats.totalTrades > 0 ? (countNum / stats.totalTrades) * 100 : 0;
                        return (
                          <div key={breedId} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-350">
                              <span>{formatBreedId(breedId)}</span>
                              <span className="font-mono">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-yellow-500 dark:bg-yellow-400 rounded-full transition-all duration-300" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Optimization advice */}
              <div className="p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed flex gap-3">
                <Cpu size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-zinc-800 dark:text-white block mb-0.5">PostgreSQL Optimizer Tip</span>
                  The compound composite keys <code className="text-amber-500 font-mono text-[10px]">idx_trades_composite_analytics</code> are maintaining healthy index seek latency (~0.1ms). Vacuum buffers are clearing successfully to ensure query responses remain constant at peak scalability load.
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="lock-reports-btn"
                  onClick={() => setIsUnlocked(false)}
                  className="px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer"
                >
                  Lock Pro Panel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
