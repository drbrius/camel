import React, { useState, useEffect } from 'react';
import { DBStats } from '../types';
import { 
  Sparkles, 
  CheckCircle2, 
  DollarSign, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Cpu, 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  ArrowLeft, 
  Check, 
  Loader2 
} from 'lucide-react';

export default function CamelProAnalytics() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'trial' | 'card'>('trial');
  
  // Simulated Card Inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('Bedouin Merchant');
  
  // Checkout Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch current backend premium status on mount
  useEffect(() => {
    fetch('/api/premium/status')
      .then(res => res.json())
      .then(data => {
        setIsUnlocked(!!data.unlocked);
      })
      .catch(err => {
        console.error('Failed to load initial subscription state:', err);
      });
  }, []);

  // 2. Fetch statistics dynamically when activated
  useEffect(() => {
    if (isUnlocked) {
      setLoading(true);
      setErrorMessage('');
      fetch('/api/analytics')
        .then(res => {
          if (!res.ok) {
            throw new Error('Analytics endpoint is locked or currently restricted in database.');
          }
          return res.json();
        })
        .then(data => {
          setStats(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setStats(null);
          setLoading(false);
          setIsUnlocked(false);
          setErrorMessage(err.message);
        });
    }
  }, [isUnlocked]);

  // Handle gateway call to commit license
  const handleProceedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage('');

    const steps = [
      'Establishing secure SSL connection to merchant ledger...',
      'Gateway handshaking with virtual Stripe simulation server...',
      'Authorizing credit limit checking routines on sandbox account...',
      'Updating PostgreSQL persistent schema values (premiumUnlocked = true)...',
      'Bedouin Pro Suite enabled successfully!'
    ];

    // Stagger steps for immersive, educational feel
    for (const step of steps) {
      setProcessingStep(step);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      const response = await fetch('/api/premium/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: checkoutMethod,
          cardNumber: checkoutMethod === 'card' ? cardNumber : 'FREE_TRIAL_TOKEN'
        })
      });
      const data = await response.json();
      if (data.success) {
        setIsUnlocked(true);
        setShowCheckout(false);
      } else {
        setErrorMessage(data.error || 'Gateway validation rejected this trial/card execution.');
      }
    } catch {
      setErrorMessage('Communications failure with simulated gateway network.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Lock reports and notify backend to deactivate
  const handleLockReports = async () => {
    try {
      await fetch('/api/premium/lock', { method: 'POST' });
      setIsUnlocked(false);
      setStats(null);
    } catch (err) {
      console.error('Error locking analytics panel:', err);
    }
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
    <div id="camel-pro-analytics-card" className="border border-clay/15 dark:border-sand/15 bg-sand/30 dark:bg-white/5 rounded-2xl shadow-sm p-6 overflow-hidden relative">
      
      {/* Premium Badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-terracotta text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm">
        <Sparkles size={11} className="animate-pulse" />
        <span>PRO SUITE</span>
      </div>

      <div className="mb-6 space-y-1">
        <h3 className="serif font-bold text-lg text-clay dark:text-sand">
          Camel Pro Analytics™
        </h3>
        <p className="text-xs text-clay/60 dark:text-sand/65 font-sans">
          Unlock enterprise trade reports, market indexes, and active connection metrics
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2 border border-red-250/25">
          <ShieldAlert size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {!isUnlocked && !showCheckout && (
        // ----------------- 1. PAYWALL SCREEN -----------------
        <div id="pro-paywall-screen" className="py-6 flex flex-col items-center text-center space-y-6 max-w-lg mx-auto">
          <div className="p-4 bg-terracotta/10 dark:bg-terracotta/20 rounded-full border border-terracotta/30 text-terracotta">
            <TrendingUp size={36} />
          </div>

          <div className="space-y-2">
            <h4 className="serif font-bold text-clay dark:text-sand text-lg">
              Activate Market Intelligence Reports
            </h4>
            <p className="text-xs text-clay/70 dark:text-sand/75 leading-relaxed">
              Why settle for simple calculations? Join elite camel merchants and gain premium visibility into global asset distributions, real-time index calibrations, and active PostgreSQL execution plans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left text-xs bg-sand/50 dark:bg-clay/20 p-4 rounded-xl border border-clay/10 dark:border-sand/10">
            <span className="flex items-center gap-2 font-medium text-clay dark:text-sand/80">
              <CheckCircle2 size={13} className="text-terracotta shrink-0" />
              <span>Real-Time Market Indexes</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-clay dark:text-sand/80">
              <CheckCircle2 size={13} className="text-terracotta shrink-0" />
              <span>Postgres Index Hit Ratios</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-clay dark:text-sand/80">
              <CheckCircle2 size={13} className="text-terracotta shrink-0" />
              <span>Breeds Global distribution chart</span>
            </span>
            <span className="flex items-center gap-2 font-medium text-clay dark:text-sand/80">
              <CheckCircle2 size={13} className="text-terracotta shrink-0" />
              <span>Unlimited export actions</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              id="activate-analytics-btn"
              type="button"
              onClick={() => {
                setCheckoutMethod('trial');
                setShowCheckout(true);
              }}
              className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-terracotta hover:opacity-90 text-white shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Unlock Advanced Analytics (Free Trial)</span>
            </button>
            <button
              onClick={() => {
                setCheckoutMethod('card');
                setShowCheckout(true);
              }}
              id="buy-enterprise-btn"
              className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-clay text-sand dark:bg-sand dark:text-clay hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <DollarSign size={13} />
              <span>Subscribe ($9.99/mo)</span>
            </button>
          </div>
          <span className="text-[10px] font-mono text-clay/50 dark:text-sand/50 block mt-2">🛡️ Secured with SSL & instant activation guarantees.</span>
        </div>
      )}

      {!isUnlocked && showCheckout && (
        // ----------------- 2. INTERACTIVE CHECKOUT SCREEN -----------------
        <div id="simulated-payment-gateway-checkout" className="py-4 space-y-6 max-w-md mx-auto">
          <div className="flex items-center justify-between border-b border-clay/10 dark:border-sand/10 pb-3">
            <button
              type="button"
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-1 text-xs text-clay/70 hover:text-clay dark:text-sand/70 dark:hover:text-sand cursor-pointer font-sans"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-clay/60 dark:text-sand/65 flex items-center gap-1">
              <Lock size={11} className="text-terracotta" />
              Secure Sandbox Gateway
            </span>
          </div>

          {/* Selector Toggles */}
          <div className="grid grid-cols-2 gap-2 bg-sand/50 dark:bg-clay/40 p-1.5 rounded-full border border-clay/10 dark:border-sand/10">
            <button
              type="button"
              onClick={() => setCheckoutMethod('trial')}
              className={`py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                checkoutMethod === 'trial'
                  ? 'bg-terracotta text-white shadow-sm'
                  : 'text-clay/60 dark:text-sand/60'
              }`}
            >
              Free Trial (0.00)
            </button>
            <button
              type="button"
              onClick={() => setCheckoutMethod('card')}
              className={`py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                checkoutMethod === 'card'
                  ? 'bg-terracotta text-white shadow-sm'
                  : 'text-clay/60 dark:text-sand/60'
              }`}
            >
              Subscribe Credit (9.99)
            </button>
          </div>

          {isProcessing ? (
            // Processing View
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <Loader2 className="animate-spin text-terracotta h-8 w-8" />
              <div className="space-y-1.5 max-w-xs">
                <p className="font-semibold text-xs text-clay dark:text-sand uppercase tracking-wider font-mono">
                  Processing Gateway Transaction...
                </p>
                <p className="text-[11px] text-clay/60 dark:text-sand/60 px-4 animate-pulse">
                  {processingStep}
                </p>
              </div>
            </div>
          ) : (
            // Form & Credit Card Mockup View
            <form onSubmit={handleProceedCheckout} className="space-y-5 font-sans">
              {checkoutMethod === 'card' && (
                // Credit Card Graphic Mockup
                <div className="bg-gradient-to-tr from-clay via-clay/90 to-clay/80 dark:from-terracotta/80 dark:to-terracotta text-sand p-5 rounded-2xl shadow-md border border-sand/10 relative overflow-hidden flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <span className="serif italic text-[14px] font-bold tracking-widest text-[#F5F2ED]/90">BEDOUIN LEDGER</span>
                    <CreditCard size={24} className="text-[#F5F2ED]/80" />
                  </div>
                  <div>
                    <span className="text-[15px] font-mono tracking-widest block font-bold">
                      {cardNumber || '4242 •••• •••• 4242'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-[10px] font-mono">
                    <div>
                      <span className="opacity-50 block uppercase tracking-wide text-[8px]">CARDHOLDER</span>
                      <span className="uppercase text-xs font-semibold">{cardName || 'BEDOUIN MERCHANT'}</span>
                    </div>
                    <div>
                      <span className="opacity-50 block uppercase tracking-wide text-[8px]">EXPIRES</span>
                      <span className="font-semibold text-xs">{cardExpiry || '12/28'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {checkoutMethod === 'card' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono font-semibold text-clay/60 dark:text-sand/60">Simulated Account Holder Name</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Bedouin Merchant"
                        required
                        className="w-full p-2 text-xs bg-sand/30 dark:bg-clay/50 border border-clay/10 dark:border-sand/15 rounded-xl text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono font-semibold text-clay/60 dark:text-sand/60">Credit Card Number (Stripe Card OK)</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                          const formatted = val.replace(/(\d{4})/g, '$1 ').trim();
                          setCardNumber(formatted);
                        }}
                        placeholder="4242 4242 4242 4242"
                        required
                        className="w-full p-2 text-xs bg-sand/30 dark:bg-clay/50 border border-clay/10 dark:border-sand/15 rounded-xl text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/40 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider font-mono font-semibold text-clay/60 dark:text-sand/60">Expiration</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                            setCardExpiry(val);
                          }}
                          placeholder="MM/YY"
                          required
                          className="w-full p-2 text-xs bg-sand/30 dark:bg-clay/50 border border-clay/10 dark:border-sand/15 rounded-xl text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/40 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider font-mono font-semibold text-clay/60 dark:text-sand/60">CVV</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="123"
                          required
                          className="w-full p-2 text-xs bg-sand/30 dark:bg-clay/50 border border-clay/10 dark:border-sand/15 rounded-xl text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/40 font-mono"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-sand/10 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-clay dark:text-sand text-xs font-semibold">
                      <ShieldCheck className="text-terracotta" size={16} />
                      <span>Instant Bedouin Trial Active Subscription</span>
                    </div>
                    <p className="text-[11px] text-clay/70 dark:text-sand/70 leading-relaxed">
                      Enjoying the trial simulation lets you unlock Postgres statistics aggregates under the simulated environment with one click. No credit cards required during testing.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="w-1/3 py-2.5 rounded-full border border-clay/15 dark:border-sand/15 hover:bg-clay/5 dark:hover:bg-sand/5 text-clay dark:text-sand text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-full bg-terracotta text-white hover:opacity-90 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Authorize Transaction</span>
                  <Check size={14} />
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isUnlocked && (
        // ----------------- 3. ACTIVE REPORTS LAYOUT -----------------
        <div id="unlocked-pro-analytics" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-terracotta border-t-transparent rounded-full" />
            </div>
          ) : !stats ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs text-center">
              Failed to aggregate statistics from database clusters. Verify backend connections.
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-sand/30 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-xl">
                  <span className="text-[10px] text-clay/50 dark:text-sand/55 uppercase font-mono font-bold tracking-wider">Total Evaluated Trades</span>
                  <div className="text-xl font-bold font-mono text-clay dark:text-sand mt-1">
                    {stats.totalTrades}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-xl">
                  <span className="text-[10px] text-clay/50 dark:text-sand/55 uppercase font-mono font-bold tracking-wider">Average Camels Awarded</span>
                  <div className="text-xl font-bold font-mono text-terracotta mt-1">
                    {stats.averageCamels} 🐪
                  </div>
                </div>
                <div className="p-3 bg-sand/30 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-xl">
                  <span className="text-[10px] text-clay/50 dark:text-sand/55 uppercase font-mono font-bold tracking-wider">DB Size / Index</span>
                  <div className="text-xl font-bold font-mono text-clay dark:text-sand mt-1">
                    {stats.dbSizeKb} KB
                  </div>
                </div>
                <div className="p-3 bg-sand/30 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-xl">
                  <span className="text-[10px] text-clay/50 dark:text-sand/55 uppercase font-mono font-bold tracking-wider">Cache Hit Ratio</span>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {stats.cacheHitRatio}%
                  </div>
                </div>
              </div>

              {/* Data Visualization Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Share Chart */}
                <div className="border border-clay/10 dark:border-sand/10 p-4 rounded-xl bg-sand/10 dark:bg-clay/25 space-y-3">
                  <h4 className="text-xs font-bold text-clay dark:text-sand/90 flex items-center gap-1.5 uppercase font-mono">
                    <BarChart3 size={13} className="text-terracotta" />
                    <span>Calculations by Traded Asset Type</span>
                  </h4>
                  {stats.totalTrades === 0 ? (
                    <p className="text-xs text-clay/50 dark:text-sand/50 italic py-6 text-center">No trades logged yet. Create some trades to view market charts!</p>
                  ) : (
                    <div className="space-y-2.5 pt-2 font-sans">
                      {Object.entries(stats.byCategory).map(([cat, count]) => {
                        const countNum = count as number;
                        const pct = stats.totalTrades > 0 ? (countNum / stats.totalTrades) * 100 : 0;
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-clay dark:text-sand/80">
                              <span>{formatCategoryLabel(cat)}</span>
                              <span className="font-mono font-bold">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-clay/5 dark:bg-sand/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-terracotta rounded-full transition-all duration-300" 
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
                <div className="border border-clay/10 dark:border-sand/10 p-4 rounded-xl bg-sand/10 dark:bg-clay/25 space-y-3">
                  <h4 className="text-xs font-bold text-clay dark:text-sand/90 flex items-center gap-1.5 uppercase font-mono">
                    <ShieldAlert size={13} className="text-terracotta" />
                    <span>Distribution Index by Camel Breed</span>
                  </h4>
                  {stats.totalTrades === 0 ? (
                    <p className="text-xs text-clay/50 dark:text-sand/50 italic py-6 text-center">No breeds requested. Run calculation to trigger logs.</p>
                  ) : (
                    <div className="space-y-2.5 pt-2 font-sans">
                      {Object.entries(stats.byBreed).map(([breedId, count]) => {
                        const countNum = count as number;
                        const pct = stats.totalTrades > 0 ? (countNum / stats.totalTrades) * 100 : 0;
                        return (
                          <div key={breedId} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-clay dark:text-sand/80">
                              <span>{formatBreedId(breedId)}</span>
                              <span className="font-mono font-bold">{count} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-clay/5 dark:bg-sand/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-500 rounded-full transition-all duration-300" 
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
              <div className="p-3.5 bg-clay/5 dark:bg-clay/35 rounded-xl border border-clay/10 dark:border-sand/10 text-xs text-clay/80 dark:text-sand/80 leading-relaxed flex gap-3">
                <Cpu size={18} className="text-terracotta shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-clay dark:text-sand block mb-0.5 font-serif">PostgreSQL Optimizer Tip</span>
                  The compound composite keys <code className="text-terracotta font-mono text-[10px]">idx_trades_composite_analytics</code> are maintaining healthy index seek latency (~0.1ms). Vacuum buffers are clearing successfully to ensure query responses remain constant at peak scalability load.
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="lock-reports-btn"
                  onClick={handleLockReports}
                  className="px-5 py-2 border border-clay/15 dark:border-sand/15 hover:bg-clay/5 dark:hover:bg-sand/5 rounded-full text-[11px] text-clay/80 dark:text-sand/80 font-bold uppercase tracking-wider cursor-pointer"
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
