import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdminAggregateOverview,
  Artifact,
  GuestTrialInfo,
  Mission,
  UserPreferences,
  WorkspaceSessionState,
} from '../types/agent';

const GUEST_TOKEN_SESSION_KEY = 'phoenix_guest_token_session';

export function getStoredGuestToken(): string | null {
  try {
    return sessionStorage.getItem(GUEST_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredGuestToken(token: string | undefined | null): void {
  try {
    if (token) {
      sessionStorage.setItem(GUEST_TOKEN_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(GUEST_TOKEN_SESSION_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

function sanitizeId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now().toString(36)}`;
}

// Recursively remove undefined keys so Firestore never rejects undefined field values
function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return input;
}

function isTransientNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as any).name || '');
  if (name === 'AbortError') return false;
  const msg = String((err as any).message || err || '').toLowerCase();
  return (
    name === 'TypeError' ||
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

function isRetryableOnNetworkFailure(url: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  if (m === 'PUT' && url.startsWith('/api/workspace/')) return true;
  if (m === 'POST' && (url === '/api/plan' || url === '/api/verify')) return true;
  return false;
}

export async function parseApiJson<T = any>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!raw) return {} as T;
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Server returned a temporary warmup page (HTTP ${res.status}). Please retry in a moment.`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Unexpected response from server (HTTP ${res.status}).`);
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
  idToken?: string | null
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  // Always attach current guest token when available so sign-in/migration can inspect pending guest work
  const guestToken = getStoredGuestToken();
  if (guestToken) {
    headers.set('x-phoenix-guest-token', guestToken);
  }

  const maxRetries = 2;
  const retryDelays = [650, 1400];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      const isProxyWarmup =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        (url.startsWith('/api/') && contentType.includes('text/html'));

      if (isProxyWarmup && attempt < maxRetries && !options.signal?.aborted) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt] || 1000));
        continue;
      }

      return res;
    } catch (err) {
      if (
        attempt < maxRetries &&
        !options.signal?.aborted &&
        isRetryableOnNetworkFailure(url, method) &&
        isTransientNetworkError(err)
      ) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt] || 1000));
        continue;
      }
      throw err;
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export async function fetchSessionState(idToken?: string | null): Promise<WorkspaceSessionState> {
  const res = await apiFetch('/api/session', { method: 'GET' }, idToken);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to inspect workspace session.');
  }
  if (data.actorType === 'guest' && data.guestToken) {
    setStoredGuestToken(data.guestToken);
  }
  return data as WorkspaceSessionState;
}

export async function resetGuestSession(): Promise<{
  guestToken: string;
  guestTrial: GuestTrialInfo;
}> {
  const res = await fetch('/api/session/reset-guest', {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to rotate guest session.');
  }
  if (data.guestToken) {
    setStoredGuestToken(data.guestToken);
  }
  return data;
}

export async function fetchBackendMissions(idToken?: string | null): Promise<{
  missions: Mission[];
  guestTrial: GuestTrialInfo | null;
}> {
  const res = await apiFetch('/api/workspace/missions', { method: 'GET' }, idToken);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to load workspace missions.');
  }
  return {
    missions: Array.isArray(data.missions) ? data.missions : [],
    guestTrial: data.guestTrial || null,
  };
}

export async function saveBackendMission(
  mission: Mission,
  idToken?: string | null
): Promise<Mission> {
  const res = await apiFetch(
    `/api/workspace/missions/${encodeURIComponent(mission.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(mission),
    },
    idToken
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to persist mission to backend workspace.');
  }
  return data.mission as Mission;
}

export async function deleteBackendMission(
  missionId: string,
  idToken?: string | null
): Promise<void> {
  const res = await apiFetch(
    `/api/workspace/missions/${encodeURIComponent(missionId)}`,
    { method: 'DELETE' },
    idToken
  );
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to delete mission.');
  }
}

export async function migrateGuestBackend(
  idToken: string,
  confirmed: boolean,
  selectedMissionIds?: string[],
  options?: { includeChat?: boolean; deferCleanup?: boolean }
): Promise<{
  migratedMissions: Mission[];
  skippedDuplicates: string[];
  migratedChatCount: number;
  migratedChatIds: string[];
}> {
  const res = await apiFetch(
    '/api/workspace/migrate-guest',
    {
      method: 'POST',
      body: JSON.stringify({
        confirmed,
        selectedMissionIds,
        includeChat: options?.includeChat !== false,
        deferCleanup: Boolean(options?.deferCleanup),
      }),
    },
    idToken
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to transfer guest workspace.');
  }
  return {
    migratedMissions: Array.isArray(data.migratedMissions) ? data.migratedMissions : [],
    skippedDuplicates: Array.isArray(data.skippedDuplicates) ? data.skippedDuplicates : [],
    migratedChatCount: Number(data.migratedChatCount) || 0,
    migratedChatIds: Array.isArray(data.migratedChatIds) ? data.migratedChatIds : [],
  };
}

export async function finalizeGuestMigrationBackend(
  idToken: string,
  migratedMissionIds: string[],
  includeChat: boolean
): Promise<void> {
  const res = await apiFetch(
    '/api/workspace/finalize-guest-migration',
    {
      method: 'POST',
      body: JSON.stringify({ migratedMissionIds, includeChat }),
    },
    idToken
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to finalize guest migration cleanup.');
  }
}

export async function rollbackGuestMigrationBackend(
  idToken: string,
  migratedMissionIds: string[],
  migratedChatIds: string[]
): Promise<void> {
  await apiFetch(
    '/api/workspace/rollback-guest-migration',
    {
      method: 'POST',
      body: JSON.stringify({ migratedMissionIds, migratedChatIds }),
    },
    idToken
  );
}

export async function saveBackendPreferences(
  idToken: string,
  prefs: UserPreferences
): Promise<UserPreferences> {
  const res = await apiFetch(
    '/api/workspace/preferences',
    {
      method: 'PUT',
      body: JSON.stringify(prefs),
    },
    idToken
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to save workspace preferences.');
  }
  return data.preferences as UserPreferences;
}

export async function discardGuestBackend(idToken: string): Promise<void> {
  const res = await apiFetch(
    '/api/workspace/discard-guest',
    { method: 'POST' },
    idToken
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to clear guest session.');
  }
}

export async function fetchAdminOverview(idToken: string): Promise<AdminAggregateOverview> {
  const res = await apiFetch('/api/admin/overview', { method: 'GET' }, idToken);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Admin access denied.');
  }
  return data as AdminAggregateOverview;
}

// =========================================================================
// CLOUD FIRESTORE PERSISTENCE (Verified Authenticated Accounts Only)
// Strict blueprint compliance with /firestore.rules
// =========================================================================

export async function ensureUserProfile(user: User): Promise<UserPreferences | null> {
  if (!user.emailVerified) return null;
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  const displayName = String(
    user.displayName || user.email?.split('@')[0] || 'Operator'
  ).slice(0, 120);
  const email = String(user.email || `${user.uid}@phoenix.local`).slice(0, 254);

  if (!snap.exists()) {
    try {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName,
        role: 'customer',
        defaultPersona: 'Apex Growth',
        defaultDepth: 'Standard DAG',
        soundEnabled: true,
        privacyAcceptedAt: new Date().toISOString().slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        defaultPersona: 'Apex Growth',
        defaultDepth: 'Standard DAG',
        soundEnabled: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, userPath);
    }
  }

  const data = snap.data() || {};
  return {
    defaultPersona: data.defaultPersona,
    defaultDepth: data.defaultDepth,
    soundEnabled: typeof data.soundEnabled === 'boolean' ? data.soundEnabled : true,
    privacyAcceptedAt: data.privacyAcceptedAt,
  };
}

export async function updateUserPreferences(
  uid: string,
  prefs: UserPreferences
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const updatePayload = stripUndefined({
    defaultPersona: prefs.defaultPersona?.slice(0, 64),
    defaultDepth: prefs.defaultDepth?.slice(0, 64),
    soundEnabled: typeof prefs.soundEnabled === 'boolean' ? prefs.soundEnabled : undefined,
    privacyAcceptedAt: prefs.privacyAcceptedAt?.slice(0, 40),
    updatedAt: serverTimestamp(),
  });
  try {
    await updateDoc(userRef, updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

export async function loadUserWorkspaceFromFirestore(uid: string): Promise<Mission[]> {
  const missionsPath = `users/${uid}/missions`;
  const missionsCol = collection(db, 'users', uid, 'missions');
  const q = query(missionsCol, where('ownerId', '==', uid));

  let missionSnaps;
  try {
    missionSnaps = await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, missionsPath);
  }

  const loaded: Mission[] = [];
  for (const mDoc of missionSnaps.docs) {
    const raw = mDoc.data();
    const filesPath = `users/${uid}/missions/${mDoc.id}/files`;
    let artifacts: Artifact[] = [];
    try {
      const filesQuery = query(collection(db, 'users', uid, 'missions', mDoc.id, 'files'), where('ownerId', '==', uid));
      const filesSnap = await getDocs(filesQuery);
      artifacts = filesSnap.docs.map((fDoc) => {
        const fd = fDoc.data();
        return {
          id: fd.id || fDoc.id,
          name: fd.name || 'deliverable.txt',
          format: fd.format || 'text',
          content: fd.content || '',
          stepId: fd.stepId,
          timestamp: fd.timestamp || new Date().toISOString(),
          isRealExecution: Boolean(fd.isRealExecution),
          validated: Boolean(fd.validated),
          validationSummary: fd.validationSummary,
        };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, filesPath);
    }

    // Rehydrate outputArtifact reference onto tasks when matched
    const artifactByStep = new Map<string, Artifact>();
    for (const art of artifacts) {
      if (art.stepId) artifactByStep.set(art.stepId, art);
    }

    const tasks = Array.isArray(raw.tasks)
      ? raw.tasks.map((t: any) => ({
          ...t,
          outputArtifact: t.outputArtifact || artifactByStep.get(t.id),
        }))
      : [];

    loaded.push({
      id: raw.id || mDoc.id,
      ownerId: raw.ownerId,
      migratedFromGuest: Boolean(raw.migratedFromGuest),
      title: raw.title || 'Untitled Mission',
      goal: raw.goal || '',
      persona: raw.persona || 'Apex Growth',
      executionDepth: raw.executionDepth || 'Standard DAG',
      targetDeadline: raw.targetDeadline || 'Immediate / Real-time',
      status: raw.status || 'idle',
      currentStage: raw.currentStage,
      progress: typeof raw.progress === 'number' ? raw.progress : 0,
      currentStepId: raw.currentStepId,
      lastCheckpointStepId: raw.lastCheckpointStepId,
      understanding: raw.understanding,
      dagAnalysis: raw.understanding?.dagAnalysis,
      deadlineAssessment: raw.report?.deadlineAssessment || raw.understanding?.deadlineAssessment,
      performanceMetrics: raw.report?.performanceMetrics,
      groundingSources: raw.report?.groundingSources,
      clarificationAnswers: raw.clarificationAnswers,
      clarificationResolved: Boolean(raw.clarificationResolved),
      tasks,
      logs: Array.isArray(raw.logs) ? raw.logs : [],
      artifacts,
      report: raw.report,
      responseFeedback: raw.responseFeedback,
      startedAt: raw.startedAt || new Date().toISOString(),
      endedAt: raw.endedAt,
      elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : undefined,
      executionSpeed: typeof raw.executionSpeed === 'number' ? raw.executionSpeed : 1,
    });
  }

  return loaded.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function trimUnderstandingForRules(
  understanding: Mission['understanding'],
  dagAnalysis?: Mission['dagAnalysis'],
  deadlineAssessment?: Mission['deadlineAssessment']
) {
  if (!understanding || typeof understanding !== 'object') return undefined;
  return stripUndefined({
    isDemoExample: understanding.isDemoExample ? true : undefined,
    exampleLabel: understanding.exampleLabel
      ? String(understanding.exampleLabel).slice(0, 64)
      : undefined,
    intendedOutcome: String(understanding.intendedOutcome || '').slice(0, 1000),
    suppliedInformation: Array.isArray(understanding.suppliedInformation)
      ? understanding.suppliedInformation.slice(0, 20)
      : undefined,
    resourceConstraints: Array.isArray(understanding.resourceConstraints)
      ? understanding.resourceConstraints.slice(0, 15)
      : [],
    missingInformation: Array.isArray(understanding.missingInformation)
      ? understanding.missingInformation.slice(0, 15)
      : [],
    contradictionsDetected: Array.isArray(understanding.contradictionsDetected)
      ? understanding.contradictionsDetected.slice(0, 10)
      : undefined,
    needsClarification: Boolean(understanding.needsClarification),
    clarifyingQuestions: Array.isArray(understanding.clarifyingQuestions)
      ? understanding.clarifyingQuestions.slice(0, 10)
      : undefined,
    strategySummary: String(understanding.strategySummary || '').slice(0, 1000),
    opportunities: Array.isArray(understanding.opportunities)
      ? understanding.opportunities.slice(0, 10)
      : [],
    risks: Array.isArray(understanding.risks) ? understanding.risks.slice(0, 10) : [],
    dagAnalysis: dagAnalysis || understanding.dagAnalysis,
    deadlineAssessment: deadlineAssessment || understanding.deadlineAssessment,
  });
}

function trimTasksForRules(tasks: Mission['tasks']) {
  return (tasks || []).slice(0, 20).map((t) =>
    stripUndefined({
      id: sanitizeId(t.id, 'step'),
      title: String(t.title || 'Task').slice(0, 200),
      phase: String(t.phase || 'Execution').slice(0, 64),
      stage: t.stage || 'EXECUTE',
      tool: String(t.tool || 'llm_reasoning').slice(0, 64),
      simulated: Boolean(t.simulated),
      toolType: t.toolType || 'SIMULATED',
      description: String(t.description || '').slice(0, 1200),
      expectedArtifact: String(t.expectedArtifact || 'output.json').slice(0, 180),
      estimatedDurationSec: Number.isFinite(Number(t.estimatedDurationSec))
        ? Number(t.estimatedDurationSec)
        : 2,
      dependencies: Array.isArray(t.dependencies) ? t.dependencies.slice(0, 10) : [],
      status: t.status || 'pending',
      waveIndex: typeof t.waveIndex === 'number' ? t.waveIndex : undefined,
      isCriticalPath: typeof t.isCriticalPath === 'boolean' ? t.isCriticalPath : undefined,
      canRunInParallel: typeof t.canRunInParallel === 'boolean' ? t.canRunInParallel : undefined,
      parallelBatchId: t.parallelBatchId ? String(t.parallelBatchId).slice(0, 64) : undefined,
      fastModelHint: t.fastModelHint ? String(t.fastModelHint).slice(0, 64) : undefined,
      reusedCachedResult: typeof t.reusedCachedResult === 'boolean' ? t.reusedCachedResult : undefined,
      requiresApproval: Boolean(t.requiresApproval),
      approvalReason: t.approvalReason ? String(t.approvalReason).slice(0, 400) : undefined,
      approvalActionType: t.approvalActionType
        ? String(t.approvalActionType).slice(0, 120)
        : undefined,
      approvalStatus: t.approvalStatus,
      executionTimeMs: typeof t.executionTimeMs === 'number' ? t.executionTimeMs : undefined,
      retryCount: typeof t.retryCount === 'number' ? t.retryCount : undefined,
      recoveryAttempts: typeof t.recoveryAttempts === 'number' ? t.recoveryAttempts : undefined,
      recoveryStrategy: t.recoveryStrategy ? String(t.recoveryStrategy).slice(0, 500) : undefined,
      error: t.error ? String(t.error).slice(0, 500) : undefined,
      reasoning: t.reasoning ? String(t.reasoning).slice(0, 2000) : undefined,
      executionBadge: t.executionBadge ? String(t.executionBadge).slice(0, 120) : undefined,
      verificationPassed:
        typeof t.verificationPassed === 'boolean' ? t.verificationPassed : undefined,
      verificationEvidence: t.verificationEvidence
        ? String(t.verificationEvidence).slice(0, 600)
        : undefined,
      groundingSources: Array.isArray(t.groundingSources) ? t.groundingSources.slice(0, 20) : undefined,
      // Omit outputArtifact.content from mission document; full deliverable is stored in /files/{fileId}
    })
  );
}

export async function saveMissionToFirestore(
  user: User,
  mission: Mission
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = user.uid;
  const missionId = sanitizeId(mission.id, 'mission');
  const missionPath = `users/${uid}/missions/${missionId}`;
  const missionRef = doc(db, 'users', uid, 'missions', missionId);

  // Ensure user profile exists before writing child mission doc (required by firestore.rules)
  await ensureUserProfile(user);

  let existingSnap;
  try {
    existingSnap = await getDoc(missionRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, missionPath);
  }

  const clampedSpeed = Math.max(1, Math.min(4, Number(mission.executionSpeed) || 1));
  const clampedProgress = Math.max(0, Math.min(100, Number(mission.progress) || 0));

  const artifactsSummary = (mission.artifacts || []).slice(0, 30).map((a) =>
    stripUndefined({
      id: sanitizeId(a.id, 'art'),
      name: String(a.name || 'artifact.txt').slice(0, 180),
      format: String(a.format || 'text').slice(0, 32),
      stepId: a.stepId ? String(a.stepId).slice(0, 128) : undefined,
      timestamp: String(a.timestamp || new Date().toISOString()).slice(0, 40),
      isRealExecution: Boolean(a.isRealExecution),
      validated: Boolean(a.validated),
    })
  );

  const boundedFeedback: Record<string, any> = {};
  if (mission.responseFeedback) {
    for (const [fk, fv] of Object.entries(mission.responseFeedback).slice(0, 40)) {
      boundedFeedback[fk] = stripUndefined(fv);
    }
  }

  const mutableFields = stripUndefined({
    title: String(mission.title || 'Untitled Mission').slice(0, 200) || 'Untitled Mission',
    status: mission.status || 'idle',
    currentStage: mission.currentStage ? String(mission.currentStage).slice(0, 32) : undefined,
    progress: clampedProgress,
    currentStepId: mission.currentStepId ? String(mission.currentStepId).slice(0, 128) : undefined,
    lastCheckpointStepId: mission.lastCheckpointStepId
      ? String(mission.lastCheckpointStepId).slice(0, 128)
      : undefined,
    understanding: trimUnderstandingForRules(
      mission.understanding,
      mission.dagAnalysis,
      mission.deadlineAssessment
    ),
    clarificationAnswers: mission.clarificationAnswers
      ? stripUndefined(
          Object.fromEntries(
            Object.entries(mission.clarificationAnswers).slice(0, 20)
          )
        )
      : undefined,
    clarificationResolved: Boolean(mission.clarificationResolved),
    tasks: trimTasksForRules(mission.tasks),
    logs: (mission.logs || []).slice(-200).map((l) =>
      stripUndefined({
        id: String(l.id || 'log').slice(0, 120),
        timestamp: String(l.timestamp || '').slice(0, 40),
        level: l.level || 'INFO',
        title: String(l.title || '').slice(0, 200),
        message: String(l.message || '').slice(0, 1200),
        stepId: l.stepId ? String(l.stepId).slice(0, 128) : undefined,
        stage: l.stage,
        simulated: typeof l.simulated === 'boolean' ? l.simulated : undefined,
        toolType: l.toolType,
      })
    ),
    artifactsSummary,
    report: mission.report
      ? stripUndefined({
          ...mission.report,
          performanceMetrics: mission.report.performanceMetrics || mission.performanceMetrics,
          deadlineAssessment: mission.report.deadlineAssessment || mission.deadlineAssessment,
          groundingSources: mission.report.groundingSources || mission.groundingSources,
        })
      : undefined,
    responseFeedback: Object.keys(boundedFeedback).length > 0 ? boundedFeedback : undefined,
    endedAt: mission.endedAt ? String(mission.endedAt).slice(0, 40) : undefined,
    elapsedMs:
      typeof mission.elapsedMs === 'number' && mission.elapsedMs >= 0
        ? mission.elapsedMs
        : undefined,
    executionSpeed: clampedSpeed,
    updatedAt: serverTimestamp(),
  });

  if (!existingSnap.exists()) {
    const createPayload = stripUndefined({
      id: missionId,
      ownerId: uid,
      goal: String(mission.goal || 'Mission').slice(0, 4000) || 'Mission',
      persona: String(mission.persona || 'Apex Growth').slice(0, 64),
      executionDepth: String(mission.executionDepth || 'Standard DAG').slice(0, 64),
      targetDeadline: String(mission.targetDeadline || 'Immediate / Real-time').slice(0, 64),
      startedAt: String(mission.startedAt || new Date().toISOString()).slice(0, 40),
      migratedFromGuest: Boolean(mission.migratedFromGuest),
      ...mutableFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await setDoc(missionRef, createPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, missionPath);
    }
  } else {
    const existingData = existingSnap.data();
    const isTerminal =
      existingData?.status === 'completed' || existingData?.status === 'cancelled';

    if (isTerminal) {
      // Respect terminal lock in firestore.rules: only responseFeedback + updatedAt can change
      try {
        await updateDoc(
          missionRef,
          stripUndefined({
            responseFeedback:
              Object.keys(boundedFeedback).length > 0 ? boundedFeedback : undefined,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, missionPath);
      }
    } else {
      try {
        await updateDoc(missionRef, mutableFields);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, missionPath);
      }
    }
  }

  // Persist deliverables cleanly inside /users/{uid}/missions/{missionId}/files/{fileId}
  for (const art of (mission.artifacts || []).slice(0, 30)) {
    const fileId = sanitizeId(art.id || art.name, 'file');
    const filePath = `${missionPath}/files/${fileId}`;
    const fileRef = doc(db, 'users', uid, 'missions', missionId, 'files', fileId);

    let fileSnap;
    try {
      fileSnap = await getDoc(fileRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, filePath);
    }

    if (!fileSnap.exists()) {
      try {
        await setDoc(
          fileRef,
          stripUndefined({
            id: fileId,
            ownerId: uid,
            missionId,
            name: String(art.name || 'deliverable.txt').slice(0, 180),
            format: String(art.format || 'text').slice(0, 32),
            content: String(art.content || '').slice(0, 500000),
            stepId: art.stepId ? String(art.stepId).slice(0, 128) : undefined,
            timestamp: String(art.timestamp || new Date().toISOString()).slice(0, 40),
            isRealExecution: Boolean(art.isRealExecution),
            validated: Boolean(art.validated),
            validationSummary: art.validationSummary
              ? String(art.validationSummary).slice(0, 2000)
              : undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, filePath);
      }
    } else {
      try {
        await updateDoc(
          fileRef,
          stripUndefined({
            content: String(art.content || '').slice(0, 500000),
            validated: Boolean(art.validated),
            validationSummary: art.validationSummary
              ? String(art.validationSummary).slice(0, 2000)
              : undefined,
            isRealExecution: Boolean(art.isRealExecution),
            timestamp: String(art.timestamp || new Date().toISOString()).slice(0, 40),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, filePath);
      }
    }
  }
}

export async function deleteMissionFromFirestore(
  user: User,
  missionId: string
): Promise<void> {
  if (!user.emailVerified) return;
  const uid = user.uid;
  const cleanId = sanitizeId(missionId, 'mission');
  const filesPath = `users/${uid}/missions/${cleanId}/files`;
  const missionPath = `users/${uid}/missions/${cleanId}`;

  try {
    const filesQuery = query(
      collection(db, 'users', uid, 'missions', cleanId, 'files'),
      where('ownerId', '==', uid)
    );
    const filesSnap = await getDocs(filesQuery);
    for (const fDoc of filesSnap.docs) {
      await deleteDoc(fDoc.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, filesPath);
  }

  try {
    await deleteDoc(doc(db, 'users', uid, 'missions', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, missionPath);
  }
}
