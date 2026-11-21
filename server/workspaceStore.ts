import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const GUEST_COOKIE_NAME = 'phoenix_guest_sid';
export const GUEST_MAX_MISSIONS = 5;
export const GUEST_MAX_STEPS = 40;
export const GUEST_MAX_CHAT_MESSAGES = 30;
export const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ARTIFACT_BYTES = 500_000;

const ADMIN_EMAILS = new Set(['akakukoabel@gmail.com']);

const DATA_DIR = path.resolve(process.cwd(), '.phoenix-data');
const STORE_PATH = path.join(DATA_DIR, 'workspace.json');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');
const FIREBASE_CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');

export interface AuthActor {
  type: 'user' | 'guest';
  id: string;
  ownerKey: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  isAdmin: boolean;
  guestToken?: string;
  cookieNeedsSet?: boolean;
}

export interface GuestTrialInfo {
  isGuest: boolean;
  missionsUsed: number;
  missionsLimit: number;
  missionsRemaining: number;
  stepsUsed: number;
  stepsLimit: number;
  chatUsed: number;
  chatLimit: number;
  expiresAt: string;
  continuityNotice: string;
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  model?: string;
  latencyMs?: number;
  groundingSources?: Array<{ title: string; uri: string }>;
  searchGrounded?: boolean;
}

export interface StoredMission {
  id: string;
  ownerId: string;
  ownerType: 'guest' | 'user';
  title: string;
  goal: string;
  persona: string;
  executionDepth: string;
  targetDeadline: string;
  status: string;
  currentStage?: string;
  progress: number;
  currentStepId?: string;
  activeStepIds?: string[];
  lastCheckpointStepId?: string;
  understanding?: any;
  dagAnalysis?: any;
  deadlineAssessment?: any;
  performanceMetrics?: any;
  groundingSources?: Array<{ title: string; uri: string }>;
  phaseTimings?: any;
  clarificationAnswers?: Record<string, string>;
  clarificationResolved?: boolean;
  tasks: any[];
  logs: any[];
  artifacts: any[];
  report?: any;
  responseFeedback?: Record<string, any>;
  startedAt: string;
  endedAt?: string;
  elapsedMs?: number;
  executionSpeed: number;
  migratedFromGuest?: boolean;
  updatedAt: string;
}

interface GuestWorkspaceBucket {
  guestId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  missionsCreatedCount: number;
  stepsExecutedCount: number;
  migratedMissionIds: string[];
  chatMigrated?: boolean;
  missions: Record<string, StoredMission>;
  seenPlanMissionIds?: string[];
  chatHistory?: StoredChatMessage[];
}

interface UserWorkspaceBucket {
  uid: string;
  email?: string;
  displayName?: string;
  preferences?: {
    defaultPersona?: string;
    defaultDepth?: string;
    soundEnabled?: boolean;
    advancedMode?: boolean;
    animationsEnabled?: boolean;
    privacyAcceptedAt?: string;
  };
  missions: Record<string, StoredMission>;
  chatHistory?: StoredChatMessage[];
  updatedAt: string;
}

export interface FallbackLogEntry {
  id: string;
  timestamp: string;
  operation: string;
  tool?: string;
  reason: string;
  category: string;
  fallbackUsed: string;
  demoMode?: boolean;
}

interface WorkspaceDatabase {
  guests: Record<string, GuestWorkspaceBucket>;
  users: Record<string, UserWorkspaceBucket>;
  feedback: Record<string, Record<string, Record<string, any>>>;
  fallbackLogs: FallbackLogEntry[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadOrCreateSessionSecret(): string {
  if (process.env.PHOENIX_SESSION_SECRET && process.env.PHOENIX_SESSION_SECRET.length >= 32) {
    return process.env.PHOENIX_SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_PATH)) {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

const SESSION_SECRET = loadOrCreateSessionSecret();

let firebaseAdminInitialized = false;
let firebaseProjectId = '';

function initFirebaseTokenVerifier(): void {
  if (firebaseAdminInitialized) return;
  try {
    if (fs.existsSync(FIREBASE_CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));
      firebaseProjectId = cfg?.projectId || '';
    }
    if (firebaseProjectId && firebaseProjectId !== 'remixed-project-id') {
      if (!getApps().length) {
        initializeApp({ projectId: firebaseProjectId });
      } else {
        getApp();
      }
      firebaseAdminInitialized = true;
    }
  } catch (err: any) {
    console.warn('[PHOENIX AUTH] Firebase ID token verifier initialization warning:', err?.message);
  }
}

initFirebaseTokenVerifier();

function loadDb(): WorkspaceDatabase {
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return {
        guests: raw.guests || {},
        users: raw.users || {},
        feedback: raw.feedback || {},
        fallbackLogs: Array.isArray(raw.fallbackLogs) ? raw.fallbackLogs.slice(-120) : [],
      };
    } catch {
      // Recover cleanly if corrupted
    }
  }
  return { guests: {}, users: {}, feedback: {}, fallbackLogs: [] };
}

let dbState: WorkspaceDatabase = loadDb();

function persistDb(): void {
  ensureDataDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(dbState, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, STORE_PATH);
}

function pruneExpiredGuests(): void {
  const now = Date.now();
  let changed = false;
  for (const [gid, bucket] of Object.entries(dbState.guests)) {
    if (new Date(bucket.expiresAt).getTime() <= now) {
      delete dbState.guests[gid];
      delete dbState.feedback[`guest:${gid}`];
      changed = true;
    }
  }
  if (changed) persistDb();
}

export function signGuestId(guestId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(guestId).digest('hex');
  return `${guestId}.${sig}`;
}

export function verifySignedGuestToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [guestId, sig] = parts;
  if (!/^guest_[a-f0-9]{32}$/.test(guestId) || !/^[a-f0-9]{64}$/.test(sig)) {
    return null;
  }
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(guestId).digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? guestId : null;
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function getOrCreateGuestBucket(guestId: string): GuestWorkspaceBucket {
  pruneExpiredGuests();
  const existing = dbState.guests[guestId];
  if (existing) {
    existing.lastActiveAt = new Date().toISOString();
    return existing;
  }
  const now = new Date();
  const created: GuestWorkspaceBucket = {
    guestId,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + GUEST_SESSION_TTL_MS).toISOString(),
    missionsCreatedCount: 0,
    stepsExecutedCount: 0,
    migratedMissionIds: [],
    missions: {},
  };
  dbState.guests[guestId] = created;
  persistDb();
  return created;
}

function getOrCreateUserBucket(uid: string, email?: string, displayName?: string): UserWorkspaceBucket {
  const existing = dbState.users[uid];
  if (existing) {
    if (email) existing.email = email;
    if (displayName) existing.displayName = displayName;
    return existing;
  }
  const created: UserWorkspaceBucket = {
    uid,
    email,
    displayName,
    preferences: {
      defaultPersona: 'Apex Growth',
      defaultDepth: 'Standard DAG',
      soundEnabled: true,
    },
    missions: {},
    updatedAt: new Date().toISOString(),
  };
  dbState.users[uid] = created;
  persistDb();
  return created;
}

export async function verifyFirebaseBearerToken(authHeader: string | undefined): Promise<{
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  isAdmin: boolean;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  initFirebaseTokenVerifier();
  if (!firebaseAdminInitialized) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email ? decoded.email.toLowerCase() : undefined;
    const emailVerified = Boolean(decoded.email_verified);
    const isAdmin = Boolean(emailVerified && email && ADMIN_EMAILS.has(email));
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified,
      displayName: decoded.name || decoded.email?.split('@')[0] || 'Operator',
      isAdmin,
    };
  } catch {
    return null;
  }
}

export function setGuestCookie(res: Response, signedToken: string, req?: Request): void {
  const isHttps = Boolean(
    req && (req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase().includes('https'))
  );
  const parts = [
    `${GUEST_COOKIE_NAME}=${encodeURIComponent(signedToken)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'Secure' : null,
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    isHttps ? 'Partitioned' : null,
    `Max-Age=${Math.floor(GUEST_SESSION_TTL_MS / 1000)}`,
  ].filter(Boolean);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function verifyMutationOrigin(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  const hasBearer = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
  const hasGuestHeader = Boolean(req.headers['x-phoenix-guest-token']);
  if (hasBearer || hasGuestHeader) {
    return true;
  }
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  if (!host) return true;
  try {
    const parsed = new URL(origin);
    const originHost = parsed.host.toLowerCase();
    const originHostname = parsed.hostname.toLowerCase();
    const expectedHostname = host.split(':')[0];
    return originHost === host || originHostname === expectedHostname;
  } catch {
    return false;
  }
}

export async function resolveActor(req: Request, res: Response): Promise<AuthActor> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const verified = await verifyFirebaseBearerToken(authHeader);
    if (verified) {
      getOrCreateUserBucket(verified.uid, verified.email, verified.displayName);
      // Also inspect if caller holds a valid guest token for migration inspection
      const cookies = parseCookieHeader(req.headers.cookie);
      const headerGuest = req.headers['x-phoenix-guest-token'] as string | undefined;
      const guestId =
        verifySignedGuestToken(cookies[GUEST_COOKIE_NAME]) ||
        verifySignedGuestToken(headerGuest);
      return {
        type: 'user',
        id: verified.uid,
        ownerKey: `user:${verified.uid}`,
        email: verified.email,
        emailVerified: verified.emailVerified,
        displayName: verified.displayName,
        isAdmin: verified.isAdmin,
        guestToken: guestId ? signGuestId(guestId) : undefined,
      };
    }
    // Invalid Bearer token — throw explicit marker so protected endpoints return 401
    const err: any = new Error('Invalid or expired authentication token.');
    err.statusCode = 401;
    throw err;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const headerGuest = req.headers['x-phoenix-guest-token'] as string | undefined;
  const existingGuestId =
    verifySignedGuestToken(cookies[GUEST_COOKIE_NAME]) ||
    verifySignedGuestToken(headerGuest);

  if (existingGuestId) {
    getOrCreateGuestBucket(existingGuestId);
    const signed = signGuestId(existingGuestId);
    if (!cookies[GUEST_COOKIE_NAME]) {
      setGuestCookie(res, signed, req);
    }
    return {
      type: 'guest',
      id: existingGuestId,
      ownerKey: `guest:${existingGuestId}`,
      isAdmin: false,
      guestToken: signed,
    };
  }

  const newGuestId = `guest_${crypto.randomBytes(16).toString('hex')}`;
  const signed = signGuestId(newGuestId);
  getOrCreateGuestBucket(newGuestId);
  setGuestCookie(res, signed, req);
  return {
    type: 'guest',
    id: newGuestId,
    ownerKey: `guest:${newGuestId}`,
    isAdmin: false,
    guestToken: signed,
    cookieNeedsSet: true,
  };
}

export function rotateGuestSession(res: Response, req?: Request): AuthActor {
  const newGuestId = `guest_${crypto.randomBytes(16).toString('hex')}`;
  const signed = signGuestId(newGuestId);
  getOrCreateGuestBucket(newGuestId);
  setGuestCookie(res, signed, req);
  return {
    type: 'guest',
    id: newGuestId,
    ownerKey: `guest:${newGuestId}`,
    isAdmin: false,
    guestToken: signed,
    cookieNeedsSet: true,
  };
}

export function getGuestTrialStatus(guestId: string): GuestTrialInfo {
  const bucket = getOrCreateGuestBucket(guestId);
  const used = bucket.missionsCreatedCount;
  const remaining = Math.max(0, GUEST_MAX_MISSIONS - used);
  const chatUsed = Math.floor((bucket.chatHistory?.length || 0) / 2);
  return {
    isGuest: true,
    missionsUsed: used,
    missionsLimit: GUEST_MAX_MISSIONS,
    missionsRemaining: remaining,
    stepsUsed: bucket.stepsExecutedCount,
    stepsLimit: GUEST_MAX_STEPS,
    chatUsed,
    chatLimit: GUEST_MAX_CHAT_MESSAGES,
    expiresAt: bucket.expiresAt,
    continuityNotice:
      'Guest sessions provide temporary continuity in this browser only and expire after 24 hours or when browser data is cleared. Create a free account to save and resume across devices.',
  };
}

export function checkAndRecordGuestPlanUsage(
  actor: AuthActor,
  existingMissionId?: string
): { allowed: boolean; error?: string; trial?: GuestTrialInfo } {
  if (actor.type !== 'guest') return { allowed: true };
  const bucket = getOrCreateGuestBucket(actor.id);
  // Re-planning an already tracked mission (clarification answers or retries) does not burn extra mission quota
  if (
    existingMissionId &&
    (bucket.missions[existingMissionId] ||
      (Array.isArray(bucket.seenPlanMissionIds) &&
        bucket.seenPlanMissionIds.includes(existingMissionId)))
  ) {
    return { allowed: true, trial: getGuestTrialStatus(actor.id) };
  }
  if (bucket.missionsCreatedCount >= GUEST_MAX_MISSIONS) {
    return {
      allowed: false,
      error: `Free guest trial limit reached (${GUEST_MAX_MISSIONS} of ${GUEST_MAX_MISSIONS} missions used). Create a free PHOENIX account to continue with unlimited private workspace storage.`,
      trial: getGuestTrialStatus(actor.id),
    };
  }
  if (existingMissionId) {
    if (!Array.isArray(bucket.seenPlanMissionIds)) {
      bucket.seenPlanMissionIds = [];
    }
    bucket.seenPlanMissionIds.push(existingMissionId);
  }
  bucket.missionsCreatedCount += 1;
  bucket.lastActiveAt = new Date().toISOString();
  persistDb();
  return { allowed: true, trial: getGuestTrialStatus(actor.id) };
}

export function checkAndRecordGuestStepUsage(actor: AuthActor): {
  allowed: boolean;
  error?: string;
  trial?: GuestTrialInfo;
} {
  if (actor.type !== 'guest') return { allowed: true };
  const bucket = getOrCreateGuestBucket(actor.id);
  if (bucket.stepsExecutedCount >= GUEST_MAX_STEPS) {
    return {
      allowed: false,
      error: `Guest trial execution step limit reached (${GUEST_MAX_STEPS} steps). Sign in or create a free account to continue executing missions.`,
      trial: getGuestTrialStatus(actor.id),
    };
  }
  bucket.stepsExecutedCount += 1;
  bucket.lastActiveAt = new Date().toISOString();
  persistDb();
  return { allowed: true, trial: getGuestTrialStatus(actor.id) };
}

export function checkAndRecordGuestChatUsage(actor: AuthActor): {
  allowed: boolean;
  error?: string;
  trial?: GuestTrialInfo;
} {
  if (actor.type !== 'guest') return { allowed: true };
  const trial = getGuestTrialStatus(actor.id);
  if (trial.chatUsed >= GUEST_MAX_CHAT_MESSAGES) {
    return {
      allowed: false,
      error: `Free guest AI Chat limit reached (${GUEST_MAX_CHAT_MESSAGES} messages). Create a free PHOENIX account to continue with unlimited private chat.`,
      trial,
    };
  }
  return { allowed: true, trial };
}

function findMissionOwnerOutsideActor(
  missionId: string,
  actorOwnerKey: string
): string | null {
  for (const [gid, bucket] of Object.entries(dbState.guests)) {
    if (`guest:${gid}` !== actorOwnerKey && bucket.missions[missionId]) {
      return `guest:${gid}`;
    }
  }
  for (const [uid, bucket] of Object.entries(dbState.users)) {
    if (`user:${uid}` !== actorOwnerKey && bucket.missions[missionId]) {
      return `user:${uid}`;
    }
  }
  return null;
}

export function listWorkspaceMissions(actor: AuthActor): StoredMission[] {
  if (actor.type === 'guest') {
    const bucket = getOrCreateGuestBucket(actor.id);
    return Object.values(bucket.missions).sort(
      (a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime()
    );
  }
  const bucket = getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  return Object.values(bucket.missions).sort(
    (a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime()
  );
}

export function getWorkspaceMission(
  actor: AuthActor,
  missionId: string
): { status: number; mission?: StoredMission; error?: string } {
  if (!missionId || !/^[a-zA-Z0-9_\-]+$/.test(missionId)) {
    return { status: 400, error: 'Invalid mission ID format.' };
  }
  const bucket =
    actor.type === 'guest'
      ? getOrCreateGuestBucket(actor.id)
      : getOrCreateUserBucket(actor.id, actor.email, actor.displayName);

  const ownMission = bucket.missions[missionId];
  if (ownMission) {
    return { status: 200, mission: ownMission };
  }

  const foreignOwner = findMissionOwnerOutsideActor(missionId, actor.ownerKey);
  if (foreignOwner) {
    return {
      status: 403,
      error: 'Access denied: this mission belongs to another workspace.',
    };
  }
  return { status: 404, error: 'Mission not found in your workspace.' };
}

export function getWorkspaceMissionFile(
  actor: AuthActor,
  missionId: string,
  fileId: string
): { status: number; file?: any; error?: string } {
  const missionLookup = getWorkspaceMission(actor, missionId);
  if (missionLookup.status !== 200 || !missionLookup.mission) {
    return { status: missionLookup.status, error: missionLookup.error };
  }
  const found = (missionLookup.mission.artifacts || []).find(
    (a: any) => a.id === fileId || a.name === fileId
  );
  if (!found) {
    return { status: 404, error: 'File not found in mission workspace.' };
  }
  return { status: 200, file: found };
}

export function upsertWorkspaceMission(
  actor: AuthActor,
  incomingMission: any
): { status: number; mission?: StoredMission; error?: string } {
  if (!incomingMission || typeof incomingMission !== 'object') {
    return { status: 400, error: 'Valid mission payload is required.' };
  }
  const missionId = String(incomingMission.id || '').trim();
  if (!missionId || !/^[a-zA-Z0-9_\-]+$/.test(missionId) || missionId.length > 128) {
    return { status: 400, error: 'Invalid mission ID.' };
  }

  // Strictly block ID hijacking across workspaces
  const foreignOwner = findMissionOwnerOutsideActor(missionId, actor.ownerKey);
  if (foreignOwner) {
    return {
      status: 403,
      error: 'Access denied: cannot overwrite or claim a mission belonging to another workspace.',
    };
  }

  const artifacts = Array.isArray(incomingMission.artifacts)
    ? incomingMission.artifacts.slice(0, 30).map((a: any) => ({
        ...a,
        content: typeof a.content === 'string' ? a.content.slice(0, MAX_ARTIFACT_BYTES) : '',
      }))
    : [];

  const sanitized: StoredMission = {
    id: missionId,
    ownerId: actor.id,
    ownerType: actor.type,
    title: String(incomingMission.title || 'Untitled Mission').slice(0, 200),
    goal: String(incomingMission.goal || '').slice(0, 4000),
    persona: String(incomingMission.persona || 'Apex Growth').slice(0, 64),
    executionDepth: String(incomingMission.executionDepth || 'Standard DAG').slice(0, 64),
    targetDeadline: String(incomingMission.targetDeadline || 'Immediate / Real-time').slice(0, 64),
    status: String(incomingMission.status || 'idle').slice(0, 32),
    currentStage: incomingMission.currentStage ? String(incomingMission.currentStage).slice(0, 32) : undefined,
    progress: Number.isFinite(Number(incomingMission.progress))
      ? Math.max(0, Math.min(100, Number(incomingMission.progress)))
      : 0,
    currentStepId: incomingMission.currentStepId ? String(incomingMission.currentStepId).slice(0, 128) : undefined,
    activeStepIds: Array.isArray(incomingMission.activeStepIds)
      ? incomingMission.activeStepIds.slice(0, 20).map((s: any) => String(s).slice(0, 128))
      : undefined,
    lastCheckpointStepId: incomingMission.lastCheckpointStepId
      ? String(incomingMission.lastCheckpointStepId).slice(0, 128)
      : undefined,
    understanding: incomingMission.understanding,
    dagAnalysis: incomingMission.dagAnalysis,
    deadlineAssessment: incomingMission.deadlineAssessment,
    performanceMetrics: incomingMission.performanceMetrics,
    groundingSources: Array.isArray(incomingMission.groundingSources)
      ? incomingMission.groundingSources.slice(0, 30)
      : undefined,
    phaseTimings: incomingMission.phaseTimings,
    clarificationAnswers: incomingMission.clarificationAnswers,
    clarificationResolved: Boolean(incomingMission.clarificationResolved),
    tasks: Array.isArray(incomingMission.tasks) ? incomingMission.tasks.slice(0, 20) : [],
    logs: Array.isArray(incomingMission.logs) ? incomingMission.logs.slice(-250) : [],
    artifacts,
    report: incomingMission.report,
    responseFeedback: incomingMission.responseFeedback,
    startedAt: String(incomingMission.startedAt || new Date().toISOString()).slice(0, 40),
    endedAt: incomingMission.endedAt ? String(incomingMission.endedAt).slice(0, 40) : undefined,
    elapsedMs: Number.isFinite(Number(incomingMission.elapsedMs)) ? Number(incomingMission.elapsedMs) : undefined,
    executionSpeed: Number.isFinite(Number(incomingMission.executionSpeed))
      ? Math.max(1, Math.min(4, Number(incomingMission.executionSpeed)))
      : 1,
    migratedFromGuest: Boolean(incomingMission.migratedFromGuest),
    updatedAt: new Date().toISOString(),
  };

  if (actor.type === 'guest') {
    const bucket = getOrCreateGuestBucket(actor.id);
    bucket.missions[missionId] = sanitized;
    bucket.lastActiveAt = new Date().toISOString();
  } else {
    const bucket = getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
    bucket.missions[missionId] = sanitized;
    bucket.updatedAt = new Date().toISOString();
  }
  persistDb();
  return { status: 200, mission: sanitized };
}

export function deleteWorkspaceMission(
  actor: AuthActor,
  missionId: string
): { status: number; deleted?: boolean; error?: string } {
  if (!missionId || !/^[a-zA-Z0-9_\-]+$/.test(missionId)) {
    return { status: 400, error: 'Invalid mission ID.' };
  }
  const bucket =
    actor.type === 'guest'
      ? getOrCreateGuestBucket(actor.id)
      : getOrCreateUserBucket(actor.id, actor.email, actor.displayName);

  if (bucket.missions[missionId]) {
    delete bucket.missions[missionId];
    persistDb();
    return { status: 200, deleted: true };
  }

  const foreignOwner = findMissionOwnerOutsideActor(missionId, actor.ownerKey);
  if (foreignOwner) {
    return {
      status: 403,
      error: 'Access denied: cannot delete a mission owned by another workspace.',
    };
  }
  return { status: 404, error: 'Mission not found.' };
}

export function getEligibleGuestMissions(guestToken: string | undefined): StoredMission[] {
  const guestId = verifySignedGuestToken(guestToken);
  if (!guestId) return [];
  const bucket = dbState.guests[guestId];
  if (!bucket) return [];
  const migratedSet = new Set(bucket.migratedMissionIds || []);
  return Object.values(bucket.missions).filter((m) => !migratedSet.has(m.id));
}

export function getEligibleGuestChatCount(guestToken: string | undefined): number {
  const guestId = verifySignedGuestToken(guestToken);
  if (!guestId) return 0;
  const bucket = dbState.guests[guestId];
  if (!bucket || bucket.chatMigrated) return 0;
  return Array.isArray(bucket.chatHistory) ? bucket.chatHistory.length : 0;
}

export function migrateGuestMissionsToUser(
  actor: AuthActor,
  guestToken: string | undefined,
  confirmed: boolean,
  selectedMissionIds?: string[],
  options?: { includeChat?: boolean; deferCleanup?: boolean }
): {
  status: number;
  migratedMissions?: StoredMission[];
  skippedDuplicates?: string[];
  migratedChatCount?: number;
  migratedChatIds?: string[];
  error?: string;
} {
  if (actor.type !== 'user') {
    return { status: 401, error: 'You must be signed in to transfer guest work to an account.' };
  }
  if (!confirmed) {
    return { status: 400, error: 'Explicit user confirmation is required before migrating guest work.' };
  }
  const guestId = verifySignedGuestToken(guestToken);
  if (!guestId) {
    return { status: 400, error: 'No active guest session found to migrate.' };
  }
  const guestBucket = dbState.guests[guestId];
  if (!guestBucket) {
    return { status: 404, error: 'Guest session has expired or contains no records.' };
  }

  const userBucket = getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  const prevUserMissions = { ...userBucket.missions };
  const prevUserChat = userBucket.chatHistory ? [...userBucket.chatHistory] : undefined;
  const prevGuestMissions = { ...guestBucket.missions };
  const prevGuestMigrated = [...(guestBucket.migratedMissionIds || [])];
  const prevGuestChatMigrated = guestBucket.chatMigrated;

  try {
    const alreadyMigrated = new Set(guestBucket.migratedMissionIds || []);
    const migratedMissions: StoredMission[] = [];
    const skippedDuplicates: string[] = [];

    for (const mission of Object.values(guestBucket.missions)) {
      if (selectedMissionIds && selectedMissionIds.length > 0 && !selectedMissionIds.includes(mission.id)) {
        continue;
      }
      if (alreadyMigrated.has(mission.id) || userBucket.missions[mission.id]) {
        skippedDuplicates.push(mission.id);
        alreadyMigrated.add(mission.id);
        continue;
      }
      const transferred: StoredMission = {
        ...mission,
        ownerId: actor.id,
        ownerType: 'user',
        migratedFromGuest: true,
        updatedAt: new Date().toISOString(),
      };
      userBucket.missions[transferred.id] = transferred;
      migratedMissions.push(transferred);
    }

    let migratedChatCount = 0;
    const migratedChatIds: string[] = [];
    const includeChat = options?.includeChat !== false;
    if (includeChat && !guestBucket.chatMigrated && Array.isArray(guestBucket.chatHistory) && guestBucket.chatHistory.length > 0) {
      const existingChat = Array.isArray(userBucket.chatHistory) ? userBucket.chatHistory : [];
      const existingChatIds = new Set(existingChat.map((c) => c.id));
      const newChatMsgs = guestBucket.chatHistory.filter((c) => !existingChatIds.has(c.id));
      for (const c of newChatMsgs) {
        migratedChatIds.push(c.id);
      }
      if (newChatMsgs.length > 0) {
        userBucket.chatHistory = [...existingChat, ...newChatMsgs].slice(-60);
        migratedChatCount = newChatMsgs.length;
      }
    }

    if (!options?.deferCleanup) {
      for (const m of migratedMissions) {
        alreadyMigrated.add(m.id);
        delete guestBucket.missions[m.id];
      }
      for (const dupId of skippedDuplicates) {
        alreadyMigrated.add(dupId);
      }
      guestBucket.migratedMissionIds = Array.from(alreadyMigrated);
      if (includeChat && guestBucket.chatHistory?.length) {
        guestBucket.chatMigrated = true;
        guestBucket.chatHistory = [];
      }
    }

    userBucket.updatedAt = new Date().toISOString();
    persistDb();

    return {
      status: 200,
      migratedMissions,
      skippedDuplicates,
      migratedChatCount,
      migratedChatIds,
    };
  } catch (err: any) {
    // Atomic rollback: preserve both guest and user buckets untouched on failure
    userBucket.missions = prevUserMissions;
    userBucket.chatHistory = prevUserChat;
    guestBucket.missions = prevGuestMissions;
    guestBucket.migratedMissionIds = prevGuestMigrated;
    guestBucket.chatMigrated = prevGuestChatMigrated;
    return {
      status: 500,
      error: err?.message || 'Migration failed; guest session preserved intact.',
    };
  }
}

export function finalizeGuestMigration(
  actor: AuthActor,
  guestToken: string | undefined,
  migratedMissionIds: string[],
  includeChat: boolean
): void {
  if (actor.type !== 'user') return;
  const guestId = verifySignedGuestToken(guestToken);
  if (!guestId || !dbState.guests[guestId]) return;
  const guestBucket = dbState.guests[guestId];
  const alreadyMigrated = new Set(guestBucket.migratedMissionIds || []);
  for (const id of migratedMissionIds) {
    alreadyMigrated.add(id);
    delete guestBucket.missions[id];
  }
  guestBucket.migratedMissionIds = Array.from(alreadyMigrated);
  if (includeChat) {
    guestBucket.chatMigrated = true;
    guestBucket.chatHistory = [];
  }
  persistDb();
}

export function rollbackGuestMigration(
  actor: AuthActor,
  migratedMissionIds: string[],
  migratedChatIds?: string[]
): void {
  if (actor.type !== 'user') return;
  const userBucket = dbState.users[actor.id];
  if (!userBucket) return;
  for (const id of migratedMissionIds) {
    if (userBucket.missions[id]?.migratedFromGuest) {
      delete userBucket.missions[id];
    }
  }
  if (Array.isArray(migratedChatIds) && migratedChatIds.length > 0 && Array.isArray(userBucket.chatHistory)) {
    const removeSet = new Set(migratedChatIds);
    userBucket.chatHistory = userBucket.chatHistory.filter((c) => !removeSet.has(c.id));
  }
  userBucket.updatedAt = new Date().toISOString();
  persistDb();
}

export function discardGuestMissions(guestToken: string | undefined): void {
  const guestId = verifySignedGuestToken(guestToken);
  if (!guestId || !dbState.guests[guestId]) return;
  dbState.guests[guestId].missions = {};
  dbState.guests[guestId].chatHistory = [];
  dbState.guests[guestId].chatMigrated = true;
  persistDb();
}

export function getUserPreferences(actor: AuthActor): {
  defaultPersona: string;
  defaultDepth: string;
  soundEnabled: boolean;
  advancedMode: boolean;
  animationsEnabled: boolean;
  privacyAcceptedAt?: string;
} | null {
  if (actor.type !== 'user') return null;
  const bucket = getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  return {
    defaultPersona: bucket.preferences?.defaultPersona || 'Apex Growth',
    defaultDepth: bucket.preferences?.defaultDepth || 'Standard DAG',
    soundEnabled: typeof bucket.preferences?.soundEnabled === 'boolean' ? bucket.preferences.soundEnabled : true,
    advancedMode: typeof bucket.preferences?.advancedMode === 'boolean' ? bucket.preferences.advancedMode : false,
    animationsEnabled: typeof bucket.preferences?.animationsEnabled === 'boolean' ? bucket.preferences.animationsEnabled : true,
    privacyAcceptedAt: bucket.preferences?.privacyAcceptedAt,
  };
}

export function updateUserBackendPreferences(
  actor: AuthActor,
  prefs: {
    defaultPersona?: string;
    defaultDepth?: string;
    soundEnabled?: boolean;
    advancedMode?: boolean;
    animationsEnabled?: boolean;
    privacyAcceptedAt?: string;
  }
): {
  status: number;
  preferences?: {
    defaultPersona: string;
    defaultDepth: string;
    soundEnabled: boolean;
    advancedMode: boolean;
    animationsEnabled: boolean;
    privacyAcceptedAt?: string;
  };
  error?: string;
} {
  if (actor.type !== 'user') {
    return { status: 401, error: 'Authentication required to store workspace preferences.' };
  }
  const bucket = getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  const nextPrefs = {
    defaultPersona:
      typeof prefs.defaultPersona === 'string' && prefs.defaultPersona.trim()
        ? prefs.defaultPersona.trim().slice(0, 64)
        : bucket.preferences?.defaultPersona || 'Apex Growth',
    defaultDepth:
      typeof prefs.defaultDepth === 'string' && prefs.defaultDepth.trim()
        ? prefs.defaultDepth.trim().slice(0, 64)
        : bucket.preferences?.defaultDepth || 'Standard DAG',
    soundEnabled:
      typeof prefs.soundEnabled === 'boolean'
        ? prefs.soundEnabled
        : typeof bucket.preferences?.soundEnabled === 'boolean'
        ? bucket.preferences.soundEnabled
        : true,
    advancedMode:
      typeof prefs.advancedMode === 'boolean'
        ? prefs.advancedMode
        : typeof bucket.preferences?.advancedMode === 'boolean'
        ? bucket.preferences.advancedMode
        : false,
    animationsEnabled:
      typeof prefs.animationsEnabled === 'boolean'
        ? prefs.animationsEnabled
        : typeof bucket.preferences?.animationsEnabled === 'boolean'
        ? bucket.preferences.animationsEnabled
        : true,
    privacyAcceptedAt:
      typeof prefs.privacyAcceptedAt === 'string'
        ? prefs.privacyAcceptedAt.slice(0, 40)
        : bucket.preferences?.privacyAcceptedAt,
  };
  bucket.preferences = nextPrefs;
  bucket.updatedAt = new Date().toISOString();
  persistDb();
  return {
    status: 200,
    preferences: {
      defaultPersona: nextPrefs.defaultPersona,
      defaultDepth: nextPrefs.defaultDepth,
      soundEnabled: Boolean(nextPrefs.soundEnabled),
      advancedMode: Boolean(nextPrefs.advancedMode),
      animationsEnabled: Boolean(nextPrefs.animationsEnabled),
      privacyAcceptedAt: nextPrefs.privacyAcceptedAt,
    },
  };
}

export function saveActorFeedback(
  actor: AuthActor,
  missionId: string,
  responseId: string,
  rating: 'up' | 'down' | null,
  label?: string,
  snippet?: string
): { status: number; summary?: any; entries?: any; error?: string } {
  if (!missionId || !/^[a-zA-Z0-9_\-]+$/.test(missionId)) {
    return { status: 400, error: 'Invalid mission ID.' };
  }
  const foreignOwner = findMissionOwnerOutsideActor(missionId, actor.ownerKey);
  if (foreignOwner) {
    return { status: 403, error: 'Access denied: cannot modify feedback on another workspace mission.' };
  }
  if (!dbState.feedback[actor.ownerKey]) {
    dbState.feedback[actor.ownerKey] = {};
  }
  if (!dbState.feedback[actor.ownerKey][missionId]) {
    dbState.feedback[actor.ownerKey][missionId] = {};
  }
  const missionMap = dbState.feedback[actor.ownerKey][missionId];
  if (rating === null || rating === undefined) {
    delete missionMap[responseId];
  } else {
    missionMap[responseId] = {
      missionId,
      responseId,
      rating,
      label: label || 'AI Response',
      snippet: typeof snippet === 'string' ? snippet.slice(0, 140) : '',
      timestamp: new Date().toISOString(),
    };
  }
  persistDb();
  const entries = Object.values(missionMap);
  return {
    status: 200,
    summary: {
      total: entries.length,
      likes: entries.filter((e: any) => e.rating === 'up').length,
      dislikes: entries.filter((e: any) => e.rating === 'down').length,
    },
    entries: missionMap,
  };
}

export function getActorFeedback(
  actor: AuthActor,
  missionId: string
): { status: number; summary?: any; entries?: any; error?: string } {
  const foreignOwner = findMissionOwnerOutsideActor(missionId, actor.ownerKey);
  if (foreignOwner) {
    return { status: 403, error: 'Access denied: cannot inspect feedback on another workspace mission.' };
  }
  const missionMap = dbState.feedback[actor.ownerKey]?.[missionId] || {};
  const entries = Object.values(missionMap);
  return {
    status: 200,
    summary: {
      total: entries.length,
      likes: entries.filter((e: any) => e.rating === 'up').length,
      dislikes: entries.filter((e: any) => e.rating === 'down').length,
    },
    entries: missionMap,
  };
}

export function recordFallbackEvent(entry: {
  operation: string;
  tool?: string;
  reason: string;
  category: string;
  fallbackUsed: string;
  demoMode?: boolean;
}): void {
  try {
    if (!Array.isArray(dbState.fallbackLogs)) {
      dbState.fallbackLogs = [];
    }
    const cleanReason = String(entry.reason || 'External service unavailable').slice(0, 260);
    const nextEntry: FallbackLogEntry = {
      id: `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      operation: String(entry.operation || 'unknown').slice(0, 80),
      tool: entry.tool ? String(entry.tool).slice(0, 60) : undefined,
      reason: cleanReason,
      category: String(entry.category || 'FALLBACK').slice(0, 48),
      fallbackUsed: String(entry.fallbackUsed || 'Deterministic Local Synthesizer').slice(0, 140),
      demoMode: entry.demoMode ? true : undefined,
    };
    dbState.fallbackLogs = [...dbState.fallbackLogs, nextEntry].slice(-120);
    persistDb();
  } catch (err: any) {
    console.warn('[PHOENIX ADMIN LOG] Could not persist fallback event:', err?.message);
  }
}

export function getAdminAggregateOverview(): {
  activeGuestSessions: number;
  registeredWorkspaces: number;
  totalGuestMissions: number;
  totalUserMissions: number;
  statusBreakdown: Record<string, number>;
  fallbackCount: number;
  fallbackEvents: FallbackLogEntry[];
  privacyGuarantee: string;
} {
  pruneExpiredGuests();
  const statusBreakdown: Record<string, number> = {};
  let totalGuestMissions = 0;
  let totalUserMissions = 0;

  for (const g of Object.values(dbState.guests)) {
    for (const m of Object.values(g.missions)) {
      totalGuestMissions += 1;
      statusBreakdown[m.status] = (statusBreakdown[m.status] || 0) + 1;
    }
  }
  for (const u of Object.values(dbState.users)) {
    for (const m of Object.values(u.missions)) {
      totalUserMissions += 1;
      statusBreakdown[m.status] = (statusBreakdown[m.status] || 0) + 1;
    }
  }

  const allFallbacks = Array.isArray(dbState.fallbackLogs) ? dbState.fallbackLogs : [];

  return {
    activeGuestSessions: Object.keys(dbState.guests).length,
    registeredWorkspaces: Object.keys(dbState.users).length,
    totalGuestMissions,
    totalUserMissions,
    statusBreakdown,
    fallbackCount: allFallbacks.length,
    fallbackEvents: [...allFallbacks].reverse().slice(0, 50),
    privacyGuarantee:
      'Aggregate telemetry & system fallback diagnostics only. Customer conversation prompts, deliverables, and user emails are strictly isolated and omitted.',
  };
}

export function getActorChatHistory(actor: AuthActor): StoredChatMessage[] {
  const bucket =
    actor.type === 'guest'
      ? getOrCreateGuestBucket(actor.id)
      : getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  return Array.isArray(bucket.chatHistory) ? [...bucket.chatHistory] : [];
}

export function appendActorChatMessages(
  actor: AuthActor,
  messages: StoredChatMessage[]
): StoredChatMessage[] {
  const bucket =
    actor.type === 'guest'
      ? getOrCreateGuestBucket(actor.id)
      : getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  const existing = Array.isArray(bucket.chatHistory) ? bucket.chatHistory : [];
  const next = [...existing, ...messages].slice(-60);
  bucket.chatHistory = next;
  if (actor.type === 'guest') {
    (bucket as GuestWorkspaceBucket).lastActiveAt = new Date().toISOString();
  } else {
    (bucket as UserWorkspaceBucket).updatedAt = new Date().toISOString();
  }
  persistDb();
  return [...next];
}

export function clearActorChatHistory(actor: AuthActor): void {
  const bucket =
    actor.type === 'guest'
      ? getOrCreateGuestBucket(actor.id)
      : getOrCreateUserBucket(actor.id, actor.email, actor.displayName);
  bucket.chatHistory = [];
  persistDb();
}

