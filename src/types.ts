export type TradeItemCategory = 'car' | 'wife_girlfriend' | 'husband_boyfriend' | 'device' | 'soul';

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface CamelBreed {
  id: string;
  name: string;
  scientificName: string;
  multiplier: number; // multiplies the camel count or cost factor
  speed: string;
  temperament: string;
  description: string;
  rarity: Rarity;
  imageUrl?: string;
}

export interface TradeCalculationInput {
  category: TradeItemCategory;
  breedId: string;
  quizScore: number; // 0 to 100
  details: {
    // Car details
    carType?: string;
    carYear?: number;
    carCondition?: string;
    carMileage?: string;
    carFuel?: string;
    
    // Wife/Girlfriend details
    partnerAge?: number;
    partnerHair?: string;
    partnerEye?: string;
    partnerCooking?: string; // poor, average, masterpiece
    partnerHumor?: string;
    partnerPatience?: string;
    
    // Husband/Boyfriend details
    husbandAge?: number;
    husbandHeight?: string;
    husbandBeard?: string;
    husbandDadJokes?: string;
    husbandHandy?: string;
    
    // Device details
    deviceBrand?: string;
    deviceAge?: string;
    deviceCondition?: string;
    
    // Soul details
    soulPurity?: string;
    soulHistory?: string;
  };
}

export interface TradeCalculationResult {
  id: string;
  timestamp: string;
  category: TradeItemCategory;
  breedId: string;
  breedName: string;
  camelCount: number;
  dealGrade: string; // "Golden Merchant", "Fair Nomad", "Dehydrated Cactus", etc.
  formulaBreakdown: string[];
  inputSummary: string;
  proAnalysisUnlocked: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
}

export interface ServerLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'QUERY';
  message: string;
  durationMs?: number;
  query?: string;
}

export interface DBStats {
  totalTrades: number;
  byCategory: Record<TradeItemCategory, number>;
  byBreed: Record<string, number>;
  averageCamels: number;
  totalErrors: number;
  dbSizeKb: number;
  cacheHitRatio: number;
}
