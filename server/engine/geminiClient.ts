import { GoogleGenAI } from '@google/genai';

export type FreeTierGeminiModel = 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen';

export const FAST_TEXT_MODEL: FreeTierGeminiModel = 'gemini-3.1-flash-lite';
export const SEARCH_GROUNDED_MODEL: FreeTierGeminiModel = 'gemini-4-hydrogen';

function resolveExternalTimeoutMs(): number {
  const raw = Number(process.env.PHOENIX_EXTERNAL_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 1000) {
    return Math.min(20_000, Math.round(raw));
  }
  return 20_000;
}

export const EXTERNAL_CALL_TIMEOUT_MS: number = resolveExternalTimeoutMs();
export const EXTERNAL_MAX_RETRIES = 1;

export type GeminiErrorKind =
  | 'AUTH_CONFIG'
  | 'QUOTA_EXHAUSTED'
  | 'TIMEOUT'
  | 'TRANSIENT'
  | 'UNKNOWN';

export interface ClassifiedGeminiError {
  kind: GeminiErrorKind;
  statusCode: number;
  retryableSameModel: boolean;
  allowModelFailover: boolean;
  userMessage: string;
  rawMessage: string;
  retryDelayMs?: number;
}

export interface ModelHealthSnapshot {
  model: FreeTierGeminiModel;
  healthy: boolean;
  cooldownActive: boolean;
  cooldownUntil: string | null;
  cooldownReason: string | null;
  consecutiveTimeouts: number;
  lastErrorKind: GeminiErrorKind | null;
  lastErrorMessage: string | null;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
}

interface InternalModelState {
  cooldownUntil: number;
  cooldownReason: string | null;
  consecutiveTimeouts: number;
  lastErrorKind: GeminiErrorKind | null;
  lastErrorMessage: string | null;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
}

const DEFAULT_QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
const TIMEOUT_DEGRADED_COOLDOWN_MS = 2 * 60 * 1000;

const modelStates: Record<FreeTierGeminiModel, InternalModelState> = {
  'gemini-3.1-flash-lite': {
    cooldownUntil: 0,
    cooldownReason: null,
    consecutiveTimeouts: 0,
    lastErrorKind: null,
    lastErrorMessage: null,
    lastLatencyMs: null,
    lastSuccessAt: null,
  },
  'gemini-4-hydrogen': {
    cooldownUntil: 0,
    cooldownReason: null,
    consecutiveTimeouts: 0,
    lastErrorKind: null,
    lastErrorMessage: null,
    lastLatencyMs: null,
    lastSuccessAt: null,
  },
};

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function parseQuotaRetryDelayMs(err: any): number {
  const msg = String(err?.message || err || '');
  const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (match) {
    const secs = parseInt(match[1], 10);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.max(60_000, Math.min(secs * 1000, 15 * 60 * 1000));
    }
  }
  return DEFAULT_QUOTA_COOLDOWN_MS;
}

export function classifyGeminiError(err: any): ClassifiedGeminiError {
  const rawMessage = String(err?.message || err || 'Unknown Gemini error');
  const numericStatus = Number(err?.status ?? err?.statusCode ?? err?.code ?? err?.error?.code ?? 0);

  // 1. Permanent Authentication / Configuration Errors (NEVER retry)
  if (
    numericStatus === 401 ||
    numericStatus === 403 ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|GEMINI_API_KEY is not configured/i.test(
      rawMessage
    )
  ) {
    return {
      kind: 'AUTH_CONFIG',
      statusCode: numericStatus === 401 ? 401 : 403,
      retryableSameModel: false,
      allowModelFailover: false,
      userMessage:
        'AI authentication is currently unavailable on the server. Please check the server API key configuration.',
      rawMessage,
    };
  }

  if (
    numericStatus === 404 ||
    (numericStatus === 400 && /INVALID_ARGUMENT|unsupported|not found/i.test(rawMessage)) ||
    /model.*not found|NOT_FOUND.*models\//i.test(rawMessage)
  ) {
    const isModelNotFound = numericStatus === 404 || /NOT_FOUND|model.*not found/i.test(rawMessage);
    return {
      kind: 'AUTH_CONFIG',
      statusCode: isModelNotFound ? 404 : 400,
      retryableSameModel: false,
      allowModelFailover: isModelNotFound,
      userMessage:
        'The AI request used an unsupported model or format. Switching to a supported model or adjusting inputs is required.',
      rawMessage,
    };
  }

  // 2. Quota / Rate-Limit Exhaustion (Do not blindly retry same model; allow failing over to alternate free-tier model)
  if (
    numericStatus === 429 ||
    /429|RESOURCE_EXHAUSTED|quota exceeded|rate[- ]?limit|free_tier_requests/i.test(rawMessage)
  ) {
    return {
      kind: 'QUOTA_EXHAUSTED',
      statusCode: 429,
      retryableSameModel: false,
      allowModelFailover: true,
      retryDelayMs: parseQuotaRetryDelayMs(err),
      userMessage:
        'Usage demand is temporarily high on this AI model. Your conversation is safe — you can retry in a moment.',
      rawMessage,
    };
  }

  // 3. Timeouts (Retry once or fail over cleanly)
  if (/timed out|timeout|ETIMEDOUT|ESOCKETTIMEDOUT|AbortError/i.test(rawMessage)) {
    return {
      kind: 'TIMEOUT',
      statusCode: 504,
      retryableSameModel: true,
      allowModelFailover: true,
      userMessage:
        'The AI took longer than expected to respond. Your conversation is preserved — please try again.',
      rawMessage,
    };
  }

  // 4. Transient Server / Network Errors (Controlled retry with backoff)
  if (
    numericStatus === 500 ||
    numericStatus === 502 ||
    numericStatus === 503 ||
    numericStatus === 504 ||
    /ECONNRESET|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|fetch failed|network|socket hang up|UNAVAILABLE|INTERNAL|empty response/i.test(
      rawMessage
    )
  ) {
    return {
      kind: 'TRANSIENT',
      statusCode: numericStatus >= 500 && numericStatus < 600 ? numericStatus : 503,
      retryableSameModel: true,
      allowModelFailover: true,
      userMessage:
        'Temporary connection hiccup reaching the AI service. Your progress is saved — please retry.',
      rawMessage,
    };
  }

  return {
    kind: 'UNKNOWN',
    statusCode: numericStatus >= 400 && numericStatus < 600 ? numericStatus : 502,
    retryableSameModel: false,
    allowModelFailover: true,
    userMessage: 'The AI service could not complete this request right now. Please try again.',
    rawMessage,
  };
}

export function isModelInCooldown(model: FreeTierGeminiModel): boolean {
  return Date.now() < modelStates[model].cooldownUntil;
}

export function canCallAnyGeminiModel(ai: GoogleGenAI | null): boolean {
  if (!ai) return false;
  return !isModelInCooldown('gemini-3.1-flash-lite') || !isModelInCooldown('gemini-4-hydrogen');
}

export function markModelFailure(model: FreeTierGeminiModel, classified: ClassifiedGeminiError, context: string): void {
  const st = modelStates[model];
  st.lastErrorKind = classified.kind;
  st.lastErrorMessage = classified.rawMessage.slice(0, 260);

  if (classified.kind === 'QUOTA_EXHAUSTED') {
    const delayMs = classified.retryDelayMs || DEFAULT_QUOTA_COOLDOWN_MS;
    const nextUntil = Date.now() + delayMs;
    const alreadyCooling = Date.now() < st.cooldownUntil;
    if (nextUntil > st.cooldownUntil) {
      st.cooldownUntil = nextUntil;
      st.cooldownReason = `Quota cooldown (${Math.round(delayMs / 1000)}s)`;
    }
    if (!alreadyCooling) {
      console.warn(
        `[PHOENIX GEMINI] Model ${model} reached free-tier quota at ${context}. Cooldown ${Math.round(delayMs / 1000)}s.`
      );
    }
    return;
  }

  if (classified.kind === 'TIMEOUT') {
    st.consecutiveTimeouts += 1;
    if (st.consecutiveTimeouts >= 2) {
      st.cooldownUntil = Date.now() + TIMEOUT_DEGRADED_COOLDOWN_MS;
      st.cooldownReason = `Temporary latency guard (${Math.round(TIMEOUT_DEGRADED_COOLDOWN_MS / 1000)}s after ${st.consecutiveTimeouts} timeouts)`;
      console.warn(
        `[PHOENIX GEMINI] Model ${model} hit ${st.consecutiveTimeouts} consecutive timeouts (${context}). Failing over to alternate model for ${Math.round(TIMEOUT_DEGRADED_COOLDOWN_MS / 1000)}s.`
      );
    }
  }
}

export function markModelSuccess(model: FreeTierGeminiModel, latencyMs: number): void {
  const st = modelStates[model];
  st.cooldownUntil = 0;
  st.cooldownReason = null;
  st.consecutiveTimeouts = 0;
  st.lastErrorKind = null;
  st.lastErrorMessage = null;
  st.lastLatencyMs = Math.round(latencyMs);
  st.lastSuccessAt = new Date().toISOString();
}

export function getGeminiHealthSummary(ai: GoogleGenAI | null): {
  aiConnected: boolean;
  geminiAvailable: boolean;
  quotaCooldownActive: boolean;
  primaryModel: FreeTierGeminiModel;
  searchModel: FreeTierGeminiModel;
  models: ModelHealthSnapshot[];
} {
  const now = Date.now();
  const models: ModelHealthSnapshot[] = (
    ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as FreeTierGeminiModel[]
  ).map((model) => {
    const st = modelStates[model];
    const cooldownActive = now < st.cooldownUntil;
    return {
      model,
      healthy: Boolean(ai) && !cooldownActive,
      cooldownActive,
      cooldownUntil: cooldownActive ? new Date(st.cooldownUntil).toISOString() : null,
      cooldownReason: cooldownActive ? st.cooldownReason : null,
      consecutiveTimeouts: st.consecutiveTimeouts,
      lastErrorKind: st.lastErrorKind,
      lastErrorMessage: st.lastErrorMessage,
      lastLatencyMs: st.lastLatencyMs,
      lastSuccessAt: st.lastSuccessAt,
    };
  });

  return {
    aiConnected: Boolean(ai),
    geminiAvailable: canCallAnyGeminiModel(ai),
    quotaCooldownActive: Boolean(ai) && models.every((m) => m.cooldownActive),
    primaryModel: FAST_TEXT_MODEL,
    searchModel: SEARCH_GROUNDED_MODEL,
    models,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ResilientGeminiOptions<T> {
  ai: GoogleGenAI | null;
  operation: string;
  primaryModel: FreeTierGeminiModel;
  fallbackModel?: FreeTierGeminiModel | null;
  timeoutMs: number;
  fallbackTimeoutMs?: number;
  maxTransientRetries?: number;
  baseBackoffMs?: number;
  execute: (model: FreeTierGeminiModel, timeoutMs: number) => Promise<T>;
}

export interface ResilientGeminiResult<T> {
  result: T;
  modelUsed: FreeTierGeminiModel;
  fallbackFromModel?: FreeTierGeminiModel;
  attempts: number;
  latencyMs: number;
}

export class GeminiOperationError extends Error {
  classified: ClassifiedGeminiError;
  attempts: number;
  modelsTried: FreeTierGeminiModel[];

  constructor(
    classified: ClassifiedGeminiError,
    attempts: number,
    modelsTried: FreeTierGeminiModel[]
  ) {
    super(classified.userMessage);
    this.name = 'GeminiOperationError';
    this.classified = classified;
    this.attempts = attempts;
    this.modelsTried = modelsTried;
  }
}

export async function runGeminiWithResilience<T>(
  opts: ResilientGeminiOptions<T>
): Promise<ResilientGeminiResult<T>> {
  const {
    ai,
    operation,
    primaryModel,
    fallbackModel = null,
    timeoutMs,
    fallbackTimeoutMs = timeoutMs,
    maxTransientRetries = EXTERNAL_MAX_RETRIES,
    baseBackoffMs = 350,
    execute,
  } = opts;

  const boundedTimeoutMs = Math.min(timeoutMs, EXTERNAL_CALL_TIMEOUT_MS);
  const boundedFallbackTimeoutMs = Math.min(fallbackTimeoutMs, EXTERNAL_CALL_TIMEOUT_MS);
  const boundedRetries = Math.min(maxTransientRetries, EXTERNAL_MAX_RETRIES);

  if (!ai) {
    throw new GeminiOperationError(
      {
        kind: 'AUTH_CONFIG',
        statusCode: 503,
        retryableSameModel: false,
        allowModelFailover: false,
        userMessage: 'GEMINI_API_KEY is not configured on the backend server.',
        rawMessage: 'GEMINI_API_KEY is not configured on the backend server.',
      },
      0,
      []
    );
  }

  const candidateModels: FreeTierGeminiModel[] = [];
  if (!isModelInCooldown(primaryModel)) {
    candidateModels.push(primaryModel);
  }
  if (fallbackModel && fallbackModel !== primaryModel && !isModelInCooldown(fallbackModel)) {
    candidateModels.push(fallbackModel);
  }

  // If every candidate is in temporary latency cooldown (not auth error), allow primary once cleanly
  if (candidateModels.length === 0) {
    const fallbackBlockedErr = modelStates[primaryModel].lastErrorKind === 'QUOTA_EXHAUSTED';
    throw new GeminiOperationError(
      {
        kind: fallbackBlockedErr ? 'QUOTA_EXHAUSTED' : 'TIMEOUT',
        statusCode: fallbackBlockedErr ? 429 : 504,
        retryableSameModel: false,
        allowModelFailover: false,
        userMessage: fallbackBlockedErr
          ? 'Free-tier AI quota is temporarily resting across available models. Please try again shortly.'
          : 'AI models are temporarily busy. Please try again in a moment.',
        rawMessage: modelStates[primaryModel].cooldownReason || 'All candidate models in cooldown',
      },
      0,
      []
    );
  }

  let totalAttempts = 0;
  let lastClassified: ClassifiedGeminiError | null = null;
  const modelsTried: FreeTierGeminiModel[] = [];

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const model = candidateModels[mIdx];
    const isFallback = mIdx > 0;
    const perAttemptTimeout = isFallback ? boundedFallbackTimeoutMs : boundedTimeoutMs;
    const retriesForThisModel = isFallback ? 0 : boundedRetries;
    modelsTried.push(model);

    for (let attempt = 0; attempt <= retriesForThisModel; attempt++) {
      totalAttempts += 1;
      const t0 = performance.now();
      try {
        const value = await withTimeout(
          execute(model, perAttemptTimeout),
          perAttemptTimeout,
          `Gemini ${operation} (${model})`
        );
        const latencyMs = Math.max(1, Math.round(performance.now() - t0));
        markModelSuccess(model, latencyMs);
        return {
          result: value,
          modelUsed: model,
          fallbackFromModel: isFallback ? primaryModel : undefined,
          attempts: totalAttempts,
          latencyMs,
        };
      } catch (err: any) {
        const classified = classifyGeminiError(err);
        lastClassified = classified;
        markModelFailure(model, classified, `${operation}#attempt${attempt + 1}`);

        // Never retry permanent Auth/Config failures
        if (classified.kind === 'AUTH_CONFIG' && !classified.allowModelFailover) {
          throw new GeminiOperationError(classified, totalAttempts, modelsTried);
        }

        // Retry same model only on transient/timeout errors if retries remain (and if not failing straight to a faster fallback)
        const hasAlternateHealthyModel = mIdx < candidateModels.length - 1;
        if (
          classified.retryableSameModel &&
          attempt < retriesForThisModel &&
          !(classified.kind === 'TIMEOUT' && hasAlternateHealthyModel)
        ) {
          const jitter = Math.floor(Math.random() * 140);
          const backoff = baseBackoffMs * Math.pow(2, attempt) + jitter;
          await sleep(backoff);
          continue;
        }

        // Stop trying this model and evaluate failover
        if (!classified.allowModelFailover) {
          throw new GeminiOperationError(classified, totalAttempts, modelsTried);
        }
        break;
      }
    }
  }

  throw new GeminiOperationError(
    lastClassified || {
      kind: 'UNKNOWN',
      statusCode: 502,
      retryableSameModel: false,
      allowModelFailover: false,
      userMessage: 'AI request failed after retries.',
      rawMessage: 'AI request failed after retries.',
    },
    totalAttempts,
    modelsTried
  );
}
