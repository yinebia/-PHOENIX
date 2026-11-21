import { extractMathExpression, isValidMathExpression } from '../tools/mathExtractor';
import { detectLocalContext, extractSuppliedRequirements } from '../tools/requirementExtractor';
import { toolRegistry } from '../tools/registry';
import { buildNorthernStylePrototype } from './northernStyle';

function escapeHtmlText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface DeterministicDeliverableResult {
  format: 'html' | 'json' | 'markdown';
  content: string;
  executionBadge: string;
  reasoning: string;
  logs: string[];
  domainCategory:
    | 'business_research'
    | 'website'
    | 'business_planning'
    | 'design'
    | 'research'
    | 'json_manifest';
  toolOutput?: any;
}

export async function buildPricingAssumptionsModel({
  goal,
  task,
  clarificationAnswers,
  demoMode = false,
}: {
  goal: string;
  task?: any;
  clarificationAnswers?: Record<string, string>;
  demoMode?: boolean;
}): Promise<DeterministicDeliverableResult> {
  const localCtx = detectLocalContext(goal, clarificationAnswers);
  const sym = localCtx.currencySymbol;
  const code = localCtx.currencyCode;
  const lowerGoal = (goal || '').toLowerCase();

  const isCoffeeFood =
    demoMode || /coffee|cafe|pastry|bakery|espresso|food|restaurant|catering/i.test(lowerGoal);
  const isClothingCraft = /fashion|tailor|clothing|smock|fugu|textile|apparel|dress/i.test(lowerGoal);

  // Sensible domain-aware baseline assumptions (USD)
  const unitCost = isCoffeeFood ? 5.0 : isClothingCraft ? 22.0 : 25.0;
  const desiredMarginPct = isCoffeeFood ? 65 : isClothingCraft ? 60 : 70;
  const monthlyVolume = isCoffeeFood ? 140 : isClothingCraft ? 45 : 35;
  const numberOfTiers = 3;

  // Deterministic math: price = cost / (1 - margin)
  const marginDivisorExpr = `1 - (${desiredMarginPct} / 100)`;
  const divRes = await toolRegistry.execute('calculator', { expression: marginDivisorExpr }, 0);
  const marginDivisor = divRes.status === 'SUCCESS' ? Number(divRes.output.result) : 1 - desiredMarginPct / 100;

  const corePriceExpr = `${unitCost} / ${marginDivisor.toFixed(4)}`;
  const corePriceRes = await toolRegistry.execute('calculator', { expression: corePriceExpr }, 0);
  const rawCorePrice = corePriceRes.status === 'SUCCESS' ? Number(corePriceRes.output.result) : unitCost / marginDivisor;
  const coreTierPrice = Math.max(unitCost + 2, Math.round(rawCorePrice));

  const starterTierPrice = Math.max(unitCost + 1, Math.round(coreTierPrice * 0.72));
  const premiumTierPrice = Math.round(coreTierPrice * 1.85);

  const blendedPrice = Math.round(starterTierPrice * 0.35 + coreTierPrice * 0.45 + premiumTierPrice * 0.2);
  const revExpr = `${monthlyVolume} * ${blendedPrice}`;
  const revRes = await toolRegistry.execute('calculator', { expression: revExpr }, 0);
  const estimatedMonthlyRevenue =
    revRes.status === 'SUCCESS' ? Number(revRes.output.result) : monthlyVolume * blendedPrice;

  const costExpr = `${monthlyVolume} * ${unitCost}`;
  const costRes = await toolRegistry.execute('calculator', { expression: costExpr }, 0);
  const estimatedMonthlyCost =
    costRes.status === 'SUCCESS' ? Number(costRes.output.result) : monthlyVolume * unitCost;

  const grossProfitExpr = `${estimatedMonthlyRevenue} - ${estimatedMonthlyCost}`;
  const gpRes = await toolRegistry.execute('calculator', { expression: grossProfitExpr }, 0);
  const estimatedMonthlyGrossProfit =
    gpRes.status === 'SUCCESS' ? Number(gpRes.output.result) : estimatedMonthlyRevenue - estimatedMonthlyCost;

  const countryLabel = localCtx.country ? ` in ${localCtx.country}` : '';
  const content = `# ${task?.title || 'Pricing Tiers & Monthly Revenue Model'} (Estimated projection)

> **Estimated projection:** No exact numbers were provided in the request, so PHOENIX built an explicit assumptions table in ${code} (${sym}) and calculated tier pricing and monthly revenue deterministically.

## Objective
${goal}${countryLabel ? `\n- **Market Context:** ${localCtx.country} (Prices presented in ${code} ${sym})` : ''}

## 1. Pricing Assumptions Table (Estimated projection)
| Assumption | Value (${code}) | Notes |
| :--- | :--- | :--- |
| **Cost per unit** | **${sym}${unitCost.toFixed(2)}** | Direct materials, packaging, and fulfillment per unit |
| **Desired gross margin** | **${desiredMarginPct}%** | Target margin to absorb overhead and reinvestment |
| **Estimated monthly sales volume** | **${monthlyVolume} units / month** | Blended starter baseline across active offers |
| **Number of pricing tiers** | **${numberOfTiers} tiers** | Starter, Core, and Premium / Bundle tiers |

## 2. Calculated Pricing Tiers & Monthly Revenue (Estimated projection)
| Tier | Price (${code}) | Est. Monthly Mix | Projected Revenue (${code}) |
| :--- | :--- | :--- | :--- |
| **Tier 1: Starter Offer** | **${sym}${starterTierPrice.toFixed(2)}** | ${Math.round(monthlyVolume * 0.35)} units | **${sym}${(Math.round(monthlyVolume * 0.35) * starterTierPrice).toFixed(2)}** |
| **Tier 2: Core Package** | **${sym}${coreTierPrice.toFixed(2)}** | ${Math.round(monthlyVolume * 0.45)} units | **${sym}${(Math.round(monthlyVolume * 0.45) * coreTierPrice).toFixed(2)}** |
| **Tier 3: Premium / Bundle** | **${sym}${premiumTierPrice.toFixed(2)}** | ${Math.max(1, monthlyVolume - Math.round(monthlyVolume * 0.35) - Math.round(monthlyVolume * 0.45))} units | **${sym}${(Math.max(1, monthlyVolume - Math.round(monthlyVolume * 0.35) - Math.round(monthlyVolume * 0.45)) * premiumTierPrice).toFixed(2)}** |

## 3. Monthly Summary (Estimated projection)
- **Blended Average Price:** ${sym}${blendedPrice.toFixed(2)} per unit
- **Estimated Monthly Revenue:** **${sym}${estimatedMonthlyRevenue.toFixed(2)}** (\`${revExpr}\`)
- **Estimated Monthly Direct Cost:** **${sym}${estimatedMonthlyCost.toFixed(2)}** (\`${costExpr}\`)
- **Estimated Monthly Gross Profit:** **${sym}${estimatedMonthlyGrossProfit.toFixed(2)}** (\`${grossProfitExpr}\`)

## 4. Items to Confirm Before Launch
- [ ] Replace estimated cost per unit (${sym}${unitCost.toFixed(2)}) with actual supplier quotes.
- [ ] Validate customer willingness to pay around ${sym}${coreTierPrice.toFixed(2)} for your Core offer.
`;

  return {
    format: 'markdown',
    content,
    executionBadge: '[ESTIMATED PROJECTION · PRICING READY]',
    reasoning: 'I used sensible estimates for the pricing step so we can keep moving.',
    logs: [
      `[PRICING_MODEL] Built Estimated projection assumptions table (cost=${sym}${unitCost}, margin=${desiredMarginPct}%, volume=${monthlyVolume}, tiers=${numberOfTiers}).`,
      `[CALCULATOR] Computed deterministic ${code} pricing tiers (${sym}${starterTierPrice}/${sym}${coreTierPrice}/${sym}${premiumTierPrice}) & monthly revenue (${sym}${estimatedMonthlyRevenue}).`,
    ],
    domainCategory: 'business_planning',
    toolOutput: {
      tool: 'pricing_estimator',
      label: 'Estimated projection',
      currency: code,
      country: localCtx.country || null,
      assumptions: {
        costPerUnit: unitCost,
        desiredMarginPercent: desiredMarginPct,
        estimatedMonthlySalesVolume: monthlyVolume,
        numberOfTiers,
      },
      calculated: {
        starterTierPrice,
        coreTierPrice,
        premiumTierPrice,
        blendedAveragePrice: blendedPrice,
        estimatedMonthlyRevenue,
        estimatedMonthlyCost,
        estimatedMonthlyGrossProfit,
      },
      friendlyCustomerNote: 'I used sensible estimates for the pricing step so we can keep moving.',
    },
  };
}

export function buildIllustrativeDemoPlan(customGoal?: string) {
  const goalText =
    customGoal && customGoal.trim().length > 0
      ? customGoal.trim()
      : 'Launch a specialty coffee and artisan pastry pop-up studio with market positioning, pricing projections, and a responsive starter website.';

  return {
    missionName: 'PHOENIX Demo: Artisan Coffee Studio Launch (Illustrative example)',
    objectiveSummary:
      'End-to-end demonstration delivering market research, calculator-verified financial projections, and a responsive interactive website prototype in under 60 seconds (Illustrative example).',
    riskLevel: 'LOW',
    estimatedTotalTimeSec: 6,
    understanding: {
      isDemoExample: true,
      exampleLabel: 'Illustrative example',
      intendedOutcome:
        'Deliver an illustrative example package containing competitor research, calculator-computed financial projections, and an audited responsive HTML/CSS/JS website prototype.',
      suppliedInformation: [
        `Demo Scenario: ${goalText}`,
        'Execution Mode: Illustrative example (local synthesis + real backend math & validation tools)',
      ],
      resourceConstraints: [
        'Completes end-to-end in under 60 seconds without external dependencies',
        'All market benchmarks and financial projections are clearly labeled Illustrative example',
      ],
      missingInformation: [
        'Verify local commercial lease rates, supplier wholesale quotes, and municipal food permits before live launch',
      ],
      contradictionsDetected: [],
      needsClarification: false,
      clarifyingQuestions: [],
      strategySummary:
        'Run illustrative competitor research and deterministic financial calculations in parallel, synthesize an interactive HTML5 website prototype, validate security/structure with artifact_validator, and issue final verification report.',
      opportunities: [
        'Instant previewable prototype and calculator-verified break-even model',
        'Zero external blockers — demonstrates full multi-stage DAG in seconds',
      ],
      risks: [
        'Illustrative example benchmarks require local supplier and foot-traffic confirmation prior to capital commitment',
      ],
    },
    tasks: [
      {
        id: 'step-1',
        title: 'Market & Competitor Landscape (Illustrative example)',
        phase: 'Discovery',
        stage: 'UNDERSTAND',
        tool: 'web_search',
        simulated: false,
        toolType: 'REAL',
        description:
          'Compile illustrative competitor profiles, pricing benchmarks, opportunities, risks, and confirmation checklist.',
        expectedArtifact: 'market_research_illustrative.md',
        estimatedDurationSec: 1,
        requiresApproval: false,
        dependencies: [],
      },
      {
        id: 'step-2',
        title: 'Business Strategy & Financial Projections (Illustrative example)',
        phase: 'Strategy',
        stage: 'STRATEGISE',
        tool: 'llm_reasoning',
        simulated: false,
        toolType: 'LLM_REASONING',
        description:
          'Generate launch strategy and compute startup break-even, unit margin, and 3-month projections deterministically.',
        expectedArtifact: 'business_plan_financials.md',
        estimatedDurationSec: 1,
        requiresApproval: false,
        dependencies: [],
      },
      {
        id: 'step-3',
        title: 'Build Interactive Website Prototype (Illustrative example)',
        phase: 'Execution',
        stage: 'EXECUTE',
        tool: 'llm_reasoning',
        simulated: false,
        toolType: 'LLM_REASONING',
        description:
          'Create a responsive HTML/CSS/JS prototype with interactive menu filters, package selector, and XSS-safe inquiry preview.',
        expectedArtifact: 'coffee_studio_prototype.html',
        estimatedDurationSec: 2,
        requiresApproval: false,
        dependencies: ['step-1', 'step-2'],
      },
      {
        id: 'step-4',
        title: 'Validate Prototype Security & HTML Structure',
        phase: 'Validation',
        stage: 'VERIFY_RECOVER',
        tool: 'artifact_validator',
        simulated: false,
        toolType: 'REAL',
        description:
          'Run deterministic structural, JavaScript syntax, and XSS safety inspection across the website prototype.',
        expectedArtifact: 'prototype_validation_audit.json',
        estimatedDurationSec: 1,
        requiresApproval: false,
        dependencies: ['step-3'],
      },
      {
        id: 'step-5',
        title: 'Final Verification & Delivery Summary',
        phase: 'Delivery',
        stage: 'DELIVER',
        tool: 'verification_harness',
        simulated: false,
        toolType: 'REAL',
        description: 'Verify all generated deliverables and compile final summary.',
        expectedArtifact: 'demo_verification_report.json',
        estimatedDurationSec: 1,
        requiresApproval: false,
        dependencies: ['step-4'],
      },
    ],
  };
}

export function buildEnhancedWebsitePrototype({
  goal,
  clarificationAnswers,
  demoMode = false,
}: {
  goal: string;
  clarificationAnswers?: Record<string, string>;
  demoMode?: boolean;
}): string {
  const isNorthernStyleGoal = /northern\s+style/i.test(goal);
  if (isNorthernStyleGoal && !demoMode) {
    return buildNorthernStylePrototype(clarificationAnswers);
  }

  const extracted = extractSuppliedRequirements(goal, clarificationAnswers);
  const answerMap = clarificationAnswers || {};
  const answerValues = Object.entries(answerMap)
    .map(([q, a]) => ({ q: q.trim(), a: String(a || '').trim() }))
    .filter((entry) => entry.a.length > 0);

  const isCoffeeDemo = demoMode || /coffee|cafe|pastry|espresso|roast|bakery/i.test(goal);
  const brandName = isCoffeeDemo
    ? 'Solstice Roast & Pastry'
    : extracted.businessName || 'Venture Studio Preview';
  const safeBrand = escapeHtmlText(brandName);
  const safeGoal = escapeHtmlText(goal);
  const badgeText = demoMode
    ? 'ILLUSTRATIVE EXAMPLE · INTERACTIVE PROTOTYPE'
    : 'WORKING WEBSITE PROTOTYPE PREVIEW';

  const offerings = isCoffeeDemo
    ? [
        {
          category: 'signature',
          tag: 'Best Seller',
          name: 'Single-Origin Pour Over & Croissant Flight',
          desc: 'Seasonal washed-process roast paired with laminated butter pastry.',
          price: '$14 (Illustrative)',
        },
        {
          category: 'signature',
          tag: 'Morning Box',
          name: 'Studio Team Box (12 Servings)',
          desc: 'Insulated batch-brew carafe, cups, oat & dairy milk, and 12 assorted pastries.',
          price: '$78 (Illustrative)',
        },
        {
          category: 'subscription',
          tag: 'Weekly',
          name: 'Neighborhood Espresso Pass',
          desc: 'Five handcrafted espresso drinks per week plus priority morning pick-up.',
          price: '$29 / wk (Illustrative)',
        },
      ]
    : [
        {
          category: 'signature',
          tag: 'Starter',
          name: 'Starter Offering',
          desc: 'Core entry package designed around fast onboarding and clear deliverables.',
          price: '[YOUR STARTER PRICE]',
        },
        {
          category: 'signature',
          tag: 'Most Popular',
          name: 'Growth Package',
          desc: 'Full-featured service tier with priority turnaround and direct support.',
          price: '[YOUR STANDARD PRICE]',
        },
        {
          category: 'subscription',
          tag: 'Ongoing',
          name: 'Monthly Retainer Plan',
          desc: 'Continuous monthly support, optimization, and scheduled check-ins.',
          price: '[YOUR MONTHLY PRICE]',
        },
      ];

  const safeNotes =
    answerValues.length > 0
      ? answerValues
          .map((item) => `<li><strong>${escapeHtmlText(item.q)}:</strong> ${escapeHtmlText(item.a)}</li>`)
          .join('\n          ')
      : extracted.suppliedInformation.length > 0
      ? extracted.suppliedInformation
          .map((item) => `<li>${escapeHtmlText(item)}</li>`)
          .join('\n          ')
      : '<li>Built as an interactive, responsive single-file prototype ready for browser preview and customization.</li>';

  const cardsHtml = offerings
    .map(
      (item) => `        <article class="card offering-card" data-category="${escapeHtmlText(item.category)}">
          <span class="pill">${escapeHtmlText(item.tag)}</span>
          <h3>${escapeHtmlText(item.name)}</h3>
          <p>${escapeHtmlText(item.desc)}</p>
          <p class="price"><strong>Price:</strong> ${escapeHtmlText(item.price)}</p>
        </article>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeBrand} — Interactive Prototype</title>
  <style>
    :root {
      --bg: #08090e;
      --surface: #111524;
      --border: #242b42;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #f59e0b;
      --accent-soft: rgba(245, 158, 11, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(8, 9, 14, 0.94);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
    }
    .nav-wrap {
      max-width: 1080px;
      margin: 0 auto;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      font-weight: 800;
      letter-spacing: 0.03em;
      color: var(--accent);
      text-decoration: none;
      font-size: 1.05rem;
    }
    .nav-links {
      display: flex;
      gap: 20px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .nav-links a {
      color: var(--text);
      text-decoration: none;
      font-size: 0.92rem;
    }
    .nav-links a:hover { color: var(--accent); }
    .menu-toggle {
      display: none;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
    }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 20px 64px;
    }
    section {
      padding: 36px 0;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      border-radius: 6px;
      border: 1px solid rgba(245, 158, 11, 0.45);
      background: var(--accent-soft);
      color: #fde68a;
      margin-bottom: 12px;
    }
    h1 { font-size: clamp(1.9rem, 4vw, 2.9rem); margin: 6px 0 12px; line-height: 1.15; }
    h2 { font-size: 1.45rem; margin: 0 0 12px; color: #f1f5f9; }
    h3 { font-size: 1.05rem; margin: 8px 0; }
    p { color: var(--muted); max-width: 68ch; }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0 6px;
    }
    .filter-btn {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .filter-btn.active {
      background: var(--accent);
      color: #090a0f;
      border-color: var(--accent);
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    .pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 600;
      color: #fcd34d;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .price { color: #e2e8f0; margin-bottom: 0; }
    .btn {
      display: inline-block;
      background: var(--accent);
      color: #090a0f;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 8px;
      border: 0;
      text-decoration: none;
      cursor: pointer;
    }
    .prototype-notice {
      background: var(--accent-soft);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fde68a;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 16px;
    }
    form {
      display: grid;
      gap: 12px;
      max-width: 520px;
    }
    label { font-size: 0.85rem; color: #cbd5e1; display: grid; gap: 6px; }
    input, textarea, select {
      background: #0f172a;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      font: inherit;
    }
    #previewOutput {
      margin-top: 16px;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      display: none;
    }
    footer {
      max-width: 1080px;
      margin: 0 auto;
      padding: 24px 20px 40px;
      color: var(--muted);
      font-size: 0.85rem;
    }
    @media (max-width: 768px) {
      .menu-toggle { display: inline-block; }
      .nav-links {
        display: none;
        flex-direction: column;
        position: absolute;
        left: 0;
        right: 0;
        top: 56px;
        background: var(--surface);
        padding: 14px 20px;
        border-bottom: 1px solid var(--border);
      }
      .nav-links.open { display: flex; }
    }
  </style>
</head>
<body>
  <header>
    <nav class="nav-wrap" aria-label="Primary">
      <a class="brand" href="#home">${safeBrand}</a>
      <button type="button" class="menu-toggle" id="menuToggle" aria-expanded="false">Menu</button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#offerings">Offerings</a></li>
        <li><a href="#about">Context</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section id="home">
      <span class="badge">${badgeText}</span>
      <h1>${safeBrand}</h1>
      <p>${isCoffeeDemo ? 'Craft specialty coffee, small-batch pastries, and team morning catering built for local pickup and neighborhood events.' : `Interactive responsive website prototype built for: "${safeGoal}".`}</p>
      <a class="btn" href="#contact">Try Interactive Inquiry Form</a>
    </section>

    <section id="offerings">
      <h2>Featured Offerings &amp; Filter</h2>
      <div class="filter-bar" role="group" aria-label="Filter offerings">
        <button type="button" class="filter-btn active" data-filter="all">All Offerings</button>
        <button type="button" class="filter-btn" data-filter="signature">Signature / Core</button>
        <button type="button" class="filter-btn" data-filter="subscription">Recurring / Plans</button>
      </div>
      <div class="grid">
${cardsHtml}
      </div>
    </section>

    <section id="about">
      <h2>Project Context &amp; Setup Notes</h2>
      <ul>
        ${safeNotes}
      </ul>
    </section>

    <section id="contact">
      <h2>Customer Inquiry Preview</h2>
      <div class="prototype-notice">
        ${demoMode ? 'Illustrative example: ' : ''}This interactive form previews customer messages locally inside the browser without transmitting personal data externally.
      </div>
      <form id="inquiryForm">
        <label>
          Your Name
          <input type="text" id="customerName" required placeholder="Enter your name" />
        </label>
        <label>
          Package Interest
          <select id="packageSelect">
            <option value="Starter / Core">Starter / Core</option>
            <option value="Team / Growth">Team / Growth</option>
            <option value="Recurring Plan">Recurring Plan</option>
          </select>
        </label>
        <label>
          Inquiry Details
          <textarea id="customerMessage" rows="3" required placeholder="Tell us what you are looking for"></textarea>
        </label>
        <button type="submit" class="btn">Preview Submission</button>
      </form>
      <div id="previewOutput" aria-live="polite"></div>
    </section>
  </main>

  <footer>
    &copy; ${safeBrand} &mdash; ${demoMode ? 'Illustrative example prototype.' : 'Interactive local website prototype.'}
  </footer>

  <script>
    (function () {
      var menuBtn = document.getElementById('menuToggle');
      var navLinks = document.getElementById('navLinks');
      if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', function () {
          var isOpen = navLinks.classList.toggle('open');
          menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
      }

      var filterBtns = document.querySelectorAll('.filter-btn');
      var cards = document.querySelectorAll('.offering-card');
      filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var filter = btn.getAttribute('data-filter') || 'all';
          filterBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          cards.forEach(function (card) {
            var cat = card.getAttribute('data-category');
            card.style.display = (filter === 'all' || cat === filter) ? '' : 'none';
          });
        });
      });

      var form = document.getElementById('inquiryForm');
      var output = document.getElementById('previewOutput');
      if (form && output) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var nameInput = document.getElementById('customerName');
          var pkgSelect = document.getElementById('packageSelect');
          var msgInput = document.getElementById('customerMessage');
          var nameVal = nameInput && nameInput.value ? nameInput.value.trim() : '';
          var pkgVal = pkgSelect && pkgSelect.value ? pkgSelect.value : 'Starter';
          var msgVal = msgInput && msgInput.value ? msgInput.value.trim() : '';
          if (!nameVal || !msgVal) {
            return;
          }
          while (output.firstChild) {
            output.removeChild(output.firstChild);
          }
          var heading = document.createElement('strong');
          heading.textContent = 'Local Interactive Inquiry Preview (Not Sent Externally):';
          var pName = document.createElement('p');
          pName.textContent = 'From: ' + nameVal + ' (' + pkgVal + ')';
          var pMsg = document.createElement('p');
          pMsg.textContent = 'Notes: ' + msgVal;
          output.appendChild(heading);
          output.appendChild(pName);
          output.appendChild(pMsg);
          output.style.display = 'block';
        });
      }
    })();
  </script>
</body>
</html>`;
}

export function synthesizeBusinessResearchFallback({
  goal,
  task,
  demoMode = false,
}: {
  goal: string;
  task: any;
  demoMode?: boolean;
}): DeterministicDeliverableResult {
  const localCtx = detectLocalContext(goal);
  const sym = localCtx.currencySymbol;
  const code = localCtx.currencyCode;
  const isCoffee = demoMode || /coffee|cafe|pastry|bakery|espresso/i.test(goal);
  const countryLine = localCtx.country
    ? `- **Target Market / Country:** ${localCtx.country} (Illustrative pricing shown in ${code} ${sym})`
    : `- **Pricing Currency:** ${code} (${sym})`;

  const labelHeader = demoMode
    ? '> **Label:** Illustrative example — structured market intelligence baseline ready for local confirmation.'
    : '> **Illustrative example:** Structured market research baseline prepared cleanly; competitor profiles are generic illustrative examples and items requiring local confirmation are flagged below.';

  const competitorsTable = isCoffee
    ? `| Competitor Profile (Illustrative example) | Positioning | Example Pricing Band (${code}) | Core Strength | Opportunity Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Local Competitor A** *(Illustrative example)* | Quick commuter grab-and-go | ${sym}4.00–${sym}6.50 / drink | High morning foot traffic near transit | Limited group office pre-order packages |
| **Boutique Competitor B** *(Illustrative example)* | Artisanal third-wave dine-in | ${sym}5.50–${sym}9.00 drink & pastry | Specialty beans and aesthetic seating | Slow checkout queues during 8–10 AM peak |
| **Regional Outlet C** *(Illustrative example)* | Standardized convenience | ${sym}4.50–${sym}7.25 / item | App ordering & loyalty rewards | Standardized flavors, low personal warmth |`
    : `| Competitor Profile (Illustrative example) | Positioning | Example Pricing Band (${code}) | Core Strength | Opportunity Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Local Competitor A** *(Illustrative example)* | High-touch custom quotes | ${sym}150–${sym}600 / project | Established local presence | Slow multi-day quote turnaround |
| **Digital Template Option B** *(Illustrative example)* | Low-cost self-serve tooling | ${sym}19–${sym}49 / month | Fast self-onboarding | No guided strategy or done-with-you support |
| **Boutique Studio C** *(Illustrative example)* | Specialized niche focus | ${sym}120–${sym}450 / tier | Tailored deliverables | Narrow capacity & waitlist delays |`;

  const pricingTable = isCoffee
    ? `| Tier / Offer (Estimated projection) | Suggested Price (${code}) | Target Customer | Strategic Role |
| :--- | :--- | :--- | :--- |
| **Single-Origin Beverage + Pastry** | ${sym}12–${sym}15 | Daily local commuters | Foot-traffic acquisition & repeat habit |
| **Weekly Espresso Pass (5 drinks)** | ${sym}29 / week | Hybrid remote workers | Predictable recurring cash flow |
| **Studio Team Box (12 servings)** | ${sym}75–${sym}85 | Local studios & offices | High-ticket B2B margin anchor |`
    : `| Pricing Tier (Estimated projection) | Plausible Price Structure (${code}) | Included Value | Margin Purpose |
| :--- | :--- | :--- | :--- |
| **Starter Entry Offer** | ${sym}49–${sym}149 one-time | Fast diagnostic & starter deliverable | Low-friction customer acquisition |
| **Core Launch Package** | ${sym}199–${sym}499 one-time | Complete setup + interactive deliverable | Primary revenue engine |
| **Ongoing Care Plan** | ${sym}79–${sym}149 / month | Monthly updates & reporting | Recurring baseline stability |`;

  const content = `# ${task?.title || 'Business & Market Research Brief'}

${labelHeader}

## Target Objective
- **Goal:** ${goal}
${countryLine}

## Generic Competitor Profiles & Market Comparison (Illustrative example)
${competitorsTable}

## Plausible Pricing Structures (Estimated projection)
${pricingTable}

## Key Opportunities & Risks
- **Opportunities:** Bundle recurring or group packages that bypass slow competitor workflows; capture pre-order convenience via mobile-first landing pages.
- **Risks:** Margin compression if customer acquisition relies solely on single-unit low-ticket sales; pricing sensitivity without clear quality differentiation.

## Items Requiring External Confirmation
- [ ] **Local Competitor Pricing Check:** Confirm current menu/service prices across 3 real providers in ${localCtx.country || 'your target market'}.
- [ ] **Supplier & Cost Quotes:** Obtain verified wholesale or vendor unit costs in ${code} (${sym}).
- [ ] **Customer Validation:** Run 5 quick discovery conversations or a landing-page waitlist test before locking final tiers.
`;

  return {
    format: 'markdown',
    content,
    executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE]' : '[MARKET RESEARCH BRIEF READY]',
    reasoning:
      'Compiled generic illustrative competitor comparisons, estimated USD pricing structures, opportunities, risks, and an explicit external confirmation checklist.',
    logs: [
      '[RESEARCH] Built generic Illustrative example competitor comparison matrix & USD pricing structure table.',
      '[CHECKLIST] Marked items requiring external confirmation prior to launch.',
    ],
    domainCategory: 'business_research',
  };
}

export async function synthesizeBusinessPlanWithRealMath({
  goal,
  task,
  clarificationAnswers,
  demoMode = false,
}: {
  goal: string;
  task: any;
  clarificationAnswers?: Record<string, string>;
  demoMode?: boolean;
}): Promise<DeterministicDeliverableResult> {
  const isCoffee = demoMode || /coffee|cafe|pastry|bakery|espresso/i.test(goal);

  // Listed explicit assumptions
  const startupBudget = isCoffee ? 1200 : 300;
  const fixedMonthlyCost = isCoffee ? 650 : 120;
  const avgOrderPrice = isCoffee ? 14 : 95;
  const variableUnitCost = isCoffee ? 5.2 : 20;
  const monthlyOrdersTarget = isCoffee ? 140 : 12;

  // Deterministic local calculations via real backend calculator tool
  const marginExpr = `${avgOrderPrice} - ${variableUnitCost}`;
  const marginRes = await toolRegistry.execute('calculator', { expression: marginExpr }, 0);
  const unitMargin =
    marginRes.status === 'SUCCESS' ? Number(marginRes.output.result) : avgOrderPrice - variableUnitCost;

  const breakEvenExpr = `${fixedMonthlyCost} / (${avgOrderPrice} - ${variableUnitCost})`;
  const breakEvenRes = await toolRegistry.execute('calculator', { expression: breakEvenExpr }, 0);
  const breakEvenOrders =
    breakEvenRes.status === 'SUCCESS'
      ? Math.ceil(Number(breakEvenRes.output.result))
      : Math.ceil(fixedMonthlyCost / unitMargin);

  const m1RevExpr = `${monthlyOrdersTarget} * ${avgOrderPrice}`;
  const m1RevRes = await toolRegistry.execute('calculator', { expression: m1RevExpr }, 0);
  const m1Revenue = m1RevRes.status === 'SUCCESS' ? Number(m1RevRes.output.result) : monthlyOrdersTarget * avgOrderPrice;

  const m1NetExpr = `(${monthlyOrdersTarget} * (${avgOrderPrice} - ${variableUnitCost})) - ${fixedMonthlyCost}`;
  const m1NetRes = await toolRegistry.execute('calculator', { expression: m1NetExpr }, 0);
  const m1Net = m1NetRes.status === 'SUCCESS' ? Number(m1NetRes.output.result) : 0;

  const m2NetExpr = `(${Math.round(monthlyOrdersTarget * 1.25)} * (${avgOrderPrice} - ${variableUnitCost})) - ${fixedMonthlyCost}`;
  const m2NetRes = await toolRegistry.execute('calculator', { expression: m2NetExpr }, 0);
  const m2Net = m2NetRes.status === 'SUCCESS' ? Number(m2NetRes.output.result) : 0;

  const m3NetExpr = `(${Math.round(monthlyOrdersTarget * 1.5)} * (${avgOrderPrice} - ${variableUnitCost})) - ${fixedMonthlyCost}`;
  const m3NetRes = await toolRegistry.execute('calculator', { expression: m3NetExpr }, 0);
  const m3Net = m3NetRes.status === 'SUCCESS' ? Number(m3NetRes.output.result) : 0;

  const paybackMonthsExpr = `${startupBudget} / (${m1Net} > 0 ? ${m1Net} : 1)`;
  // Safe pure arithmetic expression without ternary
  const cleanPaybackExpr = m1Net > 0 ? `${startupBudget} / ${m1Net.toFixed(2)}` : `${startupBudget} / 1`;
  const paybackRes = await toolRegistry.execute('calculator', { expression: cleanPaybackExpr }, 0);
  const paybackMonths =
    paybackRes.status === 'SUCCESS' && m1Net > 0
      ? Number(paybackRes.output.result).toFixed(1)
      : '3+ (depends on growth rate)';
  void paybackMonthsExpr;

  const extracted = extractSuppliedRequirements(goal, clarificationAnswers);
  const localCtx = detectLocalContext(goal, clarificationAnswers);
  const labelHeader = demoMode
    ? '> **Label:** Illustrative example — all financial figures computed deterministically from the explicit assumptions listed below.'
    : '> **Estimated projection:** Financial figures computed deterministically via backend calculator from the explicit assumptions listed below.';

  const content = `# ${task?.title || 'Lean Business Plan & Financial Projections'}

${labelHeader}

## 1. Strategic Focus
- **Objective:** ${goal}
${localCtx.country ? `- **Target Country / Market:** ${localCtx.country} (Currency: ${localCtx.currencyCode} ${localCtx.currencySymbol})\n` : ''}- **Positioning:** Lead with a focused flagship offer, validate demand via a live prototype before fixed commitments, and anchor revenue around repeat or bundled orders.
${extracted.suppliedInformation.length > 0 ? `- **Supplied Context:** ${extracted.suppliedInformation.join('; ')}\n` : ''}
## 2. Explicit Projection Assumptions (Estimated projection)
1. **Initial Setup Capital:** $${startupBudget.toFixed(2)} (equipment, domain/branding, initial inventory/materials).
2. **Fixed Monthly Operating Cost:** $${fixedMonthlyCost.toFixed(2)} / month (pop-up space / tools / marketing baseline).
3. **Illustrative Average Order Value (AOV):** $${avgOrderPrice.toFixed(2)} per order.
4. **Direct Variable Cost per Order:** $${variableUnitCost.toFixed(2)} (ingredients, packaging, fulfillment).
5. **Month 1 Target Volume:** ${monthlyOrdersTarget} orders (growing +25% in Month 2 and +50% in Month 3).

## 3. Calculator-Verified Unit Economics & Projections
| Metric | Formula Evaluated | Verified Result |
| :--- | :--- | :--- |
| **Contribution Margin / Order** | \`${marginExpr}\` | **$${unitMargin.toFixed(2)}** |
| **Monthly Break-Even Volume** | \`${breakEvenExpr}\` | **${breakEvenOrders} orders / month** |
| **Month 1 Gross Revenue** | \`${m1RevExpr}\` | **$${m1Revenue.toFixed(2)}** |
| **Month 1 Projected Net Profit** | \`${m1NetExpr}\` | **$${m1Net.toFixed(2)}** |
| **Month 2 Projected Net (+25% vol.)** | \`${m2NetExpr}\` | **$${m2Net.toFixed(2)}** |
| **Month 3 Projected Net (+50% vol.)** | \`${m3NetExpr}\` | **$${m3Net.toFixed(2)}** |
| **Estimated Capital Payback (at M1 pace)** | \`${cleanPaybackExpr}\` | **${paybackMonths} months** |

## 4. Phased 30-Day Execution Roadmap
1. **Week 1 — Validate Offer & Landing Prototype:** Publish interactive landing page, share with 20 target buyers, confirm demand before purchasing full stock.
2. **Week 2 — Pilot Delivery:** Fulfill first ${Math.min(25, breakEvenOrders)} orders manually, measure real variable costs, and refine packaging/turnaround.
3. **Week 3–4 — Repeat Channel Activation:** Introduce weekly subscriptions or team bundles to move reliably above the **${breakEvenOrders}-order** monthly break-even threshold.
`;

  return {
    format: 'markdown',
    content,
    executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE · CALCULATOR VERIFIED]' : '[BUSINESS PLAN & MATH READY]',
    reasoning: `Generated strategic launch plan and computed unit margin ($${unitMargin.toFixed(2)}), monthly break-even (${breakEvenOrders} orders), and 3-month projections via deterministic backend calculator.`,
    logs: [
      `[CALCULATOR] Evaluated contribution margin (${marginExpr} = ${unitMargin.toFixed(2)}) & break-even (${breakEvenOrders} orders/mo).`,
      `[PROJECTION] Computed M1–M3 net cashflow deterministically with explicit listed assumptions.`,
    ],
    domainCategory: 'business_planning',
  };
}

export function synthesizeDesignBriefFallback({
  goal,
  task,
  demoMode = false,
}: {
  goal: string;
  task: any;
  demoMode?: boolean;
}): DeterministicDeliverableResult {
  const content = `# ${task?.title || 'Design System, Layout & Brand Concept'}

${demoMode ? '> **Label:** Illustrative example — adaptable layout & branding blueprint.' : '> **Design Blueprint:** Complete visual system, layout grid, and content hierarchy.'}

## Project Goal
${goal}

## 1. Visual Identity & Palette System
- **Primary Canvas:** Midnight Charcoal \`#08090E\` paired with elevated surface cards \`#111524\`.
- **Signature Accent:** Warm Metallic Amber \`#F59E0B\` with crisp off-white primary typography \`#F8FAFC\` (contrast > 11:1).
- **Typography Pairing:** Geometric display headings (\`Outfit\` / \`Space Grotesk\`) + clean readable body copy (\`Inter\` / system-ui).

## 2. Responsive Layout Architecture
1. **Sticky Header Navigation:** Compact brand mark left, max 4 anchor links right, collapsing cleanly into a mobile menu under \`768px\`.
2. **Focused Above-the-Fold Hero:** Clear 1-sentence value proposition, single primary CTA button, zero carousel clutter.
3. **Offerings & Comparison Grid:** 3-column adaptive CSS grid (\`repeat(auto-fit, minmax(230px, 1fr))\`) with category filter buttons.
4. **Trust & Conversion Section:** Transparent setup notes + interactive inquiry form with instant preview feedback.

## 3. Recommended Hero Copy Draft
- **Headline:** Clear, outcome-focused promise tailored to your core customer.
- **Subheadline:** Concise explanation of what makes your offer faster, fresher, or simpler to start today.
- **Primary CTA:** Action-oriented label (e.g. *Explore Menu & Packages* or *Book Free Intro Call*).
`;

  return {
    format: 'markdown',
    content,
    executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE]' : '[DESIGN CONCEPT READY]',
    reasoning: 'Created structured layout architecture, accessible color/typography tokens, and responsive content blueprint.',
    logs: ['[DESIGN] Emitted layout grid, palette tokens, and copy structure.'],
    domainCategory: 'design',
  };
}

export function synthesizeGeneralResearchFallback({
  goal,
  task,
  demoMode = false,
}: {
  goal: string;
  task: any;
  demoMode?: boolean;
}): DeterministicDeliverableResult {
  const extracted = extractSuppliedRequirements(goal);
  const content = `# ${task?.title || 'Structured Research Draft'}

${demoMode ? '> **Label:** Illustrative example — structured research draft with external confirmation markers.' : '> **Research Draft:** Structured synthesis built from core domain principles; items requiring live verification are explicitly marked.'}

## Research Scope
${goal}

## 1. Background Knowledge & Structural Framing
- **Primary Objective:** ${extracted.suppliedInformation[0] || goal}
- **Execution Principles:** Separate verified facts from illustrative hypotheses, benchmark unit economics before scaling, and keep customer-facing flows minimal and reversible.

## 2. Core Findings & Working Hypotheses
1. **Demand Signal Validation:** Early conversion rates improve significantly when buyers see concrete pricing tiers and a clear single action step.
2. **Operational Bottlenecks:** Initial friction typically clusters around onboarding latency and unclear turnaround expectations.
3. **Risk Mitigation:** Keep fixed commitments minimal until 10+ target users confirm willingness to pay.

## 3. Items Requiring Outside Confirmation
- [ ] **Primary Source Statistics [NEEDS OUTSIDE CONFIRMATION]:** Confirm exact market sizing and industry growth figures from current trade publications.
- [ ] **Regulatory & Compliance Check [NEEDS OUTSIDE CONFIRMATION]:** Verify any local licensing, tax, or privacy requirements specific to your jurisdiction.
- [ ] **Vendor / Platform Terms [NEEDS OUTSIDE CONFIRMATION]:** Review current API/tool rate limits and pricing pages directly before production launch.
`;

  return {
    format: 'markdown',
    content,
    executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE]' : '[RESEARCH DRAFT READY]',
    reasoning: 'Prepared structured research draft, background framing, working hypotheses, and explicit external confirmation markers.',
    logs: ['[RESEARCH_DRAFT] Generated structured draft with [NEEDS OUTSIDE CONFIRMATION] checklist.'],
    domainCategory: 'research',
  };
}

export async function synthesizeFallbackDeliverable({
  goal,
  task,
  expectedFile,
  clarificationAnswers,
  reason = '',
  demoMode = false,
}: {
  goal: string;
  task?: any;
  expectedFile?: string;
  clarificationAnswers?: Record<string, string>;
  reason?: string;
  demoMode?: boolean;
}): Promise<DeterministicDeliverableResult> {
  const resolvedFile = String(expectedFile || task?.expectedArtifact || 'deliverable.md');
  const lowerFile = resolvedFile.toLowerCase();
  const combinedContext = `${goal || ''} ${task?.title || ''} ${task?.description || ''} ${resolvedFile}`.toLowerCase();

  if (lowerFile.endsWith('.html')) {
    const content = buildEnhancedWebsitePrototype({
      goal,
      clarificationAnswers,
      demoMode,
    });
    return {
      format: 'html',
      content,
      executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE]' : '[WEBSITE PROTOTYPE READY]',
      reasoning: `Built responsive interactive HTML5/CSS/JS prototype "${resolvedFile}" with XSS-safe DOM rendering and live inquiry preview.`,
      logs: [
        `[DELIVERABLE] Synthesized responsive prototype '${resolvedFile}' (${Buffer.byteLength(content, 'utf8')} bytes).`,
        '[SECURITY] Strictly used textContent DOM APIs (zero innerHTML).',
      ],
      domainCategory: 'website',
    };
  }

  if (lowerFile.endsWith('.json')) {
    const detectedExpr = extractMathExpression(goal);
    const extracted = extractSuppliedRequirements(goal, clarificationAnswers);
    let calcResult: any = null;
    if (detectedExpr && isValidMathExpression(detectedExpr)) {
      const res = await toolRegistry.execute('calculator', { expression: detectedExpr }, 0);
      if (res.status === 'SUCCESS') calcResult = res.output;
    }
    const payload = {
      goal,
      stepId: task?.id || 'step',
      stepTitle: task?.title || 'Deliverable',
      label: demoMode ? 'Illustrative example' : 'Structured Manifest',
      expressionDetected: detectedExpr || null,
      calculatorResult: calcResult,
      suppliedInformation: extracted.suppliedInformation,
      missingInformation: extracted.missingInformation,
      clarificationAnswers: clarificationAnswers || {},
      timestamp: new Date().toISOString(),
    };
    const content = JSON.stringify(payload, null, 2);
    return {
      format: 'json',
      content,
      executionBadge: demoMode ? '[ILLUSTRATIVE EXAMPLE]' : '[STRUCTURED MANIFEST READY]',
      reasoning: `Generated structured JSON manifest "${resolvedFile}" tailored to the mission inputs (${reason ? 'local synthesizer active' : 'ready'}).`,
      logs: [`[DELIVERABLE] Built JSON manifest '${resolvedFile}' (${Buffer.byteLength(content, 'utf8')} bytes).`],
      domainCategory: 'json_manifest',
    };
  }

  // Classify Markdown deliverables intelligently into the 5 fallback domains
  if (/competitor|market|pricing|research|search|trend|benchmark/.test(combinedContext) && !/financial|budget|plan|strategy/.test(lowerFile)) {
    return synthesizeBusinessResearchFallback({ goal, task, demoMode });
  }

  if (/financial|budget|projection|plan|strategy|business|revenue|margin|pricing|roadmap/.test(combinedContext)) {
    return synthesizeBusinessPlanWithRealMath({
      goal,
      task,
      clarificationAnswers,
      demoMode,
    });
  }

  if (/design|brand|ui|ux|palette|layout|wireframe|typography/.test(combinedContext)) {
    return synthesizeDesignBriefFallback({ goal, task, demoMode });
  }

  return synthesizeGeneralResearchFallback({ goal, task, demoMode });
}

export function synthesizeChatFallbackReply({
  message,
  systemPreset,
  missionContext,
}: {
  message: string;
  systemPreset?: string;
  missionContext?: string;
}): string {
  const cleanMsg = message.trim();
  const hasMath = extractMathExpression(cleanMsg);
  const roleLabel =
    systemPreset === 'researcher'
      ? 'Research & Planning Guidance'
      : systemPreset === 'architect'
      ? 'Architecture & Speed Breakdown'
      : 'Actionable Next Steps';

  const contextNote = missionContext
    ? `\n\nGrounded in your active project context, here is how to apply this immediately:`
    : '';

  if (/price|pricing|budget|cost|revenue|profit|break-?even|money/i.test(cleanMsg)) {
    return `${roleLabel}${contextNote}
1. Separate **fixed monthly overhead** (tools, rent, baseline marketing) from **direct unit cost** per order.
2. Target at least a 55–65% gross margin on your core offer so small volume covers overhead fast.
3. Introduce one bundled or recurring tier (e.g., weekly pass or team pack) alongside your single entry item.

Tip: Launch a guided project from the main bar anytime if you'd like PHOENIX to run deterministic break-even math and generate a full deliverable pack.${hasMath ? ` (Detected expression "${hasMath}" — launch a quick mission to compute it with our exact math engine.)` : ''}`;
  }

  if (/website|landing|page|html|design|brand|logo|prototype/i.test(cleanMsg)) {
    return `${roleLabel}${contextNote}
1. Keep the above-the-fold hero focused on **one clear promise** and **one primary action button**.
2. Show 2–3 structured offering cards with transparent pricing or starter tiers rather than long paragraphs.
3. Include a fast interactive inquiry or waitlist preview form so visitors can act immediately.

Click **"Turn last idea into a guided project"** above if you want PHOENIX to build and validate a working responsive HTML/CSS/JS prototype for "${cleanMsg.slice(0, 70)}".`;
  }

  return `${roleLabel}${contextNote}
Here is a clear way forward for "${cleanMsg.slice(0, 90)}":
1. **Define the first concrete output:** Narrow the scope to one tangible deliverable (a starter plan, cost breakdown, or interactive prototype) before expanding.
2. **Validate core assumptions:** Confirm your customer pricing band and delivery turnaround with 3–5 real prospects.
3. **Execute in fast iterations:** Use PHOENIX's guided project mode to generate structured deliverables, validate security/structure automatically, and preview outputs live as each step completes.`;
}
