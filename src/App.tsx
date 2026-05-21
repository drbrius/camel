import { useState } from 'react';
import ThemeToggle from './components/ThemeToggle';
import CamelCalculator from './components/CamelCalculator';
import CamelQuiz from './components/CamelQuiz';
import CamelEbookReader from './components/CamelEbookReader';
import ServerLogger from './components/ServerLogger';
import { 
  Sparkles, 
  Database, 
  Award, 
  Calculator, 
  Terminal,
  BookOpen
} from 'lucide-react';
import logoUrl from './assets/images/camel_logo_1779352656823.png';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'ebook'>('calculator');
  const [quizScore, setQuizScore] = useState<number>(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Stacks the quiz score into appraisal models
  const handleQuizComplete = (score: number) => {
    setQuizScore(score);
  };

  return (
    <div className="min-h-screen bg-sand text-clay dark:bg-warm-black dark:text-sand transition-colors duration-200">
      
      {/* Natural Tones Top Accent Bar */}
      <div className="h-1.5 bg-gradient-to-r from-terracotta via-olive to-clay w-full" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-8">
        
        {/* Navigation Header */}
        <header id="main-app-header" className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-clay/15 dark:border-sand/15 pb-6">
          <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-terracotta shadow-md bg-sand/50 shrink-0 flex items-center justify-center bg-sand/40 dark:bg-clay/30">
              {!logoError ? (
                <img 
                  src={logoUrl} 
                  alt="Camel Trade Calculator Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-3xl filter select-none">🐪</span>
              )}
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="serif font-semibold text-2.5xl tracking-wide text-clay dark:text-sand">
                  Camel Trade Calculator
                </h1>
                <span className="hidden sm:inline bg-terracotta/10 text-terracotta border border-terracotta/25 dark:bg-terracotta/20 dark:text-sand dark:border-terracotta/35 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  Postgres Live
                </span>
              </div>
              <p className="text-xs text-clay/60 dark:text-sand/60 mt-0.5">
                Calculate real caravan returns for your cars, companions, and spiritual assets
              </p>
            </div>
          </div>

          {/* Theme selection and quick actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav id="view-mode-tabs" className="flex border-b border-clay/10 dark:border-sand/10 pb-px gap-1 overflow-x-auto">
          <button
            id="tab-calculator-btn"
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
              activeTab === 'calculator'
                ? 'border-terracotta text-terracotta dark:text-terracotta bg-terracotta/5 font-extrabold'
                : 'border-transparent text-clay/60 hover:text-clay dark:text-sand/60 dark:hover:text-sand'
            }`}
          >
            <Calculator size={13} />
            <span>Appraisal Station</span>
          </button>
          
          <button
            id="tab-ebook-btn"
            type="button"
            onClick={() => setActiveTab('ebook')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
              activeTab === 'ebook'
                ? 'border-terracotta text-terracotta dark:text-terracotta bg-terracotta/5 font-extrabold'
                : 'border-transparent text-clay/60 hover:text-clay dark:text-sand/60 dark:hover:text-sand'
            }`}
          >
            <BookOpen size={13} />
            <span>Caravan Capitalist eBook</span>
            <span className="text-[8px] bg-terracotta text-white rounded px-1.5 py-0.2 ml-1 uppercase tracking-widest animate-pulse">New</span>
          </button>
        </nav>

        {/* Dynamic Views Viewport */}
        <main className="min-h-[30rem]">
          {activeTab === 'calculator' ? (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Introduction guidelines banner */}
                <div className="md:col-span-12 p-4 rounded-xl bg-gradient-to-r from-terracotta/10 via-olive/5 to-transparent border border-terracotta/20 flex items-center gap-3">
                  <div className="p-2 bg-terracotta/10 dark:bg-terracotta/20 rounded-lg text-terracotta border border-terracotta/30 shrink-0">
                    <Award size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-clay dark:text-sand">
                      Desert Survival Score multiplier: <span className="text-terracotta">{quizScore}% bonus</span>
                    </h4>
                    <p className="text-[11px] text-clay/70 dark:text-sand/65 mt-0.5">
                      Completed quizzes reward multipliers on top of standard dromedary market ratios. Fill out the quiz below to upgrade your assets pricing!
                    </p>
                  </div>
                </div>
              </div>

              {/* Calculator View layout */}
              <CamelCalculator quizScore={quizScore} />

              {/* Quiz Module Row */}
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <CamelQuiz onQuizComplete={handleQuizComplete} savedScore={quizScore > 0 ? quizScore : undefined} />
                <div className="border border-dashed border-clay/20 dark:border-sand/20 bg-sand/40 dark:bg-white/5 rounded-2xl p-6 text-xs space-y-3">
                  <h4 className="font-semibold text-clay dark:text-sand flex items-center gap-1.5 uppercase font-mono tracking-wider text-[11px]">
                    <Sparkles size={13} className="text-terracotta" />
                    <span>How Camel Appraisal Works</span>
                  </h4>
                  <p className="text-clay/80 dark:text-sand/80 leading-relaxed font-sans">
                    Camel values undergo double-multiplier computations:
                  </p>
                  <ul className="space-y-1.5 text-clay/60 dark:text-sand/60 list-disc list-inside">
                    <li><strong className="text-clay dark:text-sand">Form appraisals:</strong> Custom parameters (cooking skill of wives, height of husbands, horsepower of cars, digital storage tiers of smartphones) scale appraisal values.</li>
                    <li><strong className="text-clay dark:text-sand">Worthiness Quiz:</strong> Demonstrating desert wisdom grants score boosts up to <strong className="text-terracotta">+10 camels</strong>.</li>
                    <li><strong className="text-clay dark:text-sand">Genetic breed indices:</strong> Different camel breeds carry unique multipliers from 1.0x to 2.2x.</li>
                  </ul>
                  <p className="text-[10px] italic text-clay/50 dark:text-sand/40 leading-normal">
                    ⚠️ The app is optimized for humor and high-fidelity testing. Actual caravan experiences in the Sahara might vary. All records are maintained inside the simulated PostgreSQL cluster.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <CamelEbookReader />
            </div>
          )}
        </main>

        {/* Collapsible live telemetry trace footer logs */}
        <footer className="pt-6 border-t border-clay/10 dark:border-sand/15">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-clay/50 dark:text-sand/50 font-mono">
              © 2026 Camel Caravan Logistics Enterprise Inc. • PostgreSQL v16.4 Engine
            </p>
            <button
              id="terminal-expand-btn"
              type="button"
              onClick={() => setShowTerminal(!showTerminal)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-clay/20 dark:border-sand/20 hover:bg-clay/5 dark:hover:bg-sand/5 transition-all text-[11px] font-mono text-clay/80 dark:text-sand/80 flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal size={12} className={showTerminal ? 'text-terracotta' : ''} />
              <span>{showTerminal ? 'Close Postgres Console' : 'Open Postgres Console'}</span>
            </button>
          </div>

          {showTerminal && (
            <div className="mt-4 animate-fade-in">
              <ServerLogger />
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
