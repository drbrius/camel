import React, { useState, useEffect } from 'react';
import { 
  TradeItemCategory, 
  TradeCalculationInput, 
  TradeCalculationResult, 
  CamelBreed 
} from '../types';
import { 
  CAMEL_BREEDS 
} from '../../server/calculator';
import { 
  Car, 
  Heart, 
  Sparkles, 
  Smartphone, 
  ChevronRight, 
  Clock, 
  RotateCcw, 
  Flame, 
  HelpCircle,
  Database,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CamelCalculatorProps {
  quizScore: number;
}

export default function CamelCalculator({ quizScore }: CamelCalculatorProps) {
  // Input collection states initialized
  const [category, setCategory] = useState<TradeItemCategory>('car');
  const [selectedBreedId, setSelectedBreedId] = useState<string>('dromedary');
  
  // Custom detail state variables
  const [carType, setCarType] = useState('sedan');
  const [carYear, setCarYear] = useState<number>(2018);
  const [carCondition, setCarCondition] = useState('good');
  const [carFuel, setCarFuel] = useState('gasoline');

  const [partnerAge, setPartnerAge] = useState<number>(28);
  const [partnerHair, setPartnerHair] = useState('brown');
  const [partnerEye, setPartnerEye] = useState('brown');
  const [partnerCooking, setPartnerCooking] = useState('average');
  const [partnerHumor, setPartnerHumor] = useState('average');
  const [partnerPatience, setPartnerPatience] = useState('average');

  const [husbandAge, setHusbandAge] = useState<number>(30);
  const [husbandHeight, setHusbandHeight] = useState('5ft8_to_6ft');
  const [husbandBeard, setHusbandBeard] = useState('glorious');
  const [husbandDadJokes, setHusbandDadJokes] = useState('elite');
  const [husbandHandy, setHusbandHandy] = useState('average');

  const [deviceBrand, setDeviceBrand] = useState('apple');
  const [deviceAge, setDeviceAge] = useState('new');
  const [deviceCondition, setDeviceCondition] = useState('mint');

  const [soulPurity, setSoulPurity] = useState('average');
  const [soulHistory, setSoulHistory] = useState('recompense');

  // API result states
  const [result, setResult] = useState<TradeCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeCalculationResult[]>([]);
  const [sqlUsed, setSqlUsed] = useState<string>('');
  const [explainPlan, setExplainPlan] = useState<string[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('');

  // Auto-fetch history on boot and when filter changes
  const loadHistory = async (filter = '') => {
    try {
      const url = filter ? `/api/trades?category=${filter}` : '/api/trades';
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setTradeHistory(d.data || []);
        setSqlUsed(d.sqlUsed || '');
        setExplainPlan(d.explainPlan || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistory(historyFilter);
  }, [historyFilter]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build the request payload
    const detailsPayload: any = {};
    if (category === 'car') {
      detailsPayload.carType = carType;
      detailsPayload.carYear = carYear;
      detailsPayload.carCondition = carCondition;
      detailsPayload.carFuel = carFuel;
    } else if (category === 'wife_girlfriend') {
      detailsPayload.partnerAge = partnerAge;
      detailsPayload.partnerHair = partnerHair;
      detailsPayload.partnerEye = partnerEye;
      detailsPayload.partnerCooking = partnerCooking;
      detailsPayload.partnerHumor = partnerHumor;
      detailsPayload.partnerPatience = partnerPatience;
    } else if (category === 'husband_boyfriend') {
      detailsPayload.husbandAge = husbandAge;
      detailsPayload.husbandHeight = husbandHeight;
      detailsPayload.husbandBeard = husbandBeard;
      detailsPayload.husbandDadJokes = husbandDadJokes;
      detailsPayload.husbandHandy = husbandHandy;
    } else if (category === 'device') {
      detailsPayload.deviceBrand = deviceBrand;
      detailsPayload.deviceAge = deviceAge;
      detailsPayload.deviceCondition = deviceCondition;
    } else if (category === 'soul') {
      detailsPayload.soulPurity = soulPurity;
      detailsPayload.soulHistory = soulHistory;
    }

    const payload: TradeCalculationInput = {
      category,
      breedId: selectedBreedId,
      quizScore,
      details: detailsPayload
    };

    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Calculation server error');
      }

      const rawResult = await response.json();
      setResult(rawResult);
      
      // Reload lists
      loadHistory(historyFilter);
    } catch (err: any) {
      setError(err.message || 'Network error executing trade simulation.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetHistory = async () => {
    if (!confirm('Are you sure you want to purge the database tables in Postgres?')) return;
    try {
      await fetch('/api/reset', { method: 'POST' });
      setResult(null);
      loadHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCamelLabel = (count: number) => {
    if (count === 1) return 'Camel';
    return 'Camels';
  };

  // Get active breed metadata for visual displays
  const activeBreed = CAMEL_BREEDS.find(b => b.id === selectedBreedId) || CAMEL_BREEDS[0];

  return (
    <div id="calculator-workflow-root" className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Trade Parameters Form */}
        <div id="calculator-subform-box" className="lg:col-span-7 border border-clay/15 dark:border-sand/15 bg-sand/30 dark:bg-white/5 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="serif font-bold text-lg text-clay dark:text-sand">
              New Camel Appraisal
            </h3>
            <p className="text-xs text-clay/60 dark:text-sand/65 font-sans">
              Choose your trading asset item, configure attributes, and evaluate camel market values
            </p>
          </div>

          <form onSubmit={handleCalculate} className="space-y-5">
            {/* Category selection */}
            <div className="space-y-1.5">
              <label htmlFor="assets-select-menu" className="text-[11px] font-bold font-mono tracking-wider uppercase text-clay/60 dark:text-sand/50">
                Trader Category Selector
              </label>
              <div className="relative">
                <select
                  id="assets-select-menu"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TradeItemCategory)}
                  className="w-full p-4 rounded-xl border border-clay/15 dark:border-sand/15 bg-sand/50 dark:bg-clay/50 text-sm font-semibold tracking-wide text-clay dark:text-sand focus:outline-none focus:ring-2 focus:ring-terracotta/20 cursor-pointer transition-all appearance-none"
                >
                  <option id="category-car-option" value="car">🚗 Trade My Car (Automotive Appraisal)</option>
                  <option id="category-wife-option" value="wife_girlfriend">👩 Trade My Wife / Girlfriend (Domestic Companion)</option>
                  <option id="category-husband-option" value="husband_boyfriend">👨 Trade My Husband / Boyfriend (Utility Mate)</option>
                  <option id="category-device-option" value="device">📱 Trade My Smart Electronics (Device Audit)</option>
                  <option id="category-soul-option" value="soul">🔮 Trade My Immortal Soul (Spiritual Exchange)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Subform Panels */}
            <div className="p-4 bg-sand/30 dark:bg-warm-black/20 rounded-xl border border-clay/10 dark:border-sand/10 min-h-[14rem]">
              <AnimatePresence mode="wait">
                {category === 'car' && (
                  <motion.div
                    key="car-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <label htmlFor="car-type-select" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Car Type</label>
                      <select id="car-type-select" value={carType} onChange={e => setCarType(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="sedan">🚗 Sedan (Commuter)</option>
                        <option value="suv">🚙 SUV / CrossOver</option>
                        <option value="truck">🛻 Heavy Duty Truck</option>
                        <option value="supercar">🏎️ Exotic Supercar</option>
                        <option value="compact">🚲 Compact Microcar</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="car-year-input" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Model Year</label>
                      <input
                        id="car-year-input"
                        type="number"
                        min="1950"
                        max="2027"
                        value={carYear}
                        onChange={e => setCarYear(parseInt(e.target.value) || 2018)}
                        className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="car-condition-select" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Condition</label>
                      <select id="car-condition-select" value={carCondition} onChange={e => setCarCondition(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="excellent">✨ Showroom / Mint</option>
                        <option value="good">👍 Clean / Normal wear</option>
                        <option value="poor">🛠️ Slipping transmission</option>
                        <option value="scrap">💀 Scrap metal / Salvage title</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="car-fuel-select" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Engine Fuel Type</label>
                      <select id="car-fuel-select" value={carFuel} onChange={e => setCarFuel(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="gasoline">Gasoline Octane</option>
                        <option value="diesel">Heavy Torque Diesel</option>
                        <option value="electric">Sustainable EV Battery</option>
                        <option value="hybrid">Economic Hybrid</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                {category === 'wife_girlfriend' && (
                  <motion.div
                    key="wife-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <label htmlFor="wife-age" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Age of Companion</label>
                      <input
                        id="wife-age"
                        type="number"
                        min="18"
                        max="120"
                        value={partnerAge}
                        onChange={e => setPartnerAge(parseInt(e.target.value) || 28)}
                        className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="wife-hair" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Hair Color</label>
                      <select id="wife-hair" value={partnerHair} onChange={e => setPartnerHair(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="brown">🍫 Brunette / Brown</option>
                        <option value="blonde">⭐ Blonde / Gold</option>
                        <option value="black">🖤 Black</option>
                        <option value="red">🔥 Redhead</option>
                        <option value="other">🎨 Unicorn Dyed</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="wife-eyes" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Eye Color</label>
                      <select id="wife-eyes" value={partnerEye} onChange={e => setPartnerEye(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="brown">🤎 Brown / Hazel</option>
                        <option value="blue">💙 Sky Blue</option>
                        <option value="green">💚 Rare Green</option>
                        <option value="dark">🖤 Deep Black</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="wife-cooking" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Cooking Capabilities</label>
                      <select id="wife-cooking" value={partnerCooking} onChange={e => setPartnerCooking(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="average">🍲 Decent home meals</option>
                        <option value="masterpiece">🍳 Michelin Dessert Chef</option>
                        <option value="poor">🥪 Burns frozen pizzas</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="wife-humor" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Sense of Humor</label>
                      <select id="wife-humor" value={partnerHumor} onChange={e => setPartnerHumor(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="average">Laughs at basic jokes</option>
                        <option value="excellent">😂 Sarcastic & Witty (Quick)</option>
                        <option value="dry">🌵 British-tier dry desert sarcasm</option>
                        <option value="none">🗿 Stonewalls humor attempts</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="wife-patience" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Patience Level</label>
                      <select id="wife-patience" value={partnerPatience} onChange={e => setPartnerPatience(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="average">Normal human levels</option>
                        <option value="saint">😇 Patience of a saint</option>
                        <option value="low">💥 Short-fused firecracker</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                {category === 'husband_boyfriend' && (
                  <motion.div
                    key="husband-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <label htmlFor="husband-age" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Age of Mate</label>
                      <input
                        id="husband-age"
                        type="number"
                        min="18"
                        max="120"
                        value={husbandAge}
                        onChange={e => setHusbandAge(parseInt(e.target.value) || 30)}
                        className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand focus:outline-none focus:ring-1 focus:ring-terracotta/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="husband-height" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Postural Stature</label>
                      <select id="husband-height" value={husbandHeight} onChange={e => setHusbandHeight(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="6ft_plus">🦒 Tall Tree climber (6ft+)</option>
                        <option value="5ft8_to_6ft">🕺 Robust Average (5ft8 to 6ft)</option>
                        <option value="under_5ft8">👑 High-Efficiency Pocket King (&lt; 5ft8)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="husband-beard" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Beard Quality</label>
                      <select id="husband-beard" value={husbandBeard} onChange={e => setHusbandBeard(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="glorious">🧔 Majestic Lumberjack Beard</option>
                        <option value="stubble">🪒 Short clean premium stubble</option>
                        <option value="none">👶 Clean-shaven face</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="husband-jokes" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Dad Jokes level</label>
                      <select id="husband-jokes" value={husbandDadJokes} onChange={e => setHusbandDadJokes(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="elite">🗣️ Elite (Infinite continuous pun loop)</option>
                        <option value="average">Tells basic barbecue chuckles</option>
                        <option value="painful">😬 Terminal (Triggers rapid migraines)</option>
                      </select>
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-1">
                      <label htmlFor="husband-handy" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Handy / Maintenance Skills</label>
                      <select id="husband-handy" value={husbandHandy} onChange={e => setHusbandHandy(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="average">Can assemble IKEA bookshelves</option>
                        <option value="survivalist">🛠️ Absolute MacGyver (can build entire cabin)</option>
                        <option value="useless">🚫 Incapable of operating raw screwdrivers</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                {category === 'device' && (
                  <motion.div
                    key="device-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-fade-in"
                  >
                    <div className="space-y-1">
                      <label htmlFor="device-brand" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Hardware Brand</label>
                      <select id="device-brand" value={deviceBrand} onChange={e => setDeviceBrand(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="apple">🍏 Apple Inc. Premium</option>
                        <option value="samsung">📱 Samsung Galaxy Flagship</option>
                        <option value="other">📟 Open-Source Linux Terminal</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="device-age" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Device Age</label>
                      <select id="device-age" value={deviceAge} onChange={e => setDeviceAge(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="new">🆕 Direct from retail box</option>
                        <option value="old">📆 1-3 years old commuters</option>
                        <option value="antique">💾 Antique functional historical mainframe</option>
                      </select>
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-1">
                      <label htmlFor="device-condition" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Physical Quality</label>
                      <select id="device-condition" value={deviceCondition} onChange={e => setDeviceCondition(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="mint">💎 Scratch-less mint glaze</option>
                        <option value="scratched">👍 Moderate hairline pockets friction</option>
                        <option value="cracked">⚡ Spiderweb shattered screen pattern</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                {category === 'soul' && (
                  <motion.div
                    key="soul-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-fade-in"
                  >
                    <div className="space-y-1">
                      <label htmlFor="soul-purity" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Core Spiritual Purity</label>
                      <select id="soul-purity" value={soulPurity} onChange={e => setSoulPurity(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="average">Normal earthly mortal balance</option>
                        <option value="saintly">😇 Shimmering halo clean essence</option>
                        <option value="sinister">😈 heavily compromised pending mortgages</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="soul-history" className="font-bold text-clay/60 dark:text-sand/50 font-mono tracking-wide uppercase">Karma Background</label>
                      <select id="soul-history" value={soulHistory} onChange={e => setSoulHistory(e.target.value)} className="w-full p-2.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-warm-black/40 text-clay dark:text-sand cursor-pointer focus:outline-none focus:ring-1 focus:ring-terracotta/20">
                        <option value="recompense">Standard noble acts</option>
                        <option value="redemption">🔄 Major cinematic redemption narrative</option>
                        <option value="mischievous">🧝 Prankster chaos imp history</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Breed Selector */}
            <div className="space-y-1.5">
              <label htmlFor="breed-select-menu" className="text-[11px] font-bold font-mono tracking-wider uppercase text-clay/60 dark:text-sand/50 block mb-1">
                Preferred Camel Breed Configuration
              </label>
              <div className="relative">
                <select
                  id="breed-select-menu"
                  value={selectedBreedId}
                  onChange={(e) => setSelectedBreedId(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-clay/15 dark:border-sand/15 bg-sand/50 dark:bg-clay/50 text-sm font-semibold text-clay dark:text-sand cursor-pointer focus:outline-none appearance-none"
                >
                  <option id="breed-drom-opt" value="dromedary">🐪 Arabian Dromedary (1.0x standard speedster)</option>
                  <option id="breed-bact-opt" value="bactrian">🐫 Double-Humped Bactrian (1.4x double hump freight weight)</option>
                  <option id="breed-hybrid-opt" value="hybrid_alkahl">👑 Royal Hybrid Al-Kahl (1.7x giant crown luxury)</option>
                  <option id="breed-wild-opt" value="wild_bactrian">🔱 Ancestral Wild Bactrian (2.2x legendary wild collector)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              
              {/* Breed details box */}
              <div className="mt-2.5 p-3.5 rounded-xl bg-terracotta/5 dark:bg-terracotta/10 border border-terracotta/20 text-xs text-clay/80 dark:text-sand/80 leading-relaxed space-y-1">
                <div className="flex items-center justify-between">
                  <span className="serif font-bold text-clay dark:text-sand tracking-wide">
                    {activeBreed.name} <span className="font-mono text-[10px] font-normal italic">({activeBreed.scientificName})</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    activeBreed.rarity === 'Legendary' 
                      ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300'
                      : activeBreed.rarity === 'Epic'
                        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                        : activeBreed.rarity === 'Rare'
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-clay/5 text-clay dark:bg-white/5 dark:text-sand'
                  }`}>
                    {activeBreed.rarity}
                  </span>
                </div>
                <p className="text-[11px] leading-normal">{activeBreed.description}</p>
                <div className="flex gap-4 font-mono text-[10px] pt-1 text-clay/55 dark:text-sand/55">
                  <span>💨 Speed: {activeBreed.speed}</span>
                  <span>⚖️ Multiplier: <strong className="text-terracotta font-bold">x{activeBreed.multiplier}</strong></span>
                </div>
              </div>
            </div>

            <button
              id="evaluate-camel-btn"
              type="submit"
              disabled={loading}
              className="w-full p-4 rounded-full text-xs font-bold tracking-widest uppercase bg-terracotta hover:opacity-90 disabled:opacity-50 text-sand transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Computing Caravan Pricing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Calculate Trade Camels</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Result Box & Trace details */}
        <div id="calculator-result-box" className="lg:col-span-5 space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result-pane"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="border border-clay/15 dark:border-sand/15 bg-sand/30 dark:bg-white/5 rounded-2xl shadow-md p-6 space-y-5"
              >
                <div className="text-center space-y-2">
                  <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider bg-terracotta text-sand px-3 py-1 rounded-full shadow-sm">
                    {result.dealGrade}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-clay/50 dark:text-sand/50 uppercase font-mono tracking-wider">Estimated Payload Yield</h4>
                    <div className="flex items-baseline justify-center gap-2 mt-2">
                      <span className="text-5xl font-black text-terracotta dark:text-terracotta tracking-tight font-mono">
                        {result.camelCount}
                      </span>
                      <span className="text-lg font-bold text-clay dark:text-sand/90 font-mono">
                        {formatCamelLabel(result.camelCount)}
                      </span>
                    </div>
                    <p className="text-xs text-clay/60 dark:text-sand/65 italic mt-1 font-sans">
                      traded to 1x {result.breedName} caravan
                    </p>
                  </div>
                </div>

                {/* Equation Steps */}
                <div className="space-y-2 border-t border-dashed border-clay/15 dark:border-sand/15 pt-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-clay/50 dark:text-sand/50">
                    Trade Valuation Formulas
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {result.formulaBreakdown.map((row, idx) => (
                      <div key={idx} className="text-[11px] leading-relaxed text-clay dark:text-sand bg-sand/25 dark:bg-warm-black/25 p-2 rounded-lg border border-clay/10 dark:border-sand/10 flex items-start gap-1.5">
                        <span className="text-terracotta">•</span>
                        <span>{row}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-clay/80 dark:text-sand/75 bg-sand/30 dark:bg-clay/20 p-3 rounded-xl border border-clay/10 dark:border-sand/10 flex flex-col gap-1">
                  <span className="flex items-center gap-1">
                    <Database size={11} className="text-terracotta shrink-0" />
                    <span className="font-bold text-clay dark:text-sand">POSTGRES TRACE LOG:</span>
                  </span>
                  <span className="text-clay/70 dark:text-sand/70 truncate">INSERT INTO trade_calculations... Saved successfully.</span>
                  <span className="text-[9px] text-clay/55 dark:text-sand/55 mt-1">Transaction ID: {result.id}</span>
                </div>
              </motion.div>
            ) : (
              <div
                key="placeholder-pane"
                className="border border-dashed border-clay/20 dark:border-sand/20 bg-sand/10 dark:bg-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 min-h-[22rem]"
              >
                <div className="w-12 h-12 bg-sand/40 dark:bg-clay/35 rounded-full flex items-center justify-center border border-clay/15 dark:border-sand/15">
                  <Clock size={18} className="text-clay/70 dark:text-sand/70" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-clay dark:text-sand font-serif">Awaiting Calculation</h4>
                  <p className="text-xs text-clay/60 dark:text-sand/65 max-w-xs mt-1 leading-relaxed">
                    Input your trade properties on the left and submit appraisal to calculate camel ratios in real-time.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Database History Section */}
      <div id="historical-appraisal-table" className="border border-clay/15 dark:border-sand/15 bg-sand/30 dark:bg-white/5 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-clay/10 dark:border-sand/10 pb-4">
          <div>
            <h4 className="font-serif font-bold text-base text-clay dark:text-sand flex items-center gap-2">
              <Database size={16} className="text-terracotta" />
              <span>Historical Calculations (PostgreSQL DB)</span>
            </h4>
            <p className="text-xs text-clay/60 dark:text-sand/60 mt-0.5">
              Live read trace from the <code className="font-mono text-terracotta text-[11px]">trade_calculations</code> indexed table
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              id="history-filter-menu"
              value={historyFilter}
              onChange={e => setHistoryFilter(e.target.value)}
              className="p-1.5 rounded-lg border border-clay/15 dark:border-sand/15 bg-sand/20 dark:bg-clay/50 text-[11px] font-medium text-clay dark:text-sand cursor-pointer"
            >
              <option value="">📁 All Categories</option>
              <option value="car">🚗 Cars</option>
              <option value="wife_girlfriend">👩 Wives / Girlfriends</option>
              <option value="husband_boyfriend">👨 Husbands / Boyfriends</option>
              <option value="device">📱 Devices</option>
              <option value="soul">🔮 Souls</option>
            </select>
            <button
              id="db-clean-btn"
              onClick={handleResetHistory}
              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 border border-transparent rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
              title="Truncate Trade Logs Table"
            >
              <RotateCcw size={13} />
              <span>Truncate</span>
            </button>
          </div>
        </div>

        {/* Explain Plan details visual */}
        <div className="p-3 bg-zinc-950 text-zinc-300 font-mono text-[10px] rounded-xl border border-zinc-850 space-y-1.5">
          <div className="flex items-center justify-between text-yellow-500 font-bold border-b border-zinc-800 pb-1 flex-wrap gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <Cpu size={12} />
              <span>POSTGRES EXPLAIN ANALYZE OUTPUT FOR LAST QUERY</span>
            </span>
            <span className="text-[9px] text-zinc-400">Speed optimization: Active</span>
          </div>
          <div className="text-amber-400 font-bold">SQL: <span className="text-white font-normal break-all select-all">{sqlUsed || 'No queries run.'}</span></div>
          <div className="space-y-0.5 py-1 text-zinc-450 border-t border-zinc-900">
            {explainPlan.map((line, d) => (
              <div key={d} className="leading-snug truncate">{line}</div>
            ))}
          </div>
        </div>

        {/* Trade listings table */}
        <div className="overflow-x-auto">
          {tradeHistory.length === 0 ? (
            <p className="text-center py-8 text-xs text-clay/50 dark:text-sand/50 italic">No appraisal records found. Evaluate an asset to insert rows.</p>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-clay/10 dark:border-sand/10 text-clay/60 dark:text-sand/55 uppercase tracking-wider font-mono text-[10px] font-semibold">
                  <th className="py-2.5">Asset Traded</th>
                  <th className="py-2.5">Category Details</th>
                  <th className="py-2.5 font-sans">Breed Requested</th>
                  <th className="py-2.5 text-right">Camels</th>
                  <th className="py-2.5 text-center">Grade</th>
                  <th className="py-2.5 text-right font-sans">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay/5 dark:divide-sand/5 text-clay dark:text-sand px-1">
                {tradeHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-clay/5 dark:hover:bg-sand/5 transition-all">
                    <td className="py-3 font-semibold flex items-center gap-1.5">
                      {item.category === 'car' ? '🚗 Car' : 
                       item.category === 'wife_girlfriend' ? '👩 Wife / GF' : 
                       item.category === 'husband_boyfriend' ? '👨 Husband / BF' :
                       item.category === 'device' ? '📱 Electronics' : '🔮 Soul'}
                    </td>
                    <td className="py-3 text-clay/60 dark:text-sand/65 truncate max-w-[200px]" title={item.inputSummary}>
                      {item.inputSummary}
                    </td>
                    <td className="py-3 font-mono font-medium text-terracotta">{item.breedName}</td>
                    <td className="py-3 text-right font-bold font-mono text-base">{item.camelCount} 🐪</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono border border-terracotta/20 text-terracotta bg-terracotta/5">
                        {item.dealGrade.split(' ').slice(-2).join(' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[10px] text-clay/50 dark:text-sand/50 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
