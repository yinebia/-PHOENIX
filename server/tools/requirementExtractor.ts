/**
 * Deterministic Requirement & Contradiction Extractor
 * Ensures user-supplied details (including country/region and USD currency)
 * are preserved and NEVER falsely reported as missing, while surfacing genuine
 * missing fields and contradictory instructions cleanly.
 */

export interface ExtractedRequirements {
  suppliedInformation: string[];
  missingInformation: string[];
  contradictionsDetected: string[];
  businessName?: string;
  country?: string;
  currency?: string;
  hasProductCatalogue: boolean;
  isWebsiteGoal: boolean;
  isNorthernStyle: boolean;
}

export interface LocalContextInfo {
  country?: string;
  currencyCode: 'USD' | 'EUR' | 'GBP';
  currencySymbol: '$' | '€' | '£';
}

const KNOWN_COUNTRIES = [
  'Ghana',
  'Nigeria',
  'Kenya',
  'South Africa',
  'United States',
  'USA',
  'United Kingdom',
  'UK',
  'Canada',
  'Germany',
  'France',
  'India',
  'Singapore',
  'Australia',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Senegal',
  'Cameroon',
];

const COUNTRY_CITY_MAP: Array<[RegExp, string]> = [
  [/\b(ghana|accra|kumasi|tamale|takoradi|cape\s+coast)\b/i, 'Ghana'],
  [/\b(nigeria|lagos|abuja|kano|ibadan)\b/i, 'Nigeria'],
  [/\b(kenya|nairobi|mombasa)\b/i, 'Kenya'],
  [/\b(south\s+africa|johannesburg|cape\s+town|durban)\b/i, 'South Africa'],
  [/\b(united\s+states|u\.s\.a\.?|usa|new\s+york|san\s+francisco|austin)\b/i, 'United States'],
  [/\b(united\s+kingdom|uk|london|manchester)\b/i, 'United Kingdom'],
  [/\b(canada|toronto|vancouver|montreal)\b/i, 'Canada'],
  [/\b(india|mumbai|bengaluru|bangalore|delhi)\b/i, 'India'],
];

export function detectLocalContext(
  goal: string,
  clarificationAnswers?: Record<string, string>
): LocalContextInfo {
  const answersJoined = clarificationAnswers
    ? Object.values(clarificationAnswers).join(' ')
    : '';
  const combined = `${goal || ''} ${answersJoined}`;

  let country: string | undefined;
  for (const [regex, mappedCountry] of COUNTRY_CITY_MAP) {
    if (regex.test(combined)) {
      country = mappedCountry;
      break;
    }
  }
  if (!country) {
    for (const c of KNOWN_COUNTRIES) {
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(combined)) {
        country = c;
        break;
      }
    }
  }

  // Keep using the dollar ($ / USD) as standard pricing currency unless user explicitly asks for EUR/GBP
  let currencyCode: 'USD' | 'EUR' | 'GBP' = 'USD';
  let currencySymbol: '$' | '€' | '£' = '$';
  if (/\bEUR\b|€/i.test(combined)) {
    currencyCode = 'EUR';
    currencySymbol = '€';
  } else if (/\bGBP\b|£/i.test(combined)) {
    currencyCode = 'GBP';
    currencySymbol = '£';
  }

  return {
    country,
    currencyCode,
    currencySymbol,
  };
}

export function extractSuppliedRequirements(
  goal: string,
  clarificationAnswers?: Record<string, string>
): ExtractedRequirements {
  const g = (goal || '').trim();
  const answersJoined = clarificationAnswers
    ? Object.entries(clarificationAnswers)
        .filter(([, v]) => v && v.trim().length > 0)
        .map(([q, v]) => `${q}: ${v.trim()}`)
        .join(' | ')
    : '';
  const combined = `${g} ${answersJoined}`;
  const combinedLower = combined.toLowerCase();

  const suppliedInformation: string[] = [];
  const contradictionsDetected: string[] = [];
  const missingInformation: string[] = [];

  const isNorthernStyle = /northern\s+style/i.test(combined);
  const isWebsiteGoal = /\b(website|landing page|prototype|storefront|web app|catalogue|catalog|homepage)\b/i.test(
    combined
  );
  const hasProductCatalogue = /\b(catalogue|catalog|products?|pricing|tiers?|clothing|fashion|smocks?|fugu|store)\b/i.test(
    combined
  );

  const localCtx = detectLocalContext(g, clarificationAnswers);

  let businessName: string | undefined;
  if (isNorthernStyle) {
    businessName = 'Northern Style';
  } else {
    const brandMatch = g.match(/\b(?:called|named|brand|business\s+name[:\s]+)\s*["']?([A-Z][A-Za-z0-9&\s-]{2,32})["']?/);
    if (brandMatch && brandMatch[1]) {
      businessName = brandMatch[1].trim();
    }
  }

  if (businessName) {
    suppliedInformation.push(`Business Name: ${businessName}`);
  }

  if (localCtx.country) {
    suppliedInformation.push(`Target Country / Location: ${localCtx.country}`);
  }

  if (clarificationAnswers) {
    for (const [q, a] of Object.entries(clarificationAnswers)) {
      if (a && a.trim()) {
        suppliedInformation.push(`Operator Clarification (${q.slice(0, 48)}): ${a.trim()}`);
      }
    }
  }

  // Currency detection — default to USD ($)
  const currency: string = localCtx.currencyCode;
  suppliedInformation.push(`Pricing Currency: ${currency} ($)`);

  // Website sections & functional scope detection
  const requestedSections: string[] = [];
  if (/\bhomepage|hero\b/i.test(combinedLower)) requestedSections.push('homepage');
  if (/\bcatalogue|catalog\b/i.test(combinedLower)) requestedSections.push('product catalogue');
  if (/\bcategory filters?|filtering\b/i.test(combinedLower)) requestedSections.push('category filters');
  if (/\bpricing tiers?|pricing\b/i.test(combinedLower)) requestedSections.push('pricing tiers');
  if (/\babout\b/i.test(combinedLower)) requestedSections.push('about section');
  if (/\bcontact\b/i.test(combinedLower)) requestedSections.push('contact section');
  if (/\bwhatsapp|wa\.me\b/i.test(combinedLower)) requestedSections.push('WhatsApp link workflow');
  if (/\binquiry|order form\b/i.test(combinedLower)) requestedSections.push('customer inquiry process');
  if (/\brecruitment\b/i.test(combinedLower)) requestedSections.push('recruitment business workflow');
  if (/\bwaitlist\b/i.test(combinedLower)) requestedSections.push('waitlist signup prototype');

  if (requestedSections.length > 0) {
    suppliedInformation.push(`Requested Features/Sections: ${requestedSections.join(', ')}`);
  }

  // Target audience detection
  if (/\btarget audience|for\s+(customers|shoppers|developers|agencies|founders|students|youth|women|men|businesses|companies)\b/i.test(combined)) {
    const audMatch = combined.match(/\bfor\s+([A-Za-z0-9\s-]{3,35})(?:[.,;]|$)/i);
    if (audMatch && audMatch[1] && !/my business/i.test(audMatch[1])) {
      suppliedInformation.push(`Target Audience / Focus: ${audMatch[1].trim()}`);
    }
  }

  // Domain / Offerings
  const domainMatches = combined.match(/\b(fashion|clothing|smocks|fugu|textiles|accessories|recruitment|developer tool|saas|tailoring|bakery|coffee)\b/gi);
  if (domainMatches && domainMatches.length > 0) {
    const uniqueDomains = Array.from(new Set(domainMatches.map((d) => d.toLowerCase())));
    suppliedInformation.push(`Domain / Offerings Mentioned: ${uniqueDomains.join(', ')}`);
  }

  // --- CONTRADICTION DETECTION ---
  const saysNoMoney = /\b(no money|zero budget|free only|\$0|0 budget|no upfront cost)\b/i.test(combinedLower);
  const saysHighSpend = /\b(\$\d{3,}|spend\s+\$?\d+|paid ads|paid advertising|hire\s+(a\s+)?paid\s+team)\b/i.test(
    combinedLower
  );
  if (saysNoMoney && saysHighSpend) {
    contradictionsDetected.push(
      'Budget contradiction: Goal specifies zero/no budget while also requesting paid spend or paid advertising.'
    );
  }

  const saysNoExternalLinks = /\b(no external links|offline only|no third-party links)\b/i.test(combinedLower);
  const saysWhatsAppOrExternal = /\b(whatsapp|wa\.me|external payment|stripe checkout)\b/i.test(combinedLower);
  if (saysNoExternalLinks && saysWhatsAppOrExternal) {
    contradictionsDetected.push(
      'Connectivity contradiction: Goal forbids external links/services while also requesting external WhatsApp or third-party links.'
    );
  }

  const saysNoPlaceholders = /\b(no placeholders|must have exact real prices|no bracketed tokens)\b/i.test(combinedLower);
  const saysDontInvent = /\b(do not invent|never invent|don't invent)\b/i.test(combinedLower);
  const hasNumericPrice = /\b(USD|\$|€|£)\s*\d+|\d+\s*(USD|dollars?)\b/i.test(combined);
  if (saysNoPlaceholders && saysDontInvent && !hasNumericPrice && hasProductCatalogue) {
    contradictionsDetected.push(
      'Data contradiction: Goal forbids both placeholders and inventing prices, yet no actual numeric product prices were provided.'
    );
  }

  const saysPrototypeOnly = /\b(prototype only|local only|no backend)\b/i.test(combinedLower);
  const saysLiveDeployPersist = /\b(live production database|process real payments|deploy to custom domain immediately)\b/i.test(
    combinedLower
  );
  if (saysPrototypeOnly && saysLiveDeployPersist) {
    contradictionsDetected.push(
      'Scope contradiction: Goal specifies a local prototype with no backend while simultaneously requiring live database persistence or live domain deployment.'
    );
  }

  // --- GENUINE MISSING INFORMATION INVENTORY ---
  if (isWebsiteGoal) {
    if (!businessName) {
      missingInformation.push('Business or brand name');
    }
    if (!hasNumericPrice && (hasProductCatalogue || isNorthernStyle)) {
      missingInformation.push(`Exact prices in ${currency} ($)`);
    }
    if (isNorthernStyle || hasProductCatalogue) {
      if (!/image|photo|jpg|png|webp/i.test(answersJoined)) {
        missingInformation.push('Real product photos / image URLs');
      }
      if (!/\b(S|M|L|XL|XXL|sizes?\s*[:=])\b/i.test(combined)) {
        missingInformation.push('Available product sizes');
      }
      if (!/\b(smocks?|fugu|woven textiles|product description)\b/i.test(answersJoined) && isNorthernStyle) {
        missingInformation.push('Final verified product names & descriptions');
      }
    }
    if (!localCtx.country && !/\b(location|address|street|city)\b/i.test(combinedLower)) {
      missingInformation.push('Verified business location / showroom address');
    }
    if (!/@|[0-9]{7,}/.test(combined)) {
      missingInformation.push('Verified business contact email / phone');
    }
    if ((/\bwhatsapp\b/i.test(combinedLower) || isNorthernStyle) && !/[0-9]{8,}/.test(answersJoined || g)) {
      missingInformation.push('Active WhatsApp business number');
    }
    if ((/\bdelivery|return\b/i.test(combinedLower) || isNorthernStyle) && !/days|policy|refund/i.test(answersJoined)) {
      missingInformation.push('Delivery and return policy terms');
    }
  }

  return {
    suppliedInformation,
    missingInformation,
    contradictionsDetected,
    businessName,
    country: localCtx.country,
    currency,
    hasProductCatalogue,
    isWebsiteGoal,
    isNorthernStyle,
  };
}

/**
 * Reconciles AI-generated understanding fields against deterministic extraction
 * so user-supplied details are never mistakenly listed as missing.
 */
export function reconcileUnderstandingWithGoal(
  understanding: any,
  extracted: ExtractedRequirements
) {
  const existingSupplied: string[] = Array.isArray(understanding?.suppliedInformation)
    ? understanding.suppliedInformation
    : [];
  const mergedSupplied = Array.from(new Set([...extracted.suppliedInformation, ...existingSupplied]));

  const suppliedLower = mergedSupplied.join(' ').toLowerCase();
  const rawMissing: string[] = Array.isArray(understanding?.missingInformation)
    ? understanding.missingInformation
    : [];

  // Strip out any false-positive "missing" entry whose core subject was actually supplied
  const filteredMissing = rawMissing.filter((item) => {
    const low = item.toLowerCase();
    if (extracted.businessName && /\b(business name|brand name)\b/.test(low)) return false;
    if (extracted.country && /\b(country|location)\b/.test(low) && !/street|showroom/.test(low)) return false;
    if (extracted.currency && /\bcurrency\b/.test(low) && !/price|amount|tier/.test(low)) return false;
    if (/website sections|catalogue layout/.test(low) && suppliedLower.includes('catalogue')) return false;
    return true;
  });

  const mergedMissing = Array.from(
    new Set([...filteredMissing, ...extracted.missingInformation])
  );

  const existingContradictions: string[] = Array.isArray(understanding?.contradictionsDetected)
    ? understanding.contradictionsDetected
    : [];
  const mergedContradictions = Array.from(
    new Set([...extracted.contradictionsDetected, ...existingContradictions])
  );

  const existingRisks: string[] = Array.isArray(understanding?.risks) ? understanding.risks : [];
  const mergedRisks = Array.from(new Set([...mergedContradictions, ...existingRisks]));

  return {
    ...understanding,
    suppliedInformation: mergedSupplied,
    missingInformation: mergedMissing,
    contradictionsDetected: mergedContradictions,
    risks: mergedRisks,
  };
}
