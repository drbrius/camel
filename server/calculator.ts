import { TradeCalculationInput, TradeCalculationResult, CamelBreed } from '../src/types';

export const CAMEL_BREEDS: CamelBreed[] = [
  {
    id: 'dromedary',
    name: 'Arabian Dromedary',
    scientificName: 'Camelus dromedarius',
    multiplier: 1.0,
    speed: 'High (up to 40 mph)',
    temperament: 'Expressively Vocal & Determined',
    description: 'The classic single-humped desert legend. Celebrated for high-speed caravans, superb heat tolerance, and expressive communication.',
    rarity: 'Common'
  },
  {
    id: 'bactrian',
    name: 'Double-Humped Bactrian',
    scientificName: 'Camelus bactrianus',
    multiplier: 1.4,
    speed: 'Moderate (up to 25 mph)',
    temperament: 'Stoic & Resilient',
    description: 'The ancient two-humped heavy-duty cold-climate titan. Features a ultra-plush rugged wool coat, twin fat repositories, and phenomenal cargo-bearing capabilities.',
    rarity: 'Rare'
  },
  {
    id: 'wild_bactrian',
    name: 'Wild Ancestral Bactrian',
    scientificName: 'Camelus ferus',
    multiplier: 2.2,
    speed: 'Agile (up to 30 mph)',
    temperament: 'Timid & Sovereign',
    description: 'The critically endangered wild champion of the Gobi desert. Highly adapted to drink saline water. A prized historical treasure of unparalleled rarity.',
    rarity: 'Legendary'
  },
  {
    id: 'hybrid_alkahl',
    name: 'Royal Al-Kahl Hybrid',
    scientificName: 'Camelus dromedarius x bactrianus (F1)',
    multiplier: 1.7,
    speed: 'Excellent (up to 45 mph)',
    temperament: 'Gentle & Mighty',
    description: 'A prized F1 hybrid crossing an Arabian sire and a Bactrian dam. Inherits tremendous size, dense single massive hump, and legendary pulling power suited for Sheikhs.',
    rarity: 'Epic'
  }
];

export function calculateCamels(input: TradeCalculationInput): TradeCalculationResult {
  const breed = CAMEL_BREEDS.find(b => b.id === input.breedId) || CAMEL_BREEDS[0];
  let baseCamels = 10;
  const formulaBreakdown: string[] = [];
  let inputSummary = '';

  const details = input.details;

  if (input.category === 'car') {
    const year = details.carYear || 2015;
    const cond = details.carCondition || 'good';
    const fuel = details.carFuel || 'gasoline';
    const carType = details.carType || 'sedan';

    inputSummary = `${year} ${carType} (${cond} condition, fueled by ${fuel})`;

    // Base camel pricing by car type
    if (carType === 'supercar') {
      baseCamels = 35;
      formulaBreakdown.push('🚗 Elite supercar base tier: +35 camels.');
    } else if (carType === 'suv') {
      baseCamels = 20;
      formulaBreakdown.push('🚙 Solid SUV class base tier: +20 camels.');
    } else if (carType === 'truck') {
      baseCamels = 24;
      formulaBreakdown.push('🛻 Heavy-duty truck framework: +24 camels.');
    } else if (carType === 'sedan') {
      baseCamels = 12;
      formulaBreakdown.push('🚗 Standard commuter sedan base tier: +12 camels.');
    } else {
      baseCamels = 6;
      formulaBreakdown.push('🚲 Compact/Microcar base tier: +6 camels.');
    }

    // Year multiplier
    if (year >= 2024) {
      baseCamels += 10;
      formulaBreakdown.push('✨ Showroom brand new year bonus (>= 2024): +10 camels.');
    } else if (year >= 2018) {
      baseCamels += 5;
      formulaBreakdown.push('📅 Modern digital dashboard year bonus (>= 2018): +5 camels.');
    } else if (year <= 2005) {
      baseCamels += 4; // Classic bonus!
      formulaBreakdown.push('👵 Retro vintage aesthetic value (<= 2005): +4 camels.');
    }

    // Condition coefficients
    if (cond === 'excellent') {
      baseCamels = Math.round(baseCamels * 1.5);
      formulaBreakdown.push('🧼 Pristine, wax-coated exterior condition: x1.5 multiplier.');
    } else if (cond === 'poor') {
      baseCamels = Math.max(1, Math.round(baseCamels * 0.45));
      formulaBreakdown.push('🛠️ Clunky, oil-dripping transmission state: x0.45 multiplier.');
    } else if (cond === 'scrap') {
      baseCamels = 1;
      formulaBreakdown.push('💀 Salvage title metal scrap condition: Degraded to 1 camel.');
    }

    // Fuel multipliers
    if (fuel === 'electric') {
      baseCamels += 6;
      formulaBreakdown.push('🔋 Sustainable Lithium EV battery bonus: +6 camels.');
    } else if (fuel === 'diesel') {
      baseCamels += 3;
      formulaBreakdown.push('⛽ Reliable diesel torque engine: +3 camels.');
    }

  } else if (input.category === 'wife_girlfriend') {
    const age = details.partnerAge || 30;
    const hair = details.partnerHair || 'brown';
    const eyes = details.partnerEye || 'brown';
    const cooking = details.partnerCooking || 'average';
    const humor = details.partnerHumor || 'average';
    const patience = details.partnerPatience || 'average';

    inputSummary = `${age}-year-old partner, ${hair} hair, ${eyes} eyes, cooking: ${cooking}`;

    // Base value for gorgeous companion
    baseCamels = 25;
    formulaBreakdown.push('👩 Partner base caravan tier: +25 camels.');

    // Age distribution curve (playful camel logistics - all ages highly valued with specific traits!)
    if (age >= 18 && age <= 25) {
      baseCamels += 12;
      formulaBreakdown.push('⚡ Peak athletic desert wanderer age bracket (18-25): +12 camels.');
    } else if (age >= 26 && age <= 35) {
      baseCamels += 15;
      formulaBreakdown.push('💡 Highly integrated intelligence & balance bracket (26-35): +15 camels.');
    } else if (age >= 36 && age <= 50) {
      baseCamels += 18;
      formulaBreakdown.push('🏛️ Absolute mature master wisdom and command bracket (36-50): +18 camels.');
    } else {
      baseCamels += 20;
      formulaBreakdown.push('👑 Supreme legendary legacy wisdom and experience level (>50): +20 camels.');
    }

    // Cooking multiplier
    if (cooking === 'masterpiece') {
      baseCamels += 14;
      formulaBreakdown.push('🍳 Master Chef (can cook gourmet Michelin-tier desert tagine): +14 camels.');
    } else if (cooking === 'poor') {
      baseCamels = Math.max(5, baseCamels - 6);
      formulaBreakdown.push('🥪 Culinary hazard (regularly chars toast and burns water): -6 camels.');
    } else {
      baseCamels += 4;
      formulaBreakdown.push('🍲 Solid home meal builder: +4 camels.');
    }

    // Humor levels
    if (humor === 'excellent') {
      baseCamels += 8;
      formulaBreakdown.push('😂 Sarcastic & laughing companion (High-tier standup quality): +8 camels.');
    } else if (humor === 'dry') {
      baseCamels += 5;
      formulaBreakdown.push('🌵 British-tier dry desert sarcasm expert: +5 camels.');
    }

    // Patience score
    if (patience === 'saint') {
      baseCamels += 11;
      formulaBreakdown.push('😇 Saintly tolerance (survives all your weird hobbies): +11 camels.');
    } else if (patience === 'low') {
      baseCamels = Math.max(5, baseCamels - 4);
      formulaBreakdown.push('💥 Spiced jalapeno temper triggers instantly: -4 camels for high hazard warning.');
    }

    // Eye and Hair color bonus configurations
    if (eyes === 'green' || eyes === 'blue') {
      baseCamels += 4;
      formulaBreakdown.push(`👁️ Rare shining ocean-colored eyes (${eyes}): +4 camels.`);
    }
    if (hair === 'red' || hair === 'blonde') {
      baseCamels += 3;
      formulaBreakdown.push(`👩 Elegant rare hair color (${hair}): +3 camels.`);
    }

  } else if (input.category === 'husband_boyfriend') {
    const age = details.husbandAge || 30;
    const height = details.husbandHeight || '6ft';
    const beard = details.husbandBeard || 'none';
    const dadJokes = details.husbandDadJokes || 'average';
    const handy = details.husbandHandy || 'average';

    inputSummary = `${age}-year-old guy, height ${height}, ${beard} beard, handy: ${handy}`;

    baseCamels = 22;
    formulaBreakdown.push('👨 Husband/Boyfriend base caravan tier: +22 camels.');

    // Tall height bonus
    if (height === '6ft_plus') {
      baseCamels += 12;
      formulaBreakdown.push('🦒 Tall stature tree-climber status (6ft+): +12 camels.');
    } else if (height === '5ft8_to_6ft') {
      baseCamels += 6;
      formulaBreakdown.push('🕺 Standard tall robust posture (5ft8 to 6ft): +6 camels.');
    } else {
      baseCamels += 8; // Pocket king bonus!
      formulaBreakdown.push('👑 High-efficiency low-center-of-gravity pocket king bonus: +8 camels.');
    }

    // Dad Jokes multiplier
    if (dadJokes === 'elite') {
      baseCamels += 10;
      formulaBreakdown.push('🗣️ Critical continuous dad joke production (giggles guaranteed): +10 camels.');
    } else if (dadJokes === 'painful') {
      baseCamels = Math.max(4, baseCamels - 3);
      formulaBreakdown.push('😬 Groan-inducing terminal puns (causes mild headaches): -3 camels.');
    }

    // Handy skills
    if (handy === 'survivalist') {
      baseCamels += 12;
      formulaBreakdown.push('🛠️ Absolute MacGyver (can build shelter, fix leaking pipes, wire solar): +12 camels.');
    } else if (handy === 'useless') {
      baseCamels = Math.max(4, baseCamels - 7);
      formulaBreakdown.push('🚫 Incapable of operating standard screwdrivers: -7 camels.');
    } else {
      baseCamels += 3;
      formulaBreakdown.push('🔨 Solves basic shelf assembly tasks: +3 camels.');
    }

    // Beard bonus
    if (beard === 'glorious') {
      baseCamels += 7;
      formulaBreakdown.push('🧔 Majestic full lumberjack beard: +7 camels.');
    } else if (beard === 'stubble') {
      baseCamels += 3;
      formulaBreakdown.push('🪒 Smooth short stubble premium friction factor: +3 camels.');
    }

  } else if (input.category === 'device') {
    const brand = details.deviceBrand || 'apple';
    const cond = details.deviceCondition || 'mint';
    const age = details.deviceAge || 'new';

    inputSummary = `${brand} device in ${cond} state, age: ${age}`;

    if (brand === 'apple') {
      baseCamels = 4;
      formulaBreakdown.push('🍏 Apple premium brand luxury taxation: +4 camels.');
    } else if (brand === 'samsung') {
      baseCamels = 3;
      formulaBreakdown.push('📱 Samsung flagship electronics credit: +3 camels.');
    } else {
      baseCamels = 2;
      formulaBreakdown.push('📟 Generic Android / Unix open-source mainframe value: +2 camels.');
    }

    if (cond === 'mint') {
      baseCamels += 2;
      formulaBreakdown.push('💎 Brand new, protective screen glass, zero scratches: +2 camels.');
    } else if (cond === 'cracked') {
      baseCamels = Math.max(1, baseCamels - 2);
      formulaBreakdown.push('⚡ Screen spiderweb cracked pattern: -2 camels.');
    }

    if (age === 'antique') {
      baseCamels += 3; // Antique collector tax
      formulaBreakdown.push('💾 Antique collectors item (functional fossil hardware): +3 camels.');
    }

  } else {
    // CATEGORY: SOUL
    const purity = details.soulPurity || 'average';
    const history = details.soulHistory || 'saintly';

    inputSummary = `${purity} soul with ${history} karma history`;

    baseCamels = 15;
    formulaBreakdown.push('🔮 Spiritual immortal soul standard evaluation: +15 camels.');

    if (purity === 'saintly') {
      baseCamels += 15;
      formulaBreakdown.push('😇 Radiant angelic holy aura (glowing halo factor): +15 camels.');
    } else if (purity === 'sinister') {
      baseCamels = 1;
      formulaBreakdown.push('😈 Heavily mortgaged, shady contracts pending, dark shadow: reduced to 1 camel.');
    }

    if (history === 'redemption') {
      baseCamels += 5;
      formulaBreakdown.push('🔄 Complete moral redemption story arc kicker: +5 camels.');
    }
  }

  // Quiz evaluation bonus!
  if (input.quizScore > 0) {
    const quizBonuses = Math.round(input.quizScore / 10);
    if (quizBonuses > 0) {
      baseCamels += quizBonuses;
      formulaBreakdown.push(`🏜️ Desert survival quiz performance bonus (${input.quizScore}%): +${quizBonuses} camels.`);
    }
  }

  // Multiply by Breed Coefficient
  let finalCamelCount = Math.round(baseCamels * breed.multiplier);
  if (finalCamelCount < 1) finalCamelCount = 1;

  formulaBreakdown.push(`🐪 Selected Breed Multiplier [${breed.name} (x${breed.multiplier})]: Calculated core camel output.`);

  // Grade the overall trading quality!
  let dealGrade = 'Fair Desert Trade';
  if (finalCamelCount >= 45) {
    dealGrade = '🥇 Golden Sultan Deal';
  } else if (finalCamelCount >= 30) {
    dealGrade = '🥈 High Oasis Merchant';
  } else if (finalCamelCount >= 15) {
    dealGrade = '🥉 Reputable Bedouin Deal';
  } else if (finalCamelCount >= 6) {
    dealGrade = '🌵 Scrub Dry-Shrub Swap';
  } else {
    dealGrade = '🫠 Sinking Quick-Sand Loss';
  }

  return {
    id: `trade_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    category: input.category,
    breedId: breed.id,
    breedName: breed.name,
    camelCount: finalCamelCount,
    dealGrade,
    formulaBreakdown,
    inputSummary,
    proAnalysisUnlocked: false // Locked under "Camel Pro Analytics" premium upgrade
  };
}
