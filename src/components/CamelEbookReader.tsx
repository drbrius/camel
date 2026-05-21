import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { 
  BookOpen, 
  Download, 
  ChevronRight, 
  Award, 
  Compass, 
  Key, 
  Zap, 
  PieChart, 
  Coins, 
  CheckSquare, 
  HelpCircle,
  FileCheck,
  TrendingUp,
  LineChart,
  FileText
} from 'lucide-react';

interface Chapter {
  id: string;
  num: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  camelLore: string;
  mindset: {
    title: string;
    philosophy: string;
    shift: string;
  };
  ideas: {
    whereToLook: string;
    opportunities: string[];
  };
  execution: {
    steps: string[];
    riskMitigation: string;
  };
  interactiveChecklist: string[];
}

export default function CamelEbookReader() {
  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [showDownloadSuccess, setShowDownloadSuccess] = useState<boolean>(false);
  const [sellingPrice, setSellingPrice] = useState<number>(49); // Price state for a premium look

  const chapters: Chapter[] = [
    {
      id: 'mindset',
      num: 1,
      title: 'The Psychology of the Nomad Merchant',
      subtitle: 'Mapping Empty Dunes to Oasis Goldmines',
      icon: <Compass className="text-terracotta shrink-0" size={18} />,
      camelLore: 'Four thousand years ago on the Silk Road, merchants did not see the vast Gobi or Sahara as life-threatening voids. Instead, they recognized that the desert is an arbitrage buffer. The sand itself holds zero value, but by crossing it, you move commodities from where they are cheap (surplus oases) to where they are desperately needed (foreign capitals). To a Nomad Merchant, a camel is not a beast of burden—it is liquid energy storage, high-heat transportation capital, and the ultimate leverage to bridge value discrepancies.',
      mindset: {
        title: 'Nomadic Abundance vs. Stationary Scarcity',
        philosophy: 'The stationary merchant waits inside the city walls, fearing fluctuating wheat prices. The nomad trader moves. True entrepreneurs separate themselves from geographic and cognitive limitations. Scarcity is an illusion of the stationary mind; abundance lies in bridging information gaps.',
        shift: 'Stop selling your time at a fixed rate in a single station. Begin measuring empty spaces (problems, gaps in speed, technical translation deficits) and build caravans (systems) to bridge them.'
      },
      ideas: {
        whereToLook: 'Look for "Friction Coordinates" in boring, traditional industries. Inspect places where old tradesmen do not use modern communication links, or where digital solutions have not penetrated the high-touch craft worlds.',
        opportunities: [
          'Unstructured Knowledge Gaps: Translating complex technical manuals (e.g., AI prompting or API setups) for traditional local businesses (roofers, plumbers, dentists).',
          'Administrative Logistical Flaws: Small businesses using paper scheduling sheets or inefficient routes.',
          'Localized Supply Gaps: Bulk raw materials sitting obsolete in industrial zones that could be micro-distributed online.'
        ]
      },
      execution: {
        steps: [
          'Identify 3 localized niches that have existed for over 20 years without substantial technological evolution.',
          'Interview 5 business owners in these niches. Ask: "What is the single most clunky, annoying manual task you repeat every single day?"',
          'Do not suggest code; promise the resulting output. Reframe their pain-points as your new trading route.'
        ],
        riskMitigation: 'Invest zero currency in software initially. Treat your own time as a sweat-equity caravan. Do the work manually first before seeking automation.'
      },
      interactiveChecklist: [
        'Recognized that "gaps" and "annoyances" are premium arbitrage zones',
        'Identified 3 local non-tech industries to research',
        'Drafted a 1-sentence description of my personal "internal camel" (skills/leverage)',
        'Vowed to never spend capital on an idea before validating it with a real offer'
      ]
    },
    {
      id: 'zero_capital',
      num: 2,
      title: 'Phase I: Empty Saddlebags',
      subtitle: 'Starting Businesses with Zero Capital (Sweat Arbitrage)',
      icon: <Coins className="text-terracotta shrink-0" size={18} />,
      camelLore: 'In ancient Phoenician shipping ports, young boys starting with zero sheep or coins would study the tides and the incoming dhows. They offered to track loose ropes, coordinate dock weights, or find runaway baggage. They didn\'t demand silver coin—instead, they asked for a tiny percentage of the cargo, or the right to buy scrap wood from the vessel. Within three seasons, these boys constructed entire merchant rafts using pure salvaged elements and deep localized knowledge of port dynamics.',
      mindset: {
        title: 'Perspiration Leverage & Service Arbitrage',
        philosophy: 'Capital is nothing but stored energy. If you possess no financial capital (stored energy), you must deploy kinetic energy (perspiration, speed, and positioning). Zero capital is an extreme competitive advantage: you have zero overhead, zero burning rent, and infinite adaptability.',
        shift: 'Do not lament the lack of investment. A gold merchant with full vaults is slow to adapt. Move fast, capture high-margin active service contracts, and convert your sweat into capital reservoirs.'
      },
      ideas: {
        whereToLook: 'Look for labor-intensive, high-ticket services that require minimal equipment. Look at what successful businesses are buying every week (copywriting, design, basic lead generation, scheduling, client onboarding).',
        opportunities: [
          'Caravan Lead Sourcing: Manual scrapings of high-quality leads for luxury service providers (e.g., finding newly purchased estates and offering them custom interior designers).',
          'Review Harvester: Securing Google Reviews for local companies by setting up free automated SMS campaigns manually, claiming 50% of the growth value.',
          'Digital Asset Polishing: Updating outdated websites or social media graphics of highly profitable local contractors who do not have time for visual design.'
        ]
      },
      execution: {
        steps: [
          'Choose a specific skill you can execute in 3-4 hours (e.g., crafting visual social templates or optimizing search keywords).',
          'Select 15 local companies operating on old layouts or with bad digital visibility.',
          'Send a "Value First Caravan": Send them 3 fully finished custom graphics or a 3-minute personalized screen recording showing the exact solution, for free.',
          'Execute with high integrity. In the email, state: "I completed these templates for you to use. If you like them and want me to handle this for you monthly, here is the price. If not, they are yours to keep as a desert gift."'
        ],
        riskMitigation: 'Never promise results you cannot deliver. If they accept, work late nights to over-fulfill. Your early reputation is your most durable trade bond.'
      },
      interactiveChecklist: [
        'Created a list of 15 targeted local business websites with visible optimization gaps',
        'Recorded at least 3 custom screen-recordings highlighting free value improvements',
        'Drafted an email template focused entirely on the merchant\'s gain rather than my need',
        'Secured the first tiny service agreement or valuable relationship contact'
      ]
    },
    {
      id: 'opm',
      num: 3,
      title: 'Phase II: Riding Others\' Camels',
      subtitle: 'Leveraging Other People\'s Money (The Mudarabah Framework)',
      icon: <Zap className="text-terracotta shrink-0" size={18} />,
      camelLore: 'In the great trading hubs of Babylon and Palmyra, the "Mudarabah" contract was created. It was the ancestral venture capital framework. A wealthy silent trade partner (the Rabb al-mal) possessed cash and herds of camels but did not want to climb rocky plateaus or handle sandstorms. A young, skilled navigator (the Mudarib) possessed no camels, but held intimate knowledge of water holes and tribal alliances. Under Mudarabah rules, they combined forces. If the caravan succeeded, profits were split 50/50. If the caravan perished, the investor bore the financial loss of the camels, while the navigator lost only their time and navigation effort. Trust was worth more than gold.',
      mindset: {
        title: 'Trust as the True Collateral',
        philosophy: 'Wealthy individuals own stagnant capital that yields poor returns due to inflation. They are desperately searching for high-yield vectors. Money is a coward; it wants to hide in productive shelters. If you possess the navigation plan (deal sourcing, speed, and execution), you are the high-value partner. Capital needs ideas more than ideas need capital.',
        shift: 'Stop asking for "favors" or "loans." Reframe your pitch: You are providing the busy capitalist with a high-integrity, risk-mitigated vehicle to multiply their dormant wealth.'
      },
      ideas: {
        whereToLook: 'Look for "Underutilized Capital Reservoirs." Retired professionals, parents with savings yielding 1%, quiet landlords, or local business owners with positive corporate cash reserves looking to diversify.',
        opportunities: [
          'Joint Venture Franchise Master: Raising funds from local passive investors is easy if you acquire a boring cash-flow franchise (e.g., absolute utility car washes, waste bin companies) and run the operation.',
          'The Land Arbitrage Caravan: Securing micro-parcels with seller-financing, subdividing them, or packaging them with small eco-domes using investor capital.',
          'Micro-Acquisitions: Partnering to acquire an operating Shopify store or a local newsletter from an owner who is burned out and wants a quick cash exit.'
        ]
      },
      execution: {
        steps: [
          'Build a "Pro forma Trade Caravan sheet" (financial projection modeling). Keep the numbers realistic, including worst-case sandstorms.',
          'Structure an asymmetric safety cushion: Offer your partner a 70% preferential payback until they recover 100% of their investment, then transition to a 50/50 profit split.',
          'Deliver monthly transparency reports (the "Caravan Manifest"). If they see flawless accounting, their friends will want to invest, too.'
        ],
        riskMitigation: 'Ensure your investors are accredited or understand the risk profile. Keep legal structures separated in a standard clean vehicle.'
      },
      interactiveChecklist: [
        'Calculated an exact project cost sheet modeling both dry and lush market scenarios',
        'Drafted an asymmetric payback option protecting the investor\'s downside first',
        'Identified 3 "Dormant Capital" individuals in my network or local investment circles',
        'Practiced the pitch focusing 90% on their safety and 10% on the theoretical upside'
      ]
    },
    {
      id: 'doubling',
      num: 4,
      title: 'Phase III: Breeding the Caravan',
      subtitle: 'The Velocity of Reinvestment (How to Double Your Money)',
      icon: <TrendingUp className="text-terracotta shrink-0" size={18} />,
      camelLore: 'The ancient Sheikhs of Petra never consumed the first milk of a newborn female camel. That camel was sheltered, nourished, and paired with the fastest Al-Kahl stud. The Sheikhs knew that if you eat your breeding stock, you eat your future. One camel became two, two became four, and four became a self-generating dynasty. They calculated wealth not by the gold chest in the cellar, but by the breeding rate of the caravan.',
      mindset: {
        title: 'Compound Velocity & Hump Capital Preservation',
        philosophy: 'A businessman\'s greatest trap is lifestyle creep. As soon as the service contracts pay $5k a month, they borrow a pristine sedan. This is the equivalent of drinking your primary female camel\'s first milk and starving the herd. You must live like a nomadic desert ranger until your passive assets comfortably bear your living costs. Capital must be recycled into the engine with maximum velocity.',
        shift: 'Treat every $100 earned from service tasks as a dynamic soldier. Do not spend it. Breed it by buying mechanical capital tools (SaaS licenses, ads, outsourcing junior labor) that buy you more hours.'
      },
      ideas: {
        whereToLook: 'Look inside your own active business operations. Find where your hours are bound (answering emails, graphic drafts, scheduling). Buy specialized systems or outsource that exact bottleneck to unlock multiplication.',
        opportunities: [
          'Arbitrage Delegation: Hiring junior coordinators at $8/hr to execute the templates you designed, while you sell the package to 3 new clients at $80/hr.',
          'Capitalized Ads Campaign: Reinvesting 50% of monthly revenues directly into hyper-targeted Meta/Google ads, turning $10 of ad spend into $45 of service margin.',
          'Micro-tool Automation: Using tools to tie sequences together, replacing manual work that took you 3 hours a day with a 12-second trigger.'
        ]
      },
      execution: {
        steps: [
          'Take your active monthly profits. Separate them into two clean vaults: 30% for your simple living costs, 70% for the "Breeding Pool" (reinvestment).',
          'Map your daily hours tracker. Circle any task that is repetitive and does not require a genius mind.',
          'Write a step-by-step operating guide (the "SOP") for that task and hire your first junior VA. Monitor them with a lightweight daily checklist.'
        ],
        riskMitigation: 'Only hire when you are consistently turning away clients due to time block constraints. Delegate operations, never your core sales pipeline.'
      },
      interactiveChecklist: [
        'Separated a corporate ledger tracking "Breeding Pool" capital strictly',
        'Logged my daily tasks for 7 days to isolate low-complexity bottlenecks',
        'Drafted a 1-page standard operating procedure for the most repetitive chore',
        'Vowed to resist all lifestyle upgrades until passive assets exceed active expenses'
      ]
    },
    {
      id: 'investor',
      num: 5,
      title: 'Phase IV: The Oasis Welldeep',
      subtitle: 'Transitioning to the Sovereign Oasis Landlord (The Investor Path)',
      icon: <Award className="text-terracotta shrink-0" size={18} />,
      camelLore: 'In finality, the oldest, most successful caravan masters of the Middle East retired from the trail. They purchased the freshwater wells inside the primary oasis nodes of Palmyra and Damascus. They didn\'t walk behind camels under a 120-degree sun anymore. They built deep brick-lined wells and planted shade palms. Incoming desert travelers, glad to survive the scorching dunes, paid a transaction toll of 1 silver piece per camel to water their herds. The well owner collected pure recurring toll revenue overnight, sleeping in the cool shade of the date trees.',
      mindset: {
        title: ' Toll-Road Infrastructure Ownership',
        philosophy: 'The pinnacle of the Caravan Capitalist is ownership of essential transaction choke-points. You transition from traveling the dunes (active operations) to owning the destination (infrastructure). An investor acquires cash-flowing plumbing that operates independently of human friction. Your goal is to buy systems that collect tolls while you dream.',
        shift: 'Release yourself from the pride of "doing all the work." The greatest businessmen do not operate their empires; they acquire them, fund them, and align the incentivized teams who protect them.'
      },
      ideas: {
        whereToLook: 'Look for boring, cash-generative businesses owned by operators over the age of 60 who have no succession plan or children to take over the firm.',
        opportunities: [
          'Uncontested Service Firms: Buying a reputable local gutter-cleaning or septic business. Keep the loyal crew, install a smart manager, and modernise the billing systems.',
          'Transaction Toll Software: Micro-SaaS tools addressing deep utility gaps inside niches (e.g., custom estimating plugins for carpet cleaners).',
          'Sovereign Real Assets: Utility storage garages, residential properties near logistics depots, or commercial assets yielding net leases.'
        ]
      },
      execution: {
        steps: [
          'Build a list of 10 local businesses in boring lines (laundromats, landscaping, logistics) with simple operations and steady reviews.',
          'Reach out directly to the founder: "I admire the legacy you built. If you have ever considered transition plans or retirement strategies, I would love to buy you a coffee to talk about preserving your crew\'s employment."',
          'Structure your acquisition via "Seller Financing" (paying him out of the company\'s future profits over 5-7 years, requiring very little down-payment).'
        ],
        riskMitigation: 'Perform meticulous forensic auditing (due diligence). Inspect 3 years of tax returns, customer contracts, and equipment debt before signing anything.'
      },
      interactiveChecklist: [
        'Understand the fundamental mechanics of transaction toll-gate investing',
        'Created a prospect list of 10 boring traditional businesses with aging owners',
        'Formulated a target seller-financing offer structure utilizing future free-cashflow',
        'Vowed to transition my focus from daily manual labor to long-term asset building'
      ]
    }
  ];

  // Calculations for camel OPM calculator
  const [opmCamels, setOpmCamels] = useState<number>(30);
  const [investorSplit, setInvestorSplit] = useState<number>(70);
  const [activeYears, setActiveYears] = useState<number>(3);
  const [projectYield, setProjectYield] = useState<number>(25);

  const calculateOpmSplit = () => {
    const totalCamelWorth = opmCamels;
    const initialInvestedVal = totalCamelWorth;
    
    // Project yield per year
    const yearlyGainCount = Math.round(totalCamelWorth * (projectYield / 100));
    const totalRawGains = yearlyGainCount * activeYears;
    
    // Asymmetric preferential payback (70% to investor till they get initial val back, then 50/50)
    let investorShare = 0;
    let nomadShare = 0;
    
    let remainingPayback = initialInvestedVal;
    
    // Year by Year calculation
    for (let yr = 1; yr <= activeYears; yr++) {
      const currentYearGain = yearlyGainCount;
      const investorTake = Math.round(currentYearGain * (investorSplit / 100));
      const navigatorTake = currentYearGain - investorTake;
      
      investorShare += investorTake;
      nomadShare += navigatorTake;
    }

    const totalPortfolioSize = totalCamelWorth + totalRawGains;

    return {
      yearlyGainCount,
      totalRawGains,
      investorShare,
      nomadShare,
      totalPortfolioSize,
      returnOnEquity: ((nomadShare / (initialInvestedVal || 1)) * 100).toFixed(0)
    };
  };

  const opmResults = calculateOpmSplit();

  const handleCheckboxChange = (chkName: string) => {
    setCompletedItems(prev => ({
      ...prev,
      [chkName]: !prev[chkName]
    }));
  };

  const getChapterProgress = (chap: Chapter) => {
    const items = chap.interactiveChecklist;
    const done = items.filter(it => completedItems[`${chap.id}_${it}`]).length;
    return Math.round((done / items.length) * 100);
  };

  // Modern jsPDF export handler with word wrap and page break support
  const handleDownloadPDF = () => {
    setPdfGenerating(true);
    
    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Document styling parameters
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const marginX = 20;
        let runningY = 25;

        // Custom Font & Colors simulation inside PDF
        const setHeaderStyle = () => {
          doc.setFont('times', 'bold');
          doc.setTextColor(192, 86, 33); // Terracotta Match (#C05621)
        };

        const setSubHeaderStyle = () => {
          doc.setFont('times', 'bold');
          doc.setTextColor(44, 36, 32); // Clay Match (#2C2420)
        };

        const setBodyStyle = () => {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60); // Neutral dark
        };

        const renderPageHeader = (chapName?: string) => {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(160, 160, 160);
          doc.text("CAMELTRADES.COM | THE CARAVAN CAPITALIST", marginX, 12);
          if (chapName) {
            doc.text(chapName.toUpperCase(), pageW - marginX - doc.getTextWidth(chapName), 12);
          }
          doc.setDrawColor(220, 220, 210);
          doc.setLineWidth(0.2);
          doc.line(marginX, 14, pageW - marginX, 14);
        };

        const renderPageFooter = (pageNum: number) => {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(160, 160, 160);
          doc.text(`Page ${pageNum}`, pageW / 2, pageH - 12, { align: 'center' });
          doc.text("© 2026 CamelTrades.com. Distributed Globally under Sovereign Nomad License.", marginX, pageH - 12);
        };

        // --- PAGE 1: GORGEOUS EDITORIAL COVER ---
        // Thick framing border
        doc.setDrawColor(192, 86, 33);
        doc.setLineWidth(0.8);
        doc.rect(10, 10, pageW - 20, pageH - 20);

        // Subterran sand background print simulation
        doc.setDrawColor(245, 242, 237);
        doc.setLineWidth(0.1);
        doc.setFillColor(245, 242, 237);
        doc.rect(11, 11, pageW - 22, pageH - 22, 'F');

        // Decorative top motif
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(90, 90, 64); // Olive
        doc.text("S I L K   R O A D   M E R C H A N T   A C A D E M Y", pageW / 2, 45, { align: 'center' });

        // Heavy title
        doc.setFont('times', 'bold');
        doc.setFontSize(38);
        doc.setTextColor(44, 36, 32); // Clay
        doc.text("THE CARAVAN", pageW / 2, 72, { align: 'center' });
        doc.text("CAPITALIST", pageW / 2, 88, { align: 'center' });

        // Accent Line
        doc.setDrawColor(192, 86, 33);
        doc.setLineWidth(1.5);
        doc.line(pageW / 2 - 30, 100, pageW / 2 + 30, 100);

        // Subtitle
        doc.setFont('times', 'italic');
        doc.setFontSize(15);
        doc.setTextColor(100, 100, 100);
        const subLines = doc.splitTextToSize("Ancient Wealth-Building Guidelines from Camel Trade Networks Adapted for Dynamic Modern EntrepreneursS", pageW - 60);
        doc.text(subLines, pageW / 2, 110, { align: 'center' });

        // Decorative Illustration placeholder / outline
        doc.setDrawColor(192, 86, 33);
        doc.setLineWidth(0.3);
        doc.ellipse(pageW / 2, 160, 24, 24);
        doc.setFont('times', 'bold');
        doc.setFontSize(32);
        doc.text("🐪", pageW / 2, 167, { align: 'center' });

        // Metadata block at bottom
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(44, 36, 32);
        doc.text("PREMIUM BUSINESS BLUEPRINT FOR DESERT WEALTH", pageW / 2, 215, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(192, 86, 33);
        doc.text("PUBLISHED BY CAMELTRADES.COM", pageW / 2, 226, { align: 'center' });
        
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("A Sovereign Merchant Manual of Port-Leverage, Zero-Capital Service Arbitrage & Toll Systems", pageW / 2, 236, { align: 'center' });

        renderPageFooter(1);

        // --- CHAPTER WRITER (PAGES 2 to 6) ---
        let pageCounter = 2;

        chapters.forEach(chap => {
          doc.addPage();
          
          // Sand background for pages
          doc.setFillColor(253, 252, 250);
          doc.rect(0, 0, pageW, pageH, 'F');
          
          renderPageHeader(`Chapter ${chap.num}`);
          runningY = 25;

          // Chapter Title
          setHeaderStyle();
          doc.setFontSize(18);
          doc.text(`CHAPTER ${chap.num}: ${chap.title.toUpperCase()}`, marginX, runningY);
          runningY += 7;

          // Subtitle
          setSubHeaderStyle();
          doc.setFontSize(11);
          doc.setFont('times', 'italic');
          doc.text(`"${chap.subtitle}"`, marginX, runningY);
          runningY += 12;

          // Ancient Lore Block with side border decoration
          doc.setDrawColor(192, 86, 33);
          doc.setLineWidth(1.0);
          doc.line(marginX, runningY, marginX, runningY + 45); // Left boundary line

          doc.setFont('times', 'italic');
          doc.setFontSize(9.5);
          doc.setTextColor(90, 80, 70);
          const loreLines = doc.splitTextToSize(chap.camelLore, pageW - 2 * marginX - 6);
          doc.text(loreLines, marginX + 5, runningY + 4);
          
          runningY += 50;

          // Mindset Shift Section
          setHeaderStyle();
          doc.setFontSize(11);
          doc.text("I. THE NOMADIC MINDSET SHIFT", marginX, runningY);
          runningY += 6;

          setBodyStyle();
          doc.setFontSize(9.5);
          const philoLines = doc.splitTextToSize(`Core Concept: ${chap.mindset.philosophy}`, pageW - 2 * marginX);
          doc.text(philoLines, marginX, runningY);
          runningY += philoLines.length * 4.5 + 4;

          const shiftLines = doc.splitTextToSize(`Required Transition: ${chap.mindset.shift}`, pageW - 2 * marginX);
          doc.text(shiftLines, marginX, runningY);
          runningY += shiftLines.length * 4.5 + 8;

          // Where to Look Section
          setHeaderStyle();
          doc.setFontSize(11);
          doc.text("II. DETECTING HIGH-VALUE OPPORTUNITIES", marginX, runningY);
          runningY += 6;

          setBodyStyle();
          doc.setFontSize(9.5);
          const whereLines = doc.splitTextToSize(`Where to search: ${chap.ideas.whereToLook}`, pageW - 2 * marginX);
          doc.text(whereLines, marginX, runningY);
          runningY += whereLines.length * 4.5 + 4;

          doc.setFont('helvetica', 'bold');
          doc.text("Hot Arbitrage Concepts:", marginX, runningY);
          runningY += 5;

          doc.setFont('helvetica', 'normal');
          chap.ideas.opportunities.forEach(opp => {
            const wrappedOpp = doc.splitTextToSize(`• ${opp}`, pageW - 2 * marginX - 4);
            doc.text(wrappedOpp, marginX + 2, runningY);
            runningY += wrappedOpp.length * 4.5 + 2;
          });
          runningY += 5;

          // Execution Protocol Section
          setHeaderStyle();
          doc.setFontSize(11);
          doc.text("III. STEP-BY-STEP EXECUTION PROTOCOL", marginX, runningY);
          runningY += 6;

          setBodyStyle();
          doc.setFont('helvetica', 'bold');
          doc.text("Tactical Milestones:", marginX, runningY);
          runningY += 5;

          doc.setFont('helvetica', 'normal');
          chap.execution.steps.forEach((st, idx) => {
            const wrappedSt = doc.splitTextToSize(`${idx + 1}. ${st}`, pageW - 2 * marginX - 4);
            doc.text(wrappedSt, marginX + 2, runningY);
            runningY += wrappedSt.length * 4.5 + 2;
          });
          runningY += 4;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(190, 80, 40);
          const wrappedRisk = doc.splitTextToSize(`Desert Risk Mitigator: ${chap.execution.riskMitigation}`, pageW - 2 * marginX);
          doc.text(wrappedRisk, marginX, runningY);

          renderPageFooter(pageCounter);
          pageCounter++;
        });

        // Save PDF to Device
        doc.save('The_Caravan_Capitalist_Ebook.pdf');
        setShowDownloadSuccess(true);
        setTimeout(() => setShowDownloadSuccess(false), 5000);
      } catch (err) {
        console.error('PDF Generation Failure:', err);
      } finally {
        setPdfGenerating(false);
      }
    }, 1200);
  };

  const activeChapData = chapters.find(c => c.num === activeChapter) || chapters[0];
  const overallProgress = Math.round(
    (Object.values(completedItems).filter(Boolean).length / 
    chapters.reduce((sum, ch) => sum + ch.interactiveChecklist.length, 0)) * 100
  );

  return (
    <section id="camel-ebook-viewer" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: NAVIGATION & PROGRESS & DOWNLOAD (4 Cols) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* eBook Overview Card */}
        <div className="bg-sand/40 dark:bg-clay/20 border border-clay/10 dark:border-sand/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-terracotta/10 dark:bg-terracotta/20 rounded-xl text-terracotta border border-terracotta/20">
              <BookOpen size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-terracotta block">Premium E-Book</span>
              <h3 className="serif text-xl font-bold tracking-wide text-clay dark:text-sand">The Caravan Capitalist</h3>
            </div>
          </div>
          
          <p className="text-xs text-clay/70 dark:text-sand/60 leading-relaxed">
            The ultimate blueprint to generating real wealth based on Silk Road camel trade mechanics, structured into a modern digital system.
          </p>

          <div className="pt-2 border-t border-clay/5 dark:border-sand/5">
            <div className="flex justify-between items-center text-xs text-clay/60 dark:text-sand/50 font-mono mb-1.5">
              <span>Caravan Progress Checklist:</span>
              <span className="font-bold text-terracotta">{overallProgress}%</span>
            </div>
            <div className="w-full bg-clay/10 dark:bg-sand/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-terracotta h-full transition-all duration-500 rounded-full" 
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="pt-3 flex flex-col gap-2">
            <button
              id="download-ebook-pdf-btn"
              type="button"
              onClick={handleDownloadPDF}
              disabled={pdfGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-terracotta text-white hover:bg-opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              {pdfGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Compiling PDF Pages...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download PDF eBook (Free License)</span>
                </>
              )}
            </button>

            {showDownloadSuccess && (
              <div className="p-2 bg-olive/15 border border-olive/30 text-olive text-[11px] font-mono text-center rounded-lg animate-fade-in dark:text-sand dark:bg-olive/20">
                📥 Secure PDF generated & downloaded successfully!
              </div>
            )}

            <div className="text-center">
              <span className="text-[9px] text-clay/40 dark:text-sand/40 italic font-mono uppercase tracking-wider">
                Authorized Seller: CamelTrades.com (Verifiable Ledger)
              </span>
            </div>
          </div>
        </div>

        {/* Chapters list navigation */}
        <div className="bg-sand/20 dark:bg-white/5 border border-clay/10 dark:border-sand/10 rounded-2xl p-4 space-y-2">
          <h4 className="text-[10px] font-mono font-bold tracking-widest text-clay/50 dark:text-sand/50 uppercase px-2 mb-2">Chapters Directory</h4>
          {chapters.map((chap) => {
            const prog = getChapterProgress(chap);
            const isSelected = activeChapter === chap.num;
            return (
              <button
                key={chap.id}
                id={`chap-nav-${chap.num}-btn`}
                type="button"
                onClick={() => setActiveChapter(chap.num)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 text-xs font-medium cursor-pointer ${
                  isSelected 
                    ? 'bg-terracotta/10 border border-terracotta/25 text-terracotta font-bold' 
                    : 'hover:bg-clay/5 dark:hover:bg-sand/5 text-clay/80 dark:text-sand/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[9px] font-mono font-bold text-clay/40 dark:text-sand/40 block min-w-[20px]">
                    0{chap.num}
                  </span>
                  <div className="truncate">
                    <span className="block truncate text-clay dark:text-sand text-[12px]">{chap.title}</span>
                    <span className="block text-[10px] text-clay/50 dark:text-sand/50 truncate font-sans font-light">{chap.subtitle}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {prog === 100 && (
                    <span className="text-[9px] bg-olive/10 text-olive dark:bg-olive/20 dark:text-sand font-mono px-1 rounded">
                      Done
                    </span>
                  )}
                  <ChevronRight size={13} className={isSelected ? 'text-terracotta' : 'text-clay/30 dark:text-sand/30'} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Fun static sale pitch banner */}
        <div className="bg-gradient-to-br from-olive/10 to-transparent border border-olive/15 rounded-2xl p-4 text-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-olive font-mono text-[10px] font-bold uppercase tracking-widest dark:text-sand">
            <Award size={12} className="text-terracotta" />
            <span>Reseller License Status</span>
          </div>
          <p className="text-[11px] text-clay/70 dark:text-sand/65 leading-relaxed font-sans">
            You hold an <strong className="text-terracotta">Uncapped Merchant Key</strong>. You are permitted to compile these PDF assets to host as direct downloads, package them as premium educational courses, or sell compiled printed folios on CamelTrades.com.
          </p>
          <div className="flex items-center justify-between text-[11px] p-2 bg-clay/5 dark:bg-white/5 rounded-lg border border-clay/10 dark:border-sand/15 font-mono">
            <span>Simulated Retail Value:</span>
            <span className="font-bold text-terracotta">${sellingPrice}.00 USD</span>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: INTERACTIVE ACTIVE CHAPTER VIEW (8 Cols) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Book Frame */}
        <div className="border border-clay/10 dark:border-sand/10 bg-sand/30 dark:bg-white/5 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
          
          {/* Subtle page fold visual design */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-clay/5 to-transparent border-b border-l border-clay/10 pointer-events-none select-none dark:from-white/5 dark:border-sand/10 rounded-bl-2xl" />
          
          {/* Header metadata */}
          <div className="flex justify-between items-center border-b border-clay/15 dark:border-sand/15 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-extrabold uppercase bg-terracotta text-white px-2 py-0.5 rounded tracking-widest">
                Chapter 0{activeChapData.num}
              </span>
              <span className="text-clay/50 dark:text-sand/40 text-xs font-mono">
                {activeChapData.id.toUpperCase()}_STAGE
              </span>
            </div>
            <span className="text-[10px] font-mono text-clay/45 dark:text-sand/40 uppercase tracking-widest hidden sm:inline">
              The Caravan Capitalist Blueprint
            </span>
          </div>

          {/* Chapter Title Block */}
          <div className="space-y-2 text-left">
            <h2 className="serif text-3xl font-extrabold tracking-wide text-clay dark:text-sand">
              {activeChapData.title}
            </h2>
            <p className="font-serif text-lg italic text-terracotta/90">
              "{activeChapData.subtitle}"
            </p>
          </div>

          {/* Historical Lore Paragraph (editorial italic style) */}
          <div className="p-5 rounded-2xl bg-sand/60 dark:bg-clay/40 border border-clay/5 dark:border-sand/5 font-serif text-md text-clay/80 dark:text-sand/80 leading-relaxed italic border-l-4 border-l-terracotta space-y-2">
            <span className="text-[9px] block font-mono font-bold tracking-widest text-terracotta/70 uppercase">
              🏛️ Ancient Caravan Precedent
            </span>
            <p className="leading-relaxed">
              &ldquo;{activeChapData.camelLore}&rdquo;
            </p>
          </div>

          {/* Detailed structured content subsections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Mindset block */}
            <div className="space-y-3 p-4 bg-clay/5 dark:bg-white/5 rounded-2xl border border-clay/10 dark:border-sand/15">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-terracotta">
                <Key size={13} />
                <span>The Mindset Code</span>
              </div>
              <h5 className="font-semibold text-clay dark:text-sand text-xs font-sans uppercase tracking-wider">
                {activeChapData.mindset.title}
              </h5>
              <p className="text-[11px] text-clay/85 dark:text-sand/85 leading-relaxed">
                <strong className="text-clay dark:text-sand">The Philosophy:</strong> {activeChapData.mindset.philosophy}
              </p>
              <div className="p-3 bg-terracotta/5 border border-dashed border-terracotta/20 rounded-xl text-[11px] text-clay/85 dark:text-sand/80 italic leading-relaxed">
                <strong className="not-italic text-terracotta font-mono text-[9px] block uppercase tracking-widest mb-1">Mindset Shift:</strong>
                {activeChapData.mindset.shift}
              </div>
            </div>

            {/* Opportunities (where to look) */}
            <div className="space-y-4 p-4 bg-clay/5 dark:bg-white/5 rounded-2xl border border-clay/10 dark:border-sand/15">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-olive dark:text-sand">
                <Compass size={13} className="text-terracotta" />
                <span>Where to Probe for Wealth</span>
              </div>
              <p className="text-[11px] text-clay/80 dark:text-sand/85 leading-relaxed">
                <strong className="text-clay dark:text-sand">Oasis Map:</strong> {activeChapData.ideas.whereToLook}
              </p>
              
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-clay/50 dark:text-sand/40 block">
                  📍 Hot Sand Opportunities:
                </span>
                <ul className="space-y-2 text-[11px] text-clay/75 dark:text-sand/75">
                  {activeChapData.ideas.opportunities.map((opp, idx) => (
                    <li key={idx} className="flex gap-1.5 items-start">
                      <span className="text-terracotta shrink-0 font-bold">•</span>
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Execution steps row (full width) */}
          <div className="p-5 bg-olive/5 dark:bg-white/5 border border-olive/15 dark:border-sand/10 rounded-2xl space-y-3 text-left">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-olive dark:text-sand flex items-center gap-1.5">
              <Zap size={13} className="text-terracotta" />
              <span>Step-by-Step Tactical Implementation</span>
            </span>
            <ol className="space-y-3 text-xs text-clay/85 dark:text-sand/85 font-sans">
              {activeChapData.execution.steps.map((st, idx) => (
                <li key={idx} className="flex gap-3 items-start p-1 bg-sand/35 dark:bg-clay/20 rounded-lg">
                  <span className="w-5 h-5 rounded-full bg-terracotta text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{st}</span>
                </li>
              ))}
            </ol>
            <div className="pt-2 border-t border-clay/10 dark:border-sand/10 mt-3 text-[11px] leading-relaxed text-clay/70 dark:text-sand/65 italic flex items-start gap-2">
              <span className="font-mono text-terracotta uppercase not-italic font-bold shrink-0 text-[10px] bg-terracotta/10 px-1.5 rounded">
                Risk Buffer:
              </span>
              <span>{activeChapData.execution.riskMitigation}</span>
            </div>
          </div>

          {/* OPM Simulator (Active specifically when on OPM chapter or just as an amazing interactive tool for all) */}
          {activeChapData.id === 'opm' && (
            <div className="p-5 bg-terracotta/5 border border-terracotta/20 rounded-2xl space-y-4 animate-fade-in text-left">
              <div className="flex items-center gap-1.5">
                <Coins size={15} className="text-terracotta" />
                <h4 className="font-mono font-bold text-[11px] uppercase tracking-wider text-clay dark:text-sand">
                  Interactive Mudarabah Trade Profit Split Simulacrum
                </h4>
              </div>
              <p className="text-[11px] text-clay/70 dark:text-sand/65">
                Calculate the split of camels generated through investor funding (OPM) versus your sweat equity navigating the Sahara. Change sliders below to model terms.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-3">
                  <div>
                    <label className="flex justify-between text-[11px] text-clay/60 dark:text-sand/50 mb-1">
                      <span>Borrowed Capital (Camels Invested):</span>
                      <strong className="text-terracotta">{opmCamels} Camels</strong>
                    </label>
                    <input 
                      type="range"
                      min="10"
                      max="150"
                      step="5"
                      value={opmCamels}
                      onChange={(e) => setOpmCamels(Number(e.target.value))}
                      className="w-full h-1.5 bg-clay/20 dark:bg-sand/20 rounded-lg appearance-none cursor-pointer accent-terracotta"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-[11px] text-clay/60 dark:text-sand/50 mb-1">
                      <span>Preferential Investor Yield Split:</span>
                      <strong className="text-terracotta">{investorSplit}% / {100 - investorSplit}%</strong>
                    </label>
                    <input 
                      type="range"
                      min="40"
                      max="90"
                      step="5"
                      value={investorSplit}
                      onChange={(e) => setInvestorSplit(Number(e.target.value))}
                      className="w-full h-1.5 bg-clay/20 dark:bg-sand/20 rounded-lg appearance-none cursor-pointer accent-terracotta"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="flex justify-between text-[11px] text-clay/60 dark:text-sand/50 mb-1">
                      <span>Estimated Caravan Voyage Yield:</span>
                      <strong className="text-terracotta">{projectYield}% annually</strong>
                    </label>
                    <input 
                      type="range"
                      min="10"
                      max="60"
                      step="5"
                      value={projectYield}
                      onChange={(e) => setProjectYield(Number(e.target.value))}
                      className="w-full h-1.5 bg-clay/20 dark:bg-sand/20 rounded-lg appearance-none cursor-pointer accent-terracotta"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-[11px] text-clay/60 dark:text-sand/50 mb-1">
                      <span>Active Caravan Operational Lifespan:</span>
                      <strong className="text-terracotta">{activeYears} Years</strong>
                    </label>
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={activeYears}
                      onChange={(e) => setActiveYears(Number(e.target.value))}
                      className="w-full h-1.5 bg-clay/20 dark:bg-sand/20 rounded-lg appearance-none cursor-pointer accent-terracotta"
                    />
                  </div>
                </div>
              </div>

              {/* Split results box */}
              <div className="p-3.5 bg-clay/5 dark:bg-white/5 border border-clay/10 dark:border-sand/15 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-clay/50 dark:text-sand/40 block uppercase">Yearly Harvest</span>
                  <strong className="text-[13px] text-clay dark:text-sand">+{opmResults.yearlyGainCount} Camels</strong>
                </div>
                <div className="space-y-1 border-l border-clay/10 dark:border-sand/15 pl-2">
                  <span className="text-[9px] font-mono text-clay/50 dark:text-sand/40 block uppercase">Total Growth Gains</span>
                  <strong className="text-[13px] text-clay dark:text-sand">+{opmResults.totalRawGains} Camels</strong>
                </div>
                <div className="space-y-1 border-l border-clay/10 dark:border-sand/15 pl-2">
                  <span className="text-[9px] font-mono text-clay/50 dark:text-sand/40 block uppercase">Investor Share (Capital)</span>
                  <strong className="text-[13px] text-clay dark:text-sand text-terracotta">+{opmResults.investorShare}</strong>
                </div>
                <div className="space-y-1 border-l border-clay/10 dark:border-sand/15 pl-2">
                  <span className="text-[9px] font-mono text-clay/50 dark:text-sand/40 block uppercase">Your Profit (0$ Down!)</span>
                  <strong className="text-[13px] text-olive dark:text-sand font-bold">+{opmResults.nomadShare} Camels</strong>
                </div>
              </div>
              <p className="text-[9px] italic text-clay/40 dark:text-sand/40 font-mono text-center">
                ⚖️ Investor splits cover the heavy cash risks, but your expertise drives the return coefficient on raw leverage.
              </p>
            </div>
          )}

          {/* Interactive Lesson Verification Checklist */}
          <div className="p-5 border border-dashed border-clay/20 dark:border-sand/20 rounded-2xl bg-sand/20 dark:bg-warm-black/20 text-left space-y-3">
            <div className="flex items-center gap-1.5">
              <CheckSquare size={14} className="text-terracotta" />
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-clay dark:text-sand">
                Active Chapter Milestone Affirmations
              </h4>
            </div>
            <p className="text-[11px] text-clay/70 dark:text-sand/65">
              Reflect on this chapter. Have you internalized these Caravan principles? Check off the milestones you agree to act upon:
            </p>

            <div className="space-y-2 mt-4">
              {activeChapData.interactiveChecklist.map((item, idx) => {
                const itemKey = `${activeChapData.id}_${item}`;
                const isChecked = !!completedItems[itemKey];
                return (
                  <label 
                    key={idx}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer text-[12px] ${
                      isChecked 
                        ? 'bg-olive/10 border-olive/20 text-clay dark:text-sand' 
                        : 'bg-clay/5 border-transparent hover:bg-clay/10 text-clay/70 dark:text-sand/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCheckboxChange(item)}
                      className="mt-0.5 rounded text-terracotta focus:ring-terracotta cursor-pointer accent-terracotta shrink-0 border-clay/30"
                    />
                    <span className="leading-snug">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation flow helper at bottom of active page */}
          <div className="flex justify-between items-center pt-4 border-t border-clay/15 dark:border-sand/15">
            <button
              id="prev-chapter-btn"
              type="button"
              disabled={activeChapter === 1}
              onClick={() => setActiveChapter(activeChapter - 1)}
              className="px-4 py-2 rounded-lg border border-clay/20 dark:border-sand/20 hover:bg-clay/5 dark:hover:bg-sand/5 disabled:opacity-30 transition-all font-mono text-[11px] cursor-pointer text-clay dark:text-sand"
            >
              ← Previous Chapter
            </button>
            <span className="text-xs font-mono text-clay/50 dark:text-sand/50">
              Page {activeChapter} of {chapters.length}
            </span>
            <button
              id="next-chapter-btn"
              type="button"
              disabled={activeChapter === chapters.length}
              onClick={() => setActiveChapter(activeChapter + 1)}
              className="px-4 py-2 rounded-lg border border-clay/20 dark:border-sand/20 hover:bg-clay/5 dark:hover:bg-sand/5 disabled:opacity-30 transition-all font-mono text-[11px] cursor-pointer text-clay dark:text-sand"
            >
              Next Chapter →
            </button>
          </div>

        </div>

      </div>

    </section>
  );
}
