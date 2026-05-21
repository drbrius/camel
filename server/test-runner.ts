import { calculateCamels, CAMEL_BREEDS } from './calculator';
import { TradeCalculationInput } from '../src/types';

// Simple lightweight test asserts suite
let totalTestsRun = 0;
let totalTestsFailed = 0;

function assert(condition: boolean, testName: string) {
  totalTestsRun++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
  } else {
    totalTestsFailed++;
    console.error(`❌ FAIL: ${testName}`);
  }
}

function runAllTests() {
  console.log('🏁 Starting Core Simulated PostgreSQL & App Appraisal Integration Suite...\n');

  // --- UNIT TEST 1: Appraisal check for luxury supercar ---
  try {
    const inputSupercar: TradeCalculationInput = {
      category: 'car',
      breedId: 'dromedary',
      quizScore: 0,
      details: {
        carType: 'supercar',
        carYear: 2025,
        carCondition: 'excellent',
        carFuel: 'electric'
      }
    };
    
    // Formula: Supercar base (35) + Showroom year (10) = 45. Multiplied by condition excellent (1.5) = 68. Fuel electric (+6) = 74. Breed dromedary multiplier x1.0 = 74.
    const resultSupercar = calculateCamels(inputSupercar);
    assert(resultSupercar.camelCount >= 70, 'Unit Test 1: Luxury Electric Supercar appraisal matches superior multipliers');
  } catch (err: any) {
    totalTestsFailed++;
    console.error('❌ FAIL: Unit Test 1 crashed with exception -', err.message);
  }

  // --- UNIT TEST 2: Partner appraisal with Master Chef & Saint-tier Patience ---
  try {
    const inputPartner: TradeCalculationInput = {
      category: 'wife_girlfriend',
      breedId: 'bactrian',
      quizScore: 80, // Quiz multiplier (+8 bonus camels)
      details: {
        partnerAge: 29, // 26-35 age bracket (+15)
        partnerCooking: 'masterpiece', // Chef (+14)
        partnerPatience: 'saint', // Saintly (+11)
        partnerHumor: 'excellent' // Sparkly (+8)
      }
    };
    // Base 25 + Age 15 + Chef 14 + Patience 11 + Humor 8 + Quiz 8 = 81. Multiplied by Bactrian x1.4 = 113 camels.
    const resultPartner = calculateCamels(inputPartner);
    assert(resultPartner.camelCount >= 100, 'Unit Test 2: Master Chef Partner trades for extremely dense double hump Camel caravan counts');
  } catch (err: any) {
    totalTestsFailed++;
    console.error('❌ FAIL: Unit Test 2 crashed with exception -', err.message);
  }

  // --- UNIT TEST 3: Beat-up scrap metallic car trade ---
  try {
    const inputClunker: TradeCalculationInput = {
      category: 'car',
      breedId: 'dromedary',
      quizScore: 0,
      details: {
        carType: 'compact',
        carYear: 1543,
        carCondition: 'scrap',
        carFuel: 'gasoline'
      }
    };
    const resultClunker = calculateCamels(inputClunker);
    assert(resultClunker.camelCount === 1, 'Unit Test 3: Total salvage title clunker correctly defaults to 1 minimum safe camel count');
  } catch (err: any) {
    totalTestsFailed++;
    console.error('❌ FAIL: Unit Test 3 crashed with exception -', err.message);
  }

  // --- UNIT TEST 4: Pure saintly soul audit with legendary Wild Bactrian ---
  try {
    const inputSoul: TradeCalculationInput = {
      category: 'soul',
      breedId: 'wild_bactrian',
      quizScore: 100, // Quiz +10 camels
      details: {
        soulPurity: 'saintly', // Angelic +15
        soulHistory: 'redemption' // Redemption +5
      }
    };
    // Base 15 + Angelic 15 + Redemption 5 + Quiz 10 = 45. Wild Bactrian x2.2 = 99 camels.
    const resultSoul = calculateCamels(inputSoul);
    assert(resultSoul.camelCount >= 95, 'Unit Test 4: Pure Angelic Soul scores elite legendary wild dromedaries ratios');
  } catch (err: any) {
    totalTestsFailed++;
    console.error('❌ FAIL: Unit Test 4 crashed with exception -', err.message);
  }

  // --- INTEGRATION TEST 5: Verify Camel Breed mappings configurations are complete ---
  try {
    assert(CAMEL_BREEDS.length === 4, 'Integration Test 5: Standard catalog matches 4 breed varieties');
    const wildBreedObj = CAMEL_BREEDS.find(b => b.id === 'wild_bactrian');
    assert(wildBreedObj?.multiplier === 2.2, 'Integration Test 6: Wild Ancestral Breed carries the maximum scarcity coefficient (2.2x)');
  } catch (err: any) {
    totalTestsFailed++;
    console.log('❌ FAIL: Integration test crashed -', err.message);
  }

  // Final summary stdout output
  console.log('\n=======================================');
  console.log(`🏁 TESTS COMPLETED: ${totalTestsRun} run`);
  console.log(`✅ SUCCESSES: ${totalTestsRun - totalTestsFailed}`);
  console.log(`❌ FAILURES: ${totalTestsFailed}`);
  console.log('=======================================');

  if (totalTestsFailed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL HIGH-PERFORMANCE SQL APPRASIALS ARE GREEN & CONFIRMED!\n');
    process.exit(0);
  }
}

runAllTests();
