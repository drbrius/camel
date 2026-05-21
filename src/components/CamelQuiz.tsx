import { useState } from 'react';
import { QuizQuestion } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, RefreshCw, Trophy } from 'lucide-react';

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: `You are stranded in the Sahara with 1 liter of water. What is your immediate strategy?`,
    options: [
      'Drink it all in one dramatic toast to the desert gods.',
      'Seek camel shade and ration it in tiny sips under cover.',
      'Pour it on your head to look fresh and majestic for incoming helicopters.',
      'Scream at the sun until it goes down.'
    ],
    correctIndex: 1,
    explanation: 'Rationing in shade is the golden law of desert survival. Pouring water on your head just wastes precious hydration!',
    points: 25
  },
  {
    id: 2,
    question: 'How do you greet a majestic double-humped Gobi camel?',
    options: [
      'Slap a physical high-five onto its front hump.',
      'Offer a handful of dry dates and make soft blowing sounds to its nostrils.',
      'Challenge it to a deep staring contest to establish authority.',
      'Stare at your phone and ignore its cultural presence.'
    ],
    correctIndex: 1,
    explanation: 'Camels recognize olfactory greetings. Dates and gentle nostril breaths signify respect, whereas high-fiving might trigger a defensive kick!',
    points: 25
  },
  {
    id: 3,
    question: 'A sudden sandstorm (Haboub) strikes. What is the safest survival posture?',
    options: [
      'Run in circles screaming motivational leadership quotes.',
      'Huddle firmly on the downwind side of your camel, using its body as a natural windbreak.',
      'Climb the nearest palm tree to signal your coordinates.',
      'Attempt to vacuum the sand as it lands.'
    ],
    correctIndex: 1,
    explanation: 'Sitting side-by-side with your resting camel provides an incredible shield. It is heavy, steady, and knows how to close its nostrils!',
    points: 25
  },
  {
    id: 4,
    question: 'Truly, why does a healthy camel have humps?',
    options: [
      'They are filled with refreshing pure drinking water.',
      'They store dense fibrous fat deposits to synthesize energy during starving spells.',
      'They are hollow air suspension shock-absorbers for riding comfort.',
      'They are decorative status accessories.'
    ],
    correctIndex: 1,
    explanation: 'It is a myth that humps store water! They are actually concentrated fat reservoirs, minimizing heat insulation across the rest of the body.',
    points: 25
  }
];

interface CamelQuizProps {
  onQuizComplete: (score: number) => void;
  savedScore?: number;
}

export default function CamelQuiz({ onQuizComplete, savedScore }: CamelQuizProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pointsTotal, setPointsTotal] = useState(0);
  const [quizFinished, setQuizFinished] = useState(savedScore ? true : false);
  const [finalScore, setFinalScore] = useState(savedScore || 0);

  const activeQuestion = QUIZ_QUESTIONS[currentIdx];

  const handleOptionSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedOpt(idx);
  };

  const handleSubmit = () => {
    if (selectedOpt === null || isSubmitted) return;
    setIsSubmitted(true);
    const correct = selectedOpt === activeQuestion.correctIndex;
    if (correct) {
      setPointsTotal(prev => prev + activeQuestion.points);
    }
  };

  const handleNext = () => {
    const isCorrect = selectedOpt === activeQuestion.correctIndex;
    const scoredPoints = isCorrect ? activeQuestion.points : 0;
    
    setSelectedOpt(null);
    setIsSubmitted(false);

    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      const computedScore = pointsTotal + (isCorrect ? activeQuestion.points : 0);
      setFinalScore(computedScore);
      setQuizFinished(true);
      onQuizComplete(computedScore);
    }
  };

  const handleRetry = () => {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setIsSubmitted(false);
    setPointsTotal(0);
    setQuizFinished(false);
    setFinalScore(0);
    onQuizComplete(0);
  };

  return (
    <div id="camel-quiz-card" className="border border-clay/15 dark:border-sand/15 bg-sand/30 dark:bg-white/5 rounded-2xl shadow-sm p-6 overflow-hidden relative">
      <div className="flex items-center justify-between mb-4 border-b border-clay/10 dark:border-sand/10 pb-3">
        <div>
          <h3 className="serif font-semibold text-lg text-clay dark:text-sand flex items-center gap-2">
            <Trophy size={18} className="text-terracotta" />
            <span>Desert Worthiness Quiz</span>
          </h3>
          <p className="text-xs text-olive dark:text-terracotta font-mono mt-0.5 uppercase tracking-wide">
            Boost your trade payouts by demonstrating survival intelligence
          </p>
        </div>
        {!quizFinished && (
          <span className="text-xs font-mono bg-sand dark:bg-clay text-clay dark:text-sand px-2.5 py-1 rounded-full border border-clay/10 dark:border-sand/10">
            Q: {currentIdx + 1} / {QUIZ_QUESTIONS.length}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!quizFinished ? (
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-sm font-medium text-clay dark:text-sand/90 leading-relaxed">
              {activeQuestion.question}
            </p>

            <div className="space-y-2">
              {activeQuestion.options.map((option, idx) => {
                let borderStyle = 'border-clay/15 dark:border-sand/15 hover:bg-clay/5 dark:hover:bg-sand/5';
                let bgStyle = 'bg-sand/10 dark:bg-clay/20';
                let icon = null;

                if (selectedOpt === idx) {
                  borderStyle = 'border-terracotta dark:border-terracotta ring-1 ring-terracotta/25';
                  bgStyle = 'bg-terracotta/5 dark:bg-terracotta/10';
                }

                if (isSubmitted) {
                  if (idx === activeQuestion.correctIndex) {
                    borderStyle = 'border-emerald-500 dark:border-emerald-400 ring-1 ring-emerald-500/20';
                    bgStyle = 'bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300';
                    icon = <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
                  } else if (selectedOpt === idx) {
                    borderStyle = 'border-rose-500 dark:border-rose-400 ring-1 ring-rose-500/20';
                    bgStyle = 'bg-rose-50/10 dark:bg-rose-950/10 text-rose-900 dark:text-rose-300';
                    icon = <AlertCircle size={16} className="text-rose-500 dark:text-rose-400 shrink-0" />;
                  } else {
                    borderStyle = 'border-clay/5 dark:border-sand/5 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOptionSelect(idx)}
                    disabled={isSubmitted}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${bgStyle} ${borderStyle}`}
                  >
                    <span>{option}</span>
                    {icon}
                  </button>
                );
              })}
            </div>

            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3.5 rounded-xl bg-terracotta/5 dark:bg-terracotta/10 text-xs border border-terracotta/20 text-clay/80 dark:text-sand/80 leading-relaxed"
              >
                <span className="font-semibold text-terracotta dark:text-terracotta block mb-0.5">Explanation:</span>
                {activeQuestion.explanation}
              </motion.div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              {!isSubmitted ? (
                <button
                  type="button"
                  id="quiz-submit-btn"
                  onClick={handleSubmit}
                  disabled={selectedOpt === null}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold bg-terracotta hover:bg-terracotta/90 disabled:opacity-50 text-white transition-all disabled:cursor-not-allowed cursor-pointer"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  type="button"
                  id="quiz-next-btn"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold bg-clay hover:opacity-90 dark:bg-sand dark:text-clay text-white transition-all cursor-pointer"
                >
                  {currentIdx + 1 === QUIZ_QUESTIONS.length ? 'Finish Quiz' : 'Next Question'}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 space-y-4"
          >
            <div className="relative inline-block">
              <div className="w-16 h-16 bg-terracotta/10 dark:bg-terracotta/20 rounded-full flex items-center justify-center mx-auto border border-terracotta/30">
                <Trophy size={32} className="text-terracotta" />
              </div>
              <span className="absolute -top-1 -right-1 bg-terracotta text-white text-[9px] px-2 py-0.5 font-bold rounded-full border border-sand">
                SCORE
              </span>
            </div>

            <div className="max-w-xs mx-auto space-y-1">
              <h4 className="serif font-bold text-xl text-clay dark:text-sand">
                Survival IQ: {finalScore}%
              </h4>
              <p className="text-xs text-clay/70 dark:text-sand/70 leading-relaxed">
                {finalScore > 75 
                  ? '☀️ Outstanding Bedouin leader! Your wisdom earns supreme camel evaluation multipliers (+10 bonus camels)!' 
                  : finalScore >= 50 
                    ? '🐪 Competent Nomad. Your trade evaluations receive moderate bonus considerations (+5 bonus camels).' 
                    : '🌵 Wandering Cactus. Standard trading rates apply, no extra bonus camels for you.'}
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                id="quiz-retry-btn"
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-clay/15 dark:border-sand/15 hover:bg-clay/5 dark:hover:bg-sand/5 text-clay/80 dark:text-sand/80 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Retry Quiz</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
