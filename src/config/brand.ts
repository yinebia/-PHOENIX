import phoenixEmblemAsset from '../assets/images/phoenix_golden_emblem_1795220196461.jpg';
import { PhoenixStage } from '../types/agent';

/**
 * Central Brand Identity Configuration
 * Working title & descriptor are isolated here so branding can be updated cleanly
 * following final trademark and domain clearance.
 */
export const BRAND_CONFIG = {
  name: 'PHOENIX',
  descriptor: 'AUTONOMOUS INTELLIGENCE',
  tagline: 'The AI that turns intentions into reality.',
  emblemSrc: phoenixEmblemAsset,
  emblemAlt: 'PHOENIX Golden Emblem',
  copyrightNotice: 'Working brand identity · Configurable for trademark clearance',
} as const;

export const FRIENDLY_STAGE_LABELS: Record<PhoenixStage, string> = {
  UNDERSTAND: '1. Understanding your goal',
  STRATEGISE: '2. Planning the steps',
  EXECUTE: '3. Getting the work done',
  COORDINATE: '4. Putting it together',
  VERIFY_RECOVER: '5. Checking the results',
  DELIVER: '6. Ready for you',
};

export const TECHNICAL_STAGE_LABELS: Record<PhoenixStage, string> = {
  UNDERSTAND: '1. Understand',
  STRATEGISE: '2. Strategise',
  EXECUTE: '3. Execute',
  COORDINATE: '4. Coordinate',
  VERIFY_RECOVER: '5. Verify & Recover',
  DELIVER: '6. Deliver',
};

export interface FriendlySuggestion {
  id: string;
  title: string;
  subtitle: string;
  goal: string;
  persona: string;
  depth: string;
}

export const FRIENDLY_SUGGESTIONS: FriendlySuggestion[] = [
  {
    id: 'start-business',
    title: 'Start a business',
    subtitle: 'Shape your idea, budget, and launch plan',
    goal: 'Help me plan and launch a small local or online business step by step, including pricing calculations and a clean starter website.',
    persona: 'Apex Growth',
    depth: 'Standard DAG',
  },
  {
    id: 'build-website',
    title: 'Build a website',
    subtitle: 'Create a clean, mobile-friendly site prototype',
    goal: 'Build a clean, responsive website prototype for my project or business, keeping clear [PLACEHOLDER] markers for any details I have not provided yet.',
    persona: 'Vanguard Architect',
    depth: 'Standard DAG',
  },
  {
    id: 'research-opportunity',
    title: 'Research an opportunity',
    subtitle: 'Explore options, live facts, and realistic costs',
    goal: 'Research a business or career opportunity using verified web sources and summarize real costs, benefits, risks, and practical first steps.',
    persona: 'Apex Growth',
    depth: 'Standard DAG',
  },
  {
    id: 'create-something',
    title: 'Create something new',
    subtitle: 'Turn a rough creative idea into real files',
    goal: 'Help me turn a new idea into a structured plan, clear written materials, and ready-to-use digital deliverables.',
    persona: 'Vanguard Architect',
    depth: 'Standard DAG',
  },
  {
    id: 'automate-task',
    title: 'Automate a task',
    subtitle: 'Organize repeatable work and calculations safely',
    goal: 'Help me calculate numbers accurately and organize a repeatable workflow with clear human approval checkpoints before anything external happens.',
    persona: 'Chronos Ops',
    depth: 'Standard DAG',
  },
];

export { CELEBRATION_HEADLINES } from '../utils/celebration';
