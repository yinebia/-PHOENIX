/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Activity, ShieldCheck } from 'lucide-react';

import {
  Mission,
  Task,
  ActivityLog,
  Artifact,
  PhoenixStage,
  ResponseFeedbackRating,
  GroundingSource,
} from './types/agent';
import { sounds } from './utils/audio';
import { speechController, SpeechState, SpeechQueueItem } from './utils/speech';
import { evaluateMissionCelebration } from './utils/celebration';
import { toFriendlyCustomerError, toFriendlyRecoveryNote } from './utils/customerMessages';
import { BRAND_CONFIG } from './config/brand';
import { useAuth } from './contexts/AuthContext';
import {
  apiFetch,
  deleteBackendMission,
  deleteMissionFromFirestore,
  fetchBackendMissions,
  loadUserWorkspaceFromFirestore,
  parseApiJson,
  saveBackendMission,
  saveMissionToFirestore,
} from './services/workspaceService';

import { Navbar } from './components/Navbar';
import { SystemNoticeBanner } from './components/SystemNoticeBanner';
import { GoalInputDashboard } from './components/GoalInputDashboard';
import { TaskPlannerView } from './components/TaskPlannerView';
import { ExecutionMonitor } from './components/ExecutionMonitor';
import { ExecutionControls } from './components/ExecutionControls';
import { ActivityLogView } from './components/ActivityLogView';
import { VerificationReportView } from './components/VerificationReportView';
import { ArtifactModal } from './components/ArtifactModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { HelpModal } from './components/HelpModal';
import { AuthAccountModal } from './components/AuthAccountModal';
import { GuestMigrationModal } from './components/GuestMigrationModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { AdminConsoleModal } from './components/AdminConsoleModal';
import { PhoenixChatPanel } from './components/PhoenixChatPanel';

const LEGACY_SHARED_STORAGE_KEY = 'phoenix_mission_history_v2';

export default function App() {
  const {
    user,
    idToken,
    authReady,
    isAdmin,
    guestTrial,
    pendingGuestMissions,
    pendingGuestChatCount,
    userPreferences,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    refreshSession,
    updateTrialInfo,
    savePreferences,
    confirmGuestMigration,
    declineGuestMigration,
  } = useAuth();

  const [missionHistory, setMissionHistory] = useState<Mission[]>([]);
  const [currentMission, setCurrentMission] = useState<Mission | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  // Always land on the welcoming conversation-first Home view
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [advancedMode, setAdvancedMode] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('phoenix_pref_advanced_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('phoenix_pref_animations');
      if (saved === 'false') return false;
    } catch {}
    return true;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [migrationDismissedForUid, setMigrationDismissedForUid] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isLoopRunning, setIsLoopRunning] = useState(false);
  const [speechState, setSpeechState] = useState<SpeechState>(() => speechController.getState());

  // References to control execution loop state and prevent multi-mission / cross-user race conditions
  const isExecutingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const activeRunIdRef = useRef(0);
  const missionRef = useRef<Mission | null>(currentMission);
  const persistQueueRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    missionRef.current = currentMission;
  }, [currentMission]);

  useEffect(() => {
    // Purge any legacy shared browser localStorage key so unrelated sessions can never leak data
    try {
      localStorage.removeItem(LEGACY_SHARED_STORAGE_KEY);
    } catch {}

    const unsubscribe = speechController.subscribe(setSpeechState);

    let mql: MediaQueryList | null = null;
    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mql.matches);
      mql.addEventListener?.('change', onMotionChange);
    }

    return () => {
      unsubscribe();
      speechController.stop();
      mql?.removeEventListener?.('change', onMotionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof userPreferences?.soundEnabled === 'boolean') {
      setSoundEnabled(userPreferences.soundEnabled);
      sounds.enabled = userPreferences.soundEnabled;
    }
    if (typeof userPreferences?.advancedMode === 'boolean') {
      setAdvancedMode(userPreferences.advancedMode);
    }
    if (typeof userPreferences?.animationsEnabled === 'boolean') {
      setAnimationsEnabled(userPreferences.animationsEnabled);
    }
  }, [userPreferences?.soundEnabled, userPreferences?.advancedMode, userPreferences?.animationsEnabled]);

  const effectiveAnimationsEnabled = animationsEnabled && !prefersReducedMotion;

  // Load workspace strictly scoped to current verified actor (never cross-pollinates across users/guests)
  const loadScopedWorkspace = useCallback(async () => {
    if (!authReady) return;
    setWorkspaceLoading(true);
    try {
      const backendData = await fetchBackendMissions(idToken);
      if (backendData.guestTrial) {
        updateTrialInfo(backendData.guestTrial);
      }

      let merged: Mission[] = backendData.missions;

      if (user && user.emailVerified) {
        try {
          const firestoreMissions = await loadUserWorkspaceFromFirestore(user.uid);
          const byId = new Map<string, Mission>();

          for (const fm of firestoreMissions) {
            byId.set(fm.id, fm);
          }
          for (const bm of backendData.missions) {
            if (!byId.has(bm.id)) {
              byId.set(bm.id, bm);
              // Backfill server-only user mission into verified Cloud Firestore
              void saveMissionToFirestore(user, bm).catch(() => {});
            } else {
              const existingFs = byId.get(bm.id)!;
              const bmCount = bm.tasks?.filter((t) => t.status === 'completed').length || 0;
              const fsCount = existingFs.tasks?.filter((t) => t.status === 'completed').length || 0;
              if (bmCount > fsCount || (bm.report && !existingFs.report)) {
                byId.set(bm.id, bm);
              }
            }
          }

          merged = Array.from(byId.values()).sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          );
        } catch (fsErr) {
          console.warn('Firestore workspace sync fell back to server-isolated workspace:', fsErr);
        }
      }

      setMissionHistory(merged);
    } catch (err) {
      console.warn('Workspace load notice:', err);
      setMissionHistory([]);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [authReady, idToken, user, updateTrialInfo]);

  // Clear active UI state cleanly on any account/guest switch before loading new scoped workspace
  useEffect(() => {
    if (!authReady) return;
    activeRunIdRef.current += 1;
    isExecutingRef.current = false;
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setIsLoopRunning(false);
    setCurrentMission(null);
    setMissionHistory([]);
    setSelectedArtifact(null);
    setActiveTab('dashboard');
    setMigrationDismissedForUid(null);
    void loadScopedWorkspace();
  }, [authReady, user?.uid, user?.emailVerified, loadScopedWorkspace]);

  // Serialized per-mission persistence to backend + verified Cloud Firestore
  const queuePersistMission = useCallback(
    (missionSnapshot: Mission) => {
      const mId = missionSnapshot.id;
      const prev = persistQueueRef.current.get(mId) || Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(async () => {
          try {
            await saveBackendMission(missionSnapshot, idToken);
          } catch (err) {
            console.warn('Backend mission persistence warning:', err);
          }
          if (user && user.emailVerified) {
            try {
              await saveMissionToFirestore(user, missionSnapshot);
            } catch (fsErr) {
              console.warn('Firestore mission persistence warning:', fsErr);
            }
          }
        });
      persistQueueRef.current.set(mId, next);
    },
    [idToken, user]
  );

  const upsertMissionHistory = (mission: Mission) => {
    setMissionHistory((prev) => [mission, ...prev.filter((m) => m.id !== mission.id)]);
  };

  const commitMissionState = (mission: Mission) => {
    const owned: Mission = {
      ...mission,
      ownerId: user?.uid || mission.ownerId,
    };
    setCurrentMission(owned);
    missionRef.current = owned;
    upsertMissionHistory(owned);
    queuePersistMission(owned);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
    if (user) {
      void savePreferences({ soundEnabled: next }).catch(() => {});
    }
  };

  const toggleAdvancedMode = () => {
    const next = !advancedMode;
    setAdvancedMode(next);
    try {
      sessionStorage.setItem('phoenix_pref_advanced_mode', String(next));
    } catch {}
    if (!next && (activeTab === 'planner' || activeTab === 'logs')) {
      setActiveTab('execution');
    }
    if (user) {
      void savePreferences({ advancedMode: next }).catch(() => {});
    }
  };

  const toggleAnimations = () => {
    const next = !animationsEnabled;
    setAnimationsEnabled(next);
    try {
      sessionStorage.setItem('phoenix_pref_animations', String(next));
    } catch {}
    if (user) {
      void savePreferences({ animationsEnabled: next }).catch(() => {});
    }
  };

  const handleConfirmMigration = async (selectedIds: string[], includeChat = true) => {
    const migrated = await confirmGuestMigration(selectedIds, includeChat);
    await loadScopedWorkspace();
    if (migrated.length > 0) {
      setCurrentMission(migrated[0]);
      setActiveTab(migrated[0].report ? 'report' : 'execution');
    }
  };

  const handleDeclineMigration = async () => {
    await declineGuestMigration();
    await loadScopedWorkspace();
  };

  const handleDeleteMission = async (missionId: string) => {
    setMissionHistory((prev) => prev.filter((m) => m.id !== missionId));
    if (currentMission?.id === missionId) {
      setCurrentMission(null);
      setActiveTab('dashboard');
    }
    try {
      await deleteBackendMission(missionId, idToken);
      if (user && user.emailVerified) {
        await deleteMissionFromFirestore(user, missionId);
      }
    } catch (err) {
      console.warn('Delete mission error:', err);
    }
  };

  const handleClearHistory = async () => {
    const idsToDelete = missionHistory.map((m) => m.id);
    setMissionHistory([]);
    setCurrentMission(null);
    setActiveTab('dashboard');
    for (const id of idsToDelete) {
      try {
        await deleteBackendMission(id, idToken);
        if (user && user.emailVerified) {
          await deleteMissionFromFirestore(user, id);
        }
      } catch (err) {
        console.warn('Clear mission archive error:', err);
      }
    }
  };

  const handleResponseFeedback = async (
    responseId: string,
    rating: ResponseFeedbackRating | null,
    label?: string,
    snippet?: string
  ) => {
    const target = missionRef.current;
    if (!target) return;

    const nextFeedback = { ...(target.responseFeedback || {}) };
    if (rating === null) {
      delete nextFeedback[responseId];
    } else {
      nextFeedback[responseId] = {
        responseId,
        missionId: target.id,
        rating,
        label,
        snippet,
        timestamp: new Date().toISOString(),
      };
    }

    commitMissionState({
      ...target,
      responseFeedback: nextFeedback,
    });

    try {
      await apiFetch(
        '/api/feedback',
        {
          method: 'POST',
          body: JSON.stringify({
            missionId: target.id,
            responseId,
            rating,
            label,
            snippet,
          }),
        },
        idToken
      );
    } catch {}
  };

  const buildMissionSpeechSequence = (mission: Mission): SpeechQueueItem[] => {
    const items: SpeechQueueItem[] = [];
    if (mission.understanding) {
      items.push({
        id: `resp-understanding-${mission.id}`,
        label: 'Stage 1 & 2 Intention Analysis',
        text: `Intended outcome: ${mission.understanding.intendedOutcome}. Strategy: ${mission.understanding.strategySummary}.`,
      });
    }
    if (mission.understanding?.clarifyingQuestions?.length) {
      items.push({
        id: `resp-clarification-${mission.id}`,
        label: 'Clarification Questions',
        text: `Missing details requested: ${mission.understanding.clarifyingQuestions.join('. ')}`,
      });
    }
    mission.tasks.forEach((task, idx) => {
      if (task.reasoning) {
        items.push({
          id: `resp-task-${task.id}`,
          label: `Step ${idx + 1}: ${task.title}`,
          text: `Step ${idx + 1}, ${task.title}. ${task.reasoning}`,
        });
      }
    });
    if (mission.report?.executiveSummary) {
      items.push({
        id: `resp-summary-${mission.id}`,
        label: 'Delivery Summary',
        text: `Delivery Report Summary: ${mission.report.executiveSummary}`,
      });
    }
    if (mission.report?.humanRecommendations?.length) {
      items.push({
        id: `resp-recommendations-${mission.id}`,
        label: 'Recommended Next Steps',
        text: `Recommended next steps: ${mission.report.humanRecommendations.join('. ')}`,
      });
    }
    return items;
  };

  const handleSpeakSingle = (responseId: string, text: string, label?: string) => {
    speechController.speakSingle({ id: responseId, text, label });
  };

  const handleSpeakAllMissionResponses = () => {
    if (!currentMission) return;
    const sequence = buildMissionSpeechSequence(currentMission);
    speechController.speakSequence(sequence);
  };

  // Internal planning & launch helper shared by initial submission and clarification resolution
  const planAndLaunchMission = async ({
    targetMission,
    clarificationAnswers,
    bypassClarification,
    demoMode,
  }: {
    targetMission: Mission;
    clarificationAnswers?: Record<string, string>;
    bypassClarification?: boolean;
    demoMode?: boolean;
  }) => {
    const isDemoMode = Boolean(demoMode || targetMission.understanding?.isDemoExample);
    setIsPlanning(true);
    try {
      const response = await apiFetch(
        '/api/plan',
        {
          method: 'POST',
          body: JSON.stringify({
            missionId: targetMission.id,
            goal: targetMission.goal,
            persona: targetMission.persona,
            executionDepth: targetMission.executionDepth,
            targetDeadline: targetMission.targetDeadline,
            clarificationAnswers,
            bypassClarification: !!bypassClarification,
            demoMode: isDemoMode,
          }),
        },
        idToken
      );

      const data = await parseApiJson(response);
      if (data.guestTrial) {
        updateTrialInfo(data.guestTrial);
      }

      if (response.status === 429 && data.code === 'GUEST_TRIAL_LIMIT_REACHED') {
        const limitMission: Mission = {
          ...targetMission,
          status: 'paused',
          logs: [
            ...targetMission.logs,
            {
              id: `log-trial-limit-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'WARN',
              stage: 'UNDERSTAND',
              title: 'Free Guest Trial Limit Reached',
              message: data.error,
            },
          ],
        };
        commitMissionState(limitMission);
        setIsPlanning(false);
        openAuthModal(data.error);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Planning request failed.');
      }

      const plan = data.plan;

      const tasks: Task[] = (plan.tasks || []).map((t: any, idx: number) => {
        const toolName = (t.tool || '').toLowerCase();
        const isReal =
          t.toolType === 'REAL' ||
          toolName === 'calculator' ||
          toolName === 'web_search' ||
          toolName === 'artifact_validator' ||
          toolName === 'verification_harness';
        const isAi = t.toolType === 'LLM_REASONING' || toolName === 'llm_reasoning';
        const requiresApproval = !!t.requiresApproval;

        return {
          ...t,
          id: t.id || `step-${idx + 1}`,
          stage: (t.stage as PhoenixStage) || 'EXECUTE',
          status: 'pending',
          toolType: isReal ? 'REAL' : isAi ? 'LLM_REASONING' : 'SIMULATED',
          simulated: !isReal && !isAi,
          requiresApproval,
          approvalStatus:
            t.approvalStatus || (requiresApproval ? 'pending_approval' : 'not_required'),
          dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
        };
      });

      const realToolCount = tasks.filter((t) => t.toolType === 'REAL').length;
      const aiStepCount = tasks.filter((t) => t.toolType === 'LLM_REASONING').length;
      const gatedCount = tasks.filter((t) => t.requiresApproval).length;

      const needsClarification =
        !isDemoMode &&
        !clarificationAnswers &&
        !bypassClarification &&
        !!plan.understanding?.needsClarification &&
        Array.isArray(plan.understanding?.clarifyingQuestions) &&
        plan.understanding.clarifyingQuestions.length > 0;

      const understandingWithMeta = plan.understanding
        ? {
            ...plan.understanding,
            isDemoExample: isDemoMode || Boolean(plan.understanding.isDemoExample),
            exampleLabel:
              plan.understanding.exampleLabel ||
              (isDemoMode ? 'Illustrative example' : undefined),
            dagAnalysis: plan.dagAnalysis || plan.understanding.dagAnalysis,
            deadlineAssessment: plan.deadlineAssessment || plan.understanding.deadlineAssessment,
          }
        : undefined;
      const planTiming = data.timing || {};
      const nextPhaseTimings = {
        understandMs: Number(planTiming.understandMs) || 0,
        planMs: Number(planTiming.planMs) || 0,
        executionMs: targetMission.phaseTimings?.executionMs || 0,
        verificationMs: targetMission.phaseTimings?.verificationMs || 0,
        recoveryMs: targetMission.phaseTimings?.recoveryMs || 0,
      };

      if (needsClarification) {
        const clarificationMission: Mission = {
          ...targetMission,
          title: plan.missionName || targetMission.title,
          status: 'awaiting_clarification',
          currentStage: 'UNDERSTAND',
          progress: 10,
          understanding: understandingWithMeta,
          dagAnalysis: plan.dagAnalysis,
          deadlineAssessment: plan.deadlineAssessment,
          phaseTimings: nextPhaseTimings,
          tasks,
          logs: [
            ...targetMission.logs,
            {
              id: `log-clarify-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'CLARIFICATION',
              stage: 'UNDERSTAND',
              title: 'Stage 1 Clarification Stop — Missing Essential Information',
              message: `PHOENIX paused before executing so business details are not invented. ${plan.understanding.clarifyingQuestions.length} question(s) requested from operator.`,
            },
          ],
        };
        sounds.playPause();
        commitMissionState(clarificationMission);
        setIsPlanning(false);
        return;
      }

      const deadlineWarnLog =
        plan.deadlineAssessment && plan.deadlineAssessment.realistic === false
          ? [
              {
                id: `log-deadline-${Date.now() + 3}`,
                timestamp: new Date().toLocaleTimeString(),
                level: 'WARN' as const,
                stage: 'STRATEGISE' as const,
                title: `Deadline Assessment: Target "${plan.deadlineAssessment.requestedDeadline}" Not Safely Achievable`,
                message: `${plan.deadlineAssessment.explanation} ${plan.deadlineAssessment.alternativePlan || ''}`.trim(),
              },
            ]
          : [];

      const plannedMission: Mission = {
        ...targetMission,
        title: plan.missionName || targetMission.title,
        status: 'executing',
        currentStage: 'EXECUTE',
        progress: 0,
        currentStepId: tasks[0]?.id,
        understanding: understandingWithMeta,
        dagAnalysis: plan.dagAnalysis,
        deadlineAssessment: plan.deadlineAssessment,
        phaseTimings: nextPhaseTimings,
        clarificationAnswers: clarificationAnswers || targetMission.clarificationAnswers,
        clarificationResolved: !!(
          clarificationAnswers ||
          bypassClarification ||
          targetMission.clarificationResolved
        ),
        tasks,
        logs: [
          ...targetMission.logs,
          ...deadlineWarnLog,
          {
            id: `log-understand-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'REASONING',
            stage: 'UNDERSTAND',
            title: 'Stage 1 — Goal & Constraints Interpreted',
            message: plan.understanding?.intendedOutcome
              ? `Intended Outcome: ${plan.understanding.intendedOutcome}`
              : `Interpreted mission objective: "${targetMission.goal}".`,
          },
          {
            id: `log-strategise-${Date.now() + 1}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            stage: 'STRATEGISE',
            title: 'Stage 2 — Execution Graph Formulated',
            message: `${tasks.length} steps planned across ${plan.dagAnalysis?.totalWaves || 1} wave(s) (max concurrency ${plan.dagAnalysis?.maxParallelism || 1}x · ${realToolCount} real backend tools, ${aiStepCount} AI synthesis steps, ${gatedCount} approval gate${gatedCount === 1 ? '' : 's'}). Strategy: ${plan.understanding?.strategySummary || plan.objectiveSummary || 'Coordinated DAG'}.`,
          },
        ],
      };

      commitMissionState(plannedMission);
      setIsPlanning(false);
      runExecutionPipeline(plannedMission, 0, 0);
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      const isNetworkDrop =
        err?.name === 'TypeError' ||
        /load failed|failed to fetch|networkerror|fetch failed/i.test(rawMsg);
      const friendlyMessage = isNetworkDrop
        ? 'Unable to reach the PHOENIX planning service (temporary connection drop). Please click Retry Planning.'
        : rawMsg || 'Unable to reach planning endpoint.';
      console.warn('Mission planning could not complete:', friendlyMessage);
      const failedPlanMission: Mission = {
        ...targetMission,
        status: 'failed',
        currentStage: 'VERIFY_RECOVER',
        logs: [
          ...targetMission.logs,
          {
            id: `log-plan-err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'ERROR',
            stage: 'UNDERSTAND',
            title: 'Mission Planning Failed',
            message: friendlyMessage,
          },
        ],
      };
      commitMissionState(failedPlanMission);
      setIsPlanning(false);
    }
  };

  // Stage 1 & 2: Immediately create a tracked Mission, understand & plan it, then execute
  const handleStartMission = async ({
    goal,
    persona,
    executionDepth,
    targetDeadline,
    demoMode,
  }: {
    goal: string;
    persona: string;
    executionDepth: string;
    targetDeadline: string;
    demoMode?: boolean;
  }) => {
    if (isPlanning) return;
    activeRunIdRef.current += 1;
    isExecutingRef.current = false;
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setIsLoopRunning(false);

    const missionId = `mission-${Date.now().toString(36)}`;
    const draftMission: Mission = {
      id: missionId,
      ownerId: user?.uid,
      title: demoMode
        ? 'Artisan Coffee Studio Launch Kit (Illustrative example)'
        : goal.length > 48
        ? `${goal.slice(0, 48)}...`
        : goal,
      goal,
      persona,
      executionDepth,
      targetDeadline,
      status: 'planning',
      currentStage: 'UNDERSTAND',
      progress: 5,
      understanding: demoMode
        ? {
            isDemoExample: true,
            exampleLabel: 'Illustrative example',
            intendedOutcome: goal,
            resourceConstraints: [],
            missingInformation: [],
            strategySummary: '',
            opportunities: [],
            risks: [],
          }
        : undefined,
      tasks: [],
      logs: [
        {
          id: `log-submit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'INFO',
          stage: 'UNDERSTAND',
          title: demoMode ? 'Illustrative Demo Mission Submitted' : 'Mission Submitted',
          message: `Received goal: "${goal}". Focus: ${persona}.`,
        },
      ],
      artifacts: [],
      startedAt: new Date().toISOString(),
      elapsedMs: 0,
      executionSpeed: 1,
    };

    commitMissionState(draftMission);
    setActiveTab('execution');
    sounds.playStepStart();

    await planAndLaunchMission({ targetMission: draftMission, demoMode });
  };

  const handleSubmitClarifications = async (answers: Record<string, string>) => {
    if (!currentMission || isPlanning) return;

    const answeredEntries = Object.entries(answers).filter(([, v]) => v.trim().length > 0);
    if (answeredEntries.length === 0) {
      await handleProceedWithPlaceholders();
      return;
    }

    const updatedMission: Mission = {
      ...currentMission,
      status: 'planning',
      clarificationAnswers: answers,
      clarificationResolved: true,
      logs: [
        ...currentMission.logs,
        {
          id: `log-clarify-answered-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'CLARIFICATION',
          stage: 'UNDERSTAND',
          title: 'Operator Supplied Missing Details',
          message: `Received ${answeredEntries.length} clarification answer(s). Re-formulating plan with supplied facts.`,
        },
      ],
    };

    commitMissionState(updatedMission);
    await planAndLaunchMission({
      targetMission: updatedMission,
      clarificationAnswers: answers,
    });
  };

  const handleProceedWithPlaceholders = async () => {
    if (!currentMission || isPlanning) return;

    const updatedMission: Mission = {
      ...currentMission,
      status: 'planning',
      clarificationResolved: true,
      logs: [
        ...currentMission.logs,
        {
          id: `log-clarify-placeholders-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'CLARIFICATION',
          stage: 'UNDERSTAND',
          title: 'Operator Selected Explicit Placeholders',
          message:
            'Proceeding without guessing business facts. Bracketed [PLACEHOLDER] tokens will be used where info was omitted.',
        },
      ],
    };

    commitMissionState(updatedMission);
    await planAndLaunchMission({
      targetMission: updatedMission,
      bypassClarification: true,
    });
  };

  const finalizeVerificationReport = async (missionSnapshot: Mission, runId: number) => {
    if (activeRunIdRef.current !== runId) return;

    const endedIso = new Date().toISOString();
    const startEpoch = new Date(missionSnapshot.startedAt).getTime();
    const wallTotalDurationMs = !Number.isNaN(startEpoch)
      ? Math.max(missionSnapshot.elapsedMs || 0, Date.now() - startEpoch)
      : missionSnapshot.elapsedMs || 1000;

    const activeMission: Mission = {
      ...missionSnapshot,
      currentStage: 'DELIVER',
      activeStepIds: [],
      endedAt: endedIso,
      elapsedMs: wallTotalDurationMs,
    };

    const durationSec = Math.max(1, Math.round(wallTotalDurationMs / 1000));
    const historicalMissions = missionHistory
      .filter((m) => m.id !== activeMission.id && m.status === 'completed')
      .map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        elapsedMs: m.performanceMetrics?.totalDurationMs || m.elapsedMs || 0,
        totalDurationMs: m.performanceMetrics?.totalDurationMs || m.elapsedMs || 0,
      }))
      .filter((m) => m.totalDurationMs > 0);

    try {
      const verifyStart = Date.now();
      const verifyRes = await apiFetch(
        '/api/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            goal: activeMission.goal,
            missionName: activeMission.title,
            tasks: activeMission.tasks,
            artifacts: activeMission.artifacts,
            durationSec,
            totalDurationMs: wallTotalDurationMs,
            phaseTimings: activeMission.phaseTimings,
            deadlineAssessment: activeMission.deadlineAssessment,
            groundingSources: activeMission.groundingSources,
            historicalMissions,
            understanding: activeMission.understanding,
            clarificationAnswers: activeMission.clarificationAnswers,
            demoMode: Boolean(activeMission.understanding?.isDemoExample),
          }),
        },
        idToken
      );

      if (activeRunIdRef.current !== runId) return;

      const verifyData = await verifyRes.json();
      const verifyMs = Date.now() - verifyStart;
      activeMission.report = verifyData.report;
      if (verifyData.report?.performanceMetrics) {
        activeMission.performanceMetrics = verifyData.report.performanceMetrics;
      }
      if (verifyData.report?.groundingSources) {
        activeMission.groundingSources = verifyData.report.groundingSources;
      }
      if (verifyData.report?.deadlineAssessment) {
        activeMission.deadlineAssessment = verifyData.report.deadlineAssessment;
      }
      activeMission.phaseTimings = {
        ...(activeMission.phaseTimings || {}),
        verificationMs: (activeMission.phaseTimings?.verificationMs || 0) + verifyMs,
      };

      const perf = verifyData.report?.performanceMetrics;
      activeMission.logs = [
        ...activeMission.logs,
        {
          id: `log-verify-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: verifyData.report.metrics.failedSteps > 0 ? 'WARN' : 'SUCCESS',
          stage: 'DELIVER',
          title: 'Stage 6 Delivery & Verification Report Issued',
          message: `Score: ${verifyData.report.satisfactionScore}/100 [${verifyData.report.verificationStatus}]. Verified: ${verifyData.report.metrics.verifiedSteps}/${verifyData.report.metrics.totalSteps}. Duration: ${((perf?.totalDurationMs || wallTotalDurationMs) / 1000).toFixed(2)}s${perf?.timeSavedByParallelMs ? ` (${(perf.timeSavedByParallelMs / 1000).toFixed(2)}s saved via parallel waves)` : ''}.`,
        },
      ];

      const celebration = evaluateMissionCelebration(activeMission, verifyData.report);
      if (celebration.allowCelebrate && celebration.level >= 2) {
        sounds.playSuccessFanfare();
        if (celebration.level === 3 && effectiveAnimationsEnabled) {
          confetti({
            particleCount: 55,
            spread: 65,
            origin: { y: 0.62 },
            colors: ['#FBBF24', '#F59E0B', '#FDE68A', '#A855F7', '#06B6D4'],
          });
        }
      }
    } catch (vErr) {
      console.error('Error generating verification report:', vErr);
    }

    if (activeRunIdRef.current !== runId) return;
    commitMissionState(activeMission);
    isExecutingRef.current = false;
    setIsLoopRunning(false);
    void refreshSession();
    setActiveTab('report');
  };

  // Real Six-Stage Parallel-Wave Execution Engine (Concurrent Promise.all Waves + Approval Gates + Recovery)
  const runExecutionPipeline = async (
    initialMission: Mission,
    _startIndex = 0,
    existingElapsedMs = 0
  ) => {
    const runId = ++activeRunIdRef.current;
    isExecutingRef.current = true;
    setIsLoopRunning(true);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    const runStartedAt = Date.now();
    const missionStartEpoch = new Date(initialMission.startedAt).getTime();
    let accumulatedRecoveryMs = initialMission.phaseTimings?.recoveryMs || 0;
    let waveSeq = initialMission.tasks.reduce(
      (maxW, t) => (t.parallelBatchId ? Math.max(maxW, Number(t.parallelBatchId.replace('wave-', '')) || 0) : maxW),
      0
    );

    let activeMission: Mission = {
      ...initialMission,
      tasks: initialMission.tasks.map((t) => ({ ...t })),
      logs: [...initialMission.logs],
      artifacts: [...initialMission.artifacts],
      groundingSources: initialMission.groundingSources ? [...initialMission.groundingSources] : [],
    };
    const tasks = activeMission.tasks;
    const totalTasks = tasks.length;

    const mergeGroundingSources = (incoming?: GroundingSource[]) => {
      if (!incoming || incoming.length === 0) return;
      const existing = activeMission.groundingSources || [];
      const seen = new Set(existing.map((s) => s.uri));
      const merged = [...existing];
      for (const s of incoming) {
        if (s?.uri && !seen.has(s.uri)) {
          seen.add(s.uri);
          merged.push(s);
        }
      }
      activeMission.groundingSources = merged;
    };

    while (!isCancelledRef.current && activeRunIdRef.current === runId) {
      while (isPausedRef.current && !isCancelledRef.current && activeRunIdRef.current === runId) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (isCancelledRef.current || activeRunIdRef.current !== runId) break;

      const doneIds = new Set(
        tasks.filter((t) => t.status === 'completed' || t.status === 'skipped').map((t) => t.id)
      );
      const remaining = tasks.filter((t) => t.status === 'pending' || t.status === 'retrying');
      if (remaining.length === 0) break;

      let runnable = remaining.filter((t) =>
        (t.dependencies || []).every((depId) => doneIds.has(depId))
      );

      // Guard against deadlocks when upstream dependencies were absent or broken
      if (runnable.length === 0) {
        const blockedByFailed = remaining.some((t) =>
          (t.dependencies || []).some((depId) =>
            tasks.some((dt) => dt.id === depId && (dt.status === 'failed' || dt.status === 'awaiting_approval'))
          )
        );
        if (blockedByFailed) break;
        runnable = [remaining[0]];
      }

      const autoRunnable = runnable.filter(
        (t) => !t.requiresApproval || t.approvalStatus === 'approved'
      );
      const approvalBlocked = runnable.filter(
        (t) => t.requiresApproval && t.approvalStatus !== 'approved'
      );

      if (autoRunnable.length === 0 && approvalBlocked.length > 0) {
        const gateTask = approvalBlocked[0];
        const gateIdx = tasks.findIndex((t) => t.id === gateTask.id);
        gateTask.status = 'awaiting_approval';
        activeMission.status = 'awaiting_approval';
        activeMission.currentStepId = gateTask.id;
        activeMission.activeStepIds = [];
        activeMission.currentStage = gateTask.stage || 'EXECUTE';
        activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
        activeMission.logs.push({
          id: `log-approval-gate-${Date.now()}-${gateIdx}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'APPROVAL',
          stage: gateTask.stage || 'EXECUTE',
          title: `Human Approval Required: Step 0${gateIdx + 1}`,
          message: `${gateTask.title} (${gateTask.approvalActionType || gateTask.tool}) paused for operator authorization. Reason: ${gateTask.approvalReason || 'Sensitive external action.'}`,
          stepId: gateTask.id,
          simulated: gateTask.simulated,
          toolType: gateTask.toolType,
        });

        sounds.playPause();
        commitMissionState(activeMission);
        isExecutingRef.current = false;
        setIsLoopRunning(false);
        return;
      }

      const waveTasks = autoRunnable;
      const isParallelWave = waveTasks.length >= 2;
      const batchId = isParallelWave ? `wave-${++waveSeq}` : undefined;
      const waveStartEpoch = Date.now();
      const completedCountBefore = tasks.filter(
        (t) => t.status === 'completed' || t.status === 'skipped'
      ).length;

      // Immutable upstream snapshots for this wave so sibling tasks do not read uncommitted siblings
      const dependencyOutputsSnapshot = tasks
        .filter((t) => t.status === 'completed')
        .map((t) => ({
          id: t.id,
          title: t.title,
          tool: t.tool,
          toolOutput: t.toolOutput,
          reasoning: t.reasoning,
        }));
      const completedTitlesSnapshot = tasks
        .filter((t) => t.status === 'completed')
        .map((t) => t.title);
      const artifactsSnapshot = [...activeMission.artifacts];

      for (const wt of waveTasks) {
        wt.status = 'running';
        wt.startedAt = new Date(waveStartEpoch).toISOString();
        wt.startedOffsetMs = !Number.isNaN(missionStartEpoch)
          ? Math.max(0, waveStartEpoch - missionStartEpoch)
          : waveStartEpoch - runStartedAt;
        wt.parallelBatchId = batchId;
      }

      activeMission.activeStepIds = waveTasks.map((t) => t.id);
      activeMission.currentStepId = waveTasks[0].id;
      activeMission.currentStage = waveTasks[0].stage || 'EXECUTE';
      activeMission.status = 'executing';
      activeMission.progress = (completedCountBefore / totalTasks) * 100;
      sounds.playStepStart();

      if (isParallelWave) {
        activeMission.logs.push({
          id: `log-wave-start-${Date.now()}-${waveSeq}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'EXEC',
          stage: 'COORDINATE',
          title: `Executing Parallel Wave ${batchId} (${waveTasks.length} Concurrent Steps)`,
          message: `Running simultaneously via Promise.all: ${waveTasks.map((w) => `${w.title} (${w.tool})`).join(' + ')}`,
          stepId: waveTasks[0].id,
        });
      } else {
        const single = waveTasks[0];
        const sIdx = tasks.findIndex((t) => t.id === single.id);
        activeMission.logs.push({
          id: `log-step-start-${Date.now()}-${sIdx}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'EXEC',
          stage: single.stage || 'EXECUTE',
          title: `Executing Step 0${sIdx + 1} [${single.toolType}]`,
          message: `${single.title} (Tool: ${single.tool})`,
          stepId: single.id,
          simulated: single.simulated,
          toolType: single.toolType,
        });
      }

      commitMissionState(activeMission);

      const invokeBackendStep = async (taskPayload: Task) => {
        const res = await apiFetch(
          '/api/execute-step',
          {
            method: 'POST',
            body: JSON.stringify({
              goal: activeMission.goal,
              task: taskPayload,
              completedTasks: completedTitlesSnapshot,
              dependencyOutputs: dependencyOutputsSnapshot,
              artifacts: artifactsSnapshot,
              persona: activeMission.persona,
              executionDepth: activeMission.executionDepth,
              targetDeadline: activeMission.targetDeadline,
              clarificationAnswers: activeMission.clarificationAnswers,
              bypassClarification:
                !!activeMission.clarificationResolved && !activeMission.clarificationAnswers,
              demoMode: Boolean(activeMission.understanding?.isDemoExample),
            }),
          },
          idToken
        );
        const body = await res.json();
        return { httpStatus: res.status, ...body };
      };

      const waveResults = await Promise.all(
        waveTasks.map(async (task) => {
          let localRecoveryMs = 0;
          try {
            let stepData = await invokeBackendStep(task);
            if (activeRunIdRef.current !== runId) {
              return { task, outcome: 'aborted' as const, localRecoveryMs, finishedEpoch: Date.now() };
            }

            if (stepData.guestTrial) {
              updateTrialInfo(stepData.guestTrial);
            }

            if (stepData.httpStatus === 429 && stepData.code === 'GUEST_TRIAL_LIMIT_REACHED') {
              return {
                task,
                outcome: 'trial_limit' as const,
                stepData,
                localRecoveryMs,
                finishedEpoch: Date.now(),
              };
            }

            if (stepData.status === 'AWAITING_APPROVAL') {
              return {
                task,
                outcome: 'awaiting_approval' as const,
                stepData,
                localRecoveryMs,
                finishedEpoch: Date.now(),
              };
            }

            if (stepData.status === 'FAILED' || !stepData.verificationPassed) {
              const recStart = Date.now();
              const initialError = stepData.error || 'Tool execution or verification failed.';
              let recoverData: any = null;
              try {
                const recRes = await apiFetch(
                  '/api/recover',
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      goal: activeMission.goal,
                      failedTask: task,
                      errorMessage: initialError,
                      completedTasks: completedTitlesSnapshot,
                    }),
                  },
                  idToken
                );
                recoverData = await recRes.json();
              } catch {}

              if (activeRunIdRef.current !== runId) {
                return { task, outcome: 'aborted' as const, localRecoveryMs, finishedEpoch: Date.now() };
              }

              if (
                recoverData?.recoverableAutomatically &&
                recoverData?.repairedInput &&
                (task.recoveryAttempts || 0) < 1
              ) {
                task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
                task.toolInput = recoverData.repairedInput;
                stepData = await invokeBackendStep(task);
                localRecoveryMs += Date.now() - recStart;
                if (activeRunIdRef.current !== runId) {
                  return { task, outcome: 'aborted' as const, localRecoveryMs, finishedEpoch: Date.now() };
                }
              } else {
                localRecoveryMs += Date.now() - recStart;
              }

              if (stepData.status === 'FAILED' || !stepData.verificationPassed) {
                return {
                  task,
                  outcome: 'failed' as const,
                  stepData,
                  recoverData,
                  error: stepData.error || initialError,
                  localRecoveryMs,
                  finishedEpoch: Date.now(),
                };
              }
            }

            return {
              task,
              outcome: 'completed' as const,
              stepData,
              localRecoveryMs,
              finishedEpoch: Date.now(),
            };
          } catch (stepErr: any) {
            return {
              task,
              outcome: 'exception' as const,
              error: stepErr?.message || 'Network / server exception',
              localRecoveryMs,
              finishedEpoch: Date.now(),
            };
          }
        })
      );

      if (activeRunIdRef.current !== runId) return;

      activeMission.activeStepIds = [];
      for (const wr of waveResults) {
        accumulatedRecoveryMs += wr.localRecoveryMs;
      }

      // First process any successful completions in this wave so partial checkpoints are preserved
      for (const wr of waveResults) {
        if (wr.outcome !== 'completed') continue;
        const { task, stepData, finishedEpoch } = wr;
        const idx = tasks.findIndex((t) => t.id === task.id);

        task.status = 'completed';
        task.completedAt = new Date(finishedEpoch).toISOString();
        task.finishedOffsetMs = !Number.isNaN(missionStartEpoch)
          ? Math.max(0, finishedEpoch - missionStartEpoch)
          : finishedEpoch - runStartedAt;
        task.reasoning = stepData.reasoning;
        task.executionBadge = stepData.executionBadge;
        task.toolInput = stepData.toolInput;
        task.toolOutput = stepData.toolOutput;
        task.executionTimeMs =
          typeof stepData.executionTimeMs === 'number'
            ? stepData.executionTimeMs
            : Math.max(1, finishedEpoch - waveStartEpoch);
        task.retryCount = stepData.retryCount || 0;
        task.reusedCachedResult = !!stepData.reusedCachedResult;
        if (Array.isArray(stepData.groundingSources)) {
          task.groundingSources = stepData.groundingSources;
          mergeGroundingSources(stepData.groundingSources);
        }
        task.error = undefined;
        task.verificationPassed = true;
        task.verificationEvidence = stepData.verificationEvidence;

        activeMission.lastCheckpointStepId = task.id;

        if (task.tool === 'artifact_validator' && activeMission.artifacts.length > 0) {
          const htmlIdx = [...activeMission.artifacts]
            .reverse()
            .findIndex((a) => a.format === 'html' || (a.name || '').endsWith('.html'));
          const targetIdx =
            htmlIdx !== -1
              ? activeMission.artifacts.length - 1 - htmlIdx
              : activeMission.artifacts.length - 1;
          activeMission.artifacts[targetIdx] = {
            ...activeMission.artifacts[targetIdx],
            validated: true,
            validationSummary: stepData.verificationEvidence,
          };
        }

        if (stepData.artifactPayload) {
          const newArtifact: Artifact = {
            id: `art-${finishedEpoch}-${idx}`,
            name: stepData.artifactPayload.name || task.expectedArtifact || `artifact_${idx}.json`,
            format: stepData.artifactPayload.format || 'json',
            content: stepData.artifactPayload.content || '',
            stepId: task.id,
            timestamp: new Date(finishedEpoch).toLocaleTimeString(),
            isRealExecution: task.toolType === 'REAL',
            validated: !!stepData.artifactPayload.validated,
            validationSummary: stepData.artifactPayload.validationSummary,
          };
          task.outputArtifact = newArtifact;
          activeMission.artifacts = [...activeMission.artifacts, newArtifact];
        }

        const newLogs: ActivityLog[] = (stepData.logs || []).map((l: string, lIdx: number) => ({
          id: `log-res-${finishedEpoch}-${idx}-${lIdx}`,
          timestamp: new Date(finishedEpoch).toLocaleTimeString(),
          level: lIdx === 0 ? 'REASONING' : 'INFO',
          stage: task.stage || 'EXECUTE',
          title: `Step 0${idx + 1} Telemetry`,
          message: l,
          stepId: task.id,
          simulated: task.simulated,
          toolType: task.toolType,
        }));

        activeMission.logs = [
          ...activeMission.logs,
          ...newLogs,
          {
            id: `log-done-${finishedEpoch}-${idx}`,
            timestamp: new Date(finishedEpoch).toLocaleTimeString(),
            level: 'SUCCESS',
            stage: task.stage || 'EXECUTE',
            title: `Step 0${idx + 1} Verified Complete (${Math.round(task.executionTimeMs || 0)}ms${task.parallelBatchId ? ` · ${task.parallelBatchId}` : ''})`,
            message: `Tool ${task.tool} verified: ${stepData.verificationEvidence || 'OK'}`,
            stepId: task.id,
            simulated: task.simulated,
            toolType: task.toolType,
          },
        ];

        sounds.playStepComplete();
      }

      const trialHit = waveResults.find((wr) => wr.outcome === 'trial_limit');
      if (trialHit) {
        const idx = tasks.findIndex((t) => t.id === trialHit.task.id);
        trialHit.task.status = 'paused';
        activeMission.status = 'paused';
        activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
        activeMission.logs.push({
          id: `log-step-trial-limit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'WARN',
          stage: trialHit.task.stage || 'EXECUTE',
          title: `Paused at Step 0${idx + 1} — Guest Step Limit Reached`,
          message: trialHit.stepData.error,
          stepId: trialHit.task.id,
        });
        sounds.playPause();
        commitMissionState(activeMission);
        isExecutingRef.current = false;
        setIsLoopRunning(false);
        openAuthModal(trialHit.stepData.error);
        return;
      }

      const backendGate = waveResults.find((wr) => wr.outcome === 'awaiting_approval');
      if (backendGate) {
        const idx = tasks.findIndex((t) => t.id === backendGate.task.id);
        backendGate.task.status = 'awaiting_approval';
        activeMission.status = 'awaiting_approval';
        activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
        activeMission.logs.push({
          id: `log-backend-gate-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'APPROVAL',
          stage: backendGate.task.stage || 'EXECUTE',
          title: `Backend Approval Gate Enforced: Step 0${idx + 1}`,
          message: backendGate.stepData.approvalReason || 'Operator approval required.',
          stepId: backendGate.task.id,
        });
        sounds.playPause();
        commitMissionState(activeMission);
        isExecutingRef.current = false;
        setIsLoopRunning(false);
        return;
      }

      const fatalHit = waveResults.find(
        (wr) => wr.outcome === 'failed' || wr.outcome === 'exception'
      );
      if (fatalHit) {
        const idx = tasks.findIndex((t) => t.id === fatalHit.task.id);
        const task = fatalHit.task;
        task.status = 'failed';
        task.completedAt = new Date(fatalHit.finishedEpoch).toISOString();
        task.error = toFriendlyCustomerError(fatalHit.error, task.tool);
        if (fatalHit.outcome === 'failed') {
          task.retryCount = fatalHit.stepData?.retryCount || 0;
          task.verificationPassed = false;
          task.logs = fatalHit.stepData?.logs || [];
          task.recoveryStrategy = fatalHit.recoverData
            ? toFriendlyRecoveryNote(
                `${fatalHit.recoverData.diagnosis} — ${fatalHit.recoverData.suggestedStrategy}`,
                task.tool
              )
            : 'Choose "Continue with estimates" to apply sensible defaults and finish your mission.';
        } else {
          task.recoveryStrategy =
            'Your saved work is safe. Choose "Continue with estimates" or try this step again.';
        }

        activeMission.status = 'failed';
        activeMission.currentStepId = task.id;
        activeMission.currentStage = 'VERIFY_RECOVER';
        activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
        activeMission.phaseTimings = {
          ...(activeMission.phaseTimings || {}),
          executionMs: (activeMission.phaseTimings?.executionMs || 0) + (Date.now() - runStartedAt),
          recoveryMs: accumulatedRecoveryMs,
        };
        activeMission.logs.push({
          id: `log-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'WARN',
          stage: 'VERIFY_RECOVER',
          title: `Step 0${idx + 1} Paused Safely`,
          message: `${task.error} | Next step: ${task.recoveryStrategy}`,
          stepId: task.id,
          toolType: task.toolType,
        });

        sounds.playPause();
        commitMissionState(activeMission);
        isExecutingRef.current = false;
        setIsLoopRunning(false);
        return;
      }

      const completedNow = tasks.filter(
        (t) => t.status === 'completed' || t.status === 'skipped'
      ).length;
      activeMission.progress = (completedNow / totalTasks) * 100;
      activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
      commitMissionState(activeMission);
    }

    if (activeRunIdRef.current !== runId) return;

    if (isCancelledRef.current) {
      activeMission.status = 'cancelled';
      activeMission.activeStepIds = [];
      activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
      activeMission.logs.push({
        id: `log-cancel-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'WARN',
        title: 'Mission Aborted',
        message: 'Operator invoked safe cancellation. Completed checkpoints preserved.',
      });
      commitMissionState(activeMission);
      isExecutingRef.current = false;
      setIsLoopRunning(false);
      return;
    }

    activeMission.status = 'completed';
    activeMission.progress = 100;
    activeMission.activeStepIds = [];
    activeMission.elapsedMs = existingElapsedMs + (Date.now() - runStartedAt);
    activeMission.phaseTimings = {
      ...(activeMission.phaseTimings || {}),
      executionMs: (activeMission.phaseTimings?.executionMs || 0) + (Date.now() - runStartedAt),
      recoveryMs: accumulatedRecoveryMs,
    };
    await finalizeVerificationReport(activeMission, runId);
  };

  // Human Approval Gate Handlers
  const handleApproveTask = (taskId: string) => {
    if (!currentMission || isExecutingRef.current) return;
    const idx = currentMission.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;

    const updatedTasks = currentMission.tasks.map((t, i) =>
      i === idx
        ? { ...t, approvalStatus: 'approved' as const, status: 'pending' as const }
        : t
    );

    const updatedMission: Mission = {
      ...currentMission,
      status: 'executing',
      tasks: updatedTasks,
      logs: [
        ...currentMission.logs,
        {
          id: `log-approved-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'APPROVAL',
          stage: updatedTasks[idx].stage,
          title: `Operator Approved Step 0${idx + 1}`,
          message: `Authorization granted for "${updatedTasks[idx].title}" (${updatedTasks[idx].tool}). Resuming execution.`,
          stepId: taskId,
        },
      ],
    };

    commitMissionState(updatedMission);
    runExecutionPipeline(updatedMission, idx, updatedMission.elapsedMs || 0);
  };

  const handleRejectTask = (taskId: string) => {
    if (!currentMission || isExecutingRef.current) return;
    const idx = currentMission.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;

    const updatedTasks = currentMission.tasks.map((t, i) =>
      i === idx
        ? {
            ...t,
            approvalStatus: 'rejected' as const,
            status: 'skipped' as const,
            reasoning: 'Operator declined approval; step skipped safely and upstream drafts preserved.',
          }
        : t
    );

    const updatedMission: Mission = {
      ...currentMission,
      status: 'executing',
      tasks: updatedTasks,
      progress: ((idx + 1) / updatedTasks.length) * 100,
      logs: [
        ...currentMission.logs,
        {
          id: `log-rejected-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'WARN',
          stage: updatedTasks[idx].stage,
          title: `Operator Declined Step 0${idx + 1}`,
          message: `Skipped "${updatedTasks[idx].title}" safely. Drafts and completed work preserved.`,
          stepId: taskId,
        },
      ],
    };

    commitMissionState(updatedMission);
    runExecutionPipeline(updatedMission, idx + 1, updatedMission.elapsedMs || 0);
  };

  // Stage 5 Failure Recovery Handlers
  const handleRetryFailedTask = (taskId: string) => {
    if (!currentMission || isExecutingRef.current) return;
    const idx = currentMission.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;

    const updatedTasks = currentMission.tasks.map((t, i) =>
      i === idx ? { ...t, status: 'retrying' as const, error: undefined } : t
    );

    const updatedMission: Mission = {
      ...currentMission,
      status: 'executing',
      tasks: updatedTasks,
      logs: [
        ...currentMission.logs,
        {
          id: `log-manual-retry-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'RETRY',
          stage: 'VERIFY_RECOVER',
          title: `Operator Triggered Checkpoint Retry`,
          message: `Retrying "${updatedTasks[idx].title}" from preserved checkpoint.`,
          stepId: taskId,
        },
      ],
    };

    commitMissionState(updatedMission);
    runExecutionPipeline(updatedMission, idx, updatedMission.elapsedMs || 0);
  };

  const handleContinueWithEstimates = async () => {
    if (!currentMission || isExecutingRef.current) return;

    if (currentMission.tasks.length === 0) {
      handleRetryPlanning();
      return;
    }

    const failedOrStalledIndices = currentMission.tasks
      .map((t, i) => (t.status === 'failed' || t.status === 'paused' || t.status === 'running' ? i : -1))
      .filter((i) => i !== -1);

    if (failedOrStalledIndices.length === 0) {
      handleResume();
      return;
    }

    sounds.playStepStart();
    isExecutingRef.current = true;
    setIsLoopRunning(true);

    const updatedTasks = currentMission.tasks.map((t) => ({ ...t }));
    const updatedArtifacts = [...currentMission.artifacts];
    const extraLogs: ActivityLog[] = [];

    for (const idx of failedOrStalledIndices) {
      const targetTask = updatedTasks[idx];
      let resolvedStepData: any = null;
      try {
        const res = await apiFetch(
          '/api/execute-step',
          {
            method: 'POST',
            body: JSON.stringify({
              goal: currentMission.goal,
              task: { ...targetTask, status: 'pending' },
              completedTasks: updatedTasks.filter((t) => t.status === 'completed').map((t) => t.title),
              dependencyOutputs: [],
              artifacts: updatedArtifacts,
              persona: currentMission.persona,
              executionDepth: currentMission.executionDepth,
              targetDeadline: currentMission.targetDeadline,
              clarificationAnswers: currentMission.clarificationAnswers,
              bypassClarification: true,
              demoMode: Boolean(currentMission.understanding?.isDemoExample),
              continueWithEstimates: true,
            }),
          },
          idToken
        );
        if (res.ok) {
          resolvedStepData = await res.json();
        }
      } catch {
        // Offline client-side estimate fallback below ensures mission never stalls
      }

      const nowEpoch = Date.now();
      const friendlyReasoning =
        resolvedStepData?.reasoning ||
        'I used sensible estimates for the pricing step so we can keep moving.';

      targetTask.status = 'completed';
      targetTask.completedAt = new Date(nowEpoch).toISOString();
      targetTask.error = undefined;
      targetTask.recoveryStrategy = undefined;
      targetTask.verificationPassed = true;
      targetTask.reasoning = friendlyReasoning;
      targetTask.executionBadge =
        resolvedStepData?.executionBadge || '[ESTIMATED PROJECTION · CONTINUED]';
      targetTask.toolInput = resolvedStepData?.toolInput || { mode: 'continue_with_estimates' };
      targetTask.toolOutput = resolvedStepData?.toolOutput || {
        label: 'Estimated projection',
        friendlyCustomerNote: friendlyReasoning,
      };
      targetTask.verificationEvidence =
        resolvedStepData?.verificationEvidence || 'Completed step cleanly using Estimated projection.';

      if (resolvedStepData?.artifactPayload) {
        const newArtifact: Artifact = {
          id: `art-est-${nowEpoch}-${idx}`,
          name:
            resolvedStepData.artifactPayload.name ||
            targetTask.expectedArtifact ||
            `estimated_projection_${idx + 1}.md`,
          format: resolvedStepData.artifactPayload.format || 'markdown',
          content: resolvedStepData.artifactPayload.content || '',
          stepId: targetTask.id,
          timestamp: new Date(nowEpoch).toLocaleTimeString(),
          isRealExecution: targetTask.toolType === 'REAL',
          validated: true,
          validationSummary:
            resolvedStepData.artifactPayload.validationSummary ||
            'Estimated projection deliverable prepared.',
        };
        targetTask.outputArtifact = newArtifact;
        updatedArtifacts.push(newArtifact);
      }

      extraLogs.push({
        id: `log-est-${nowEpoch}-${idx}`,
        timestamp: new Date(nowEpoch).toLocaleTimeString(),
        level: 'SUCCESS',
        stage: targetTask.stage || 'EXECUTE',
        title: `Step 0${idx + 1} Continued With Estimates`,
        message: friendlyReasoning,
        stepId: targetTask.id,
        toolType: targetTask.toolType,
      });
    }

    const doneCount = updatedTasks.filter(
      (t) => t.status === 'completed' || t.status === 'skipped'
    ).length;

    const updatedMission: Mission = {
      ...currentMission,
      status: 'executing',
      tasks: updatedTasks,
      artifacts: updatedArtifacts,
      progress: (doneCount / updatedTasks.length) * 100,
      logs: [...currentMission.logs, ...extraLogs],
    };

    commitMissionState(updatedMission);
    isExecutingRef.current = false;
    setIsLoopRunning(false);

    const nextPendingIdx = updatedTasks.findIndex(
      (t) => t.status === 'pending' || t.status === 'retrying'
    );
    if (nextPendingIdx !== -1) {
      runExecutionPipeline(updatedMission, nextPendingIdx, updatedMission.elapsedMs || 0);
    } else {
      const runId = ++activeRunIdRef.current;
      await finalizeVerificationReport({ ...updatedMission, status: 'completed', progress: 100 }, runId);
    }
  };

  const handleFinalizePartialDelivery = async () => {
    if (!currentMission || isExecutingRef.current) return;
    const runId = ++activeRunIdRef.current;
    await finalizeVerificationReport(currentMission, runId);
  };

  // Standard Execution Control Handlers
  const handlePause = () => {
    isPausedRef.current = true;
    sounds.playPause();
    if (currentMission) {
      const updated: Mission = {
        ...currentMission,
        status: 'paused',
        logs: [
          ...currentMission.logs,
          {
            id: `log-pause-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'WARN',
            title: 'Operator Pause',
            message: 'Execution loop frozen by operator. State preserved at checkpoint.',
          },
        ],
      };
      commitMissionState(updated);
    }
  };

  const handleResume = () => {
    isPausedRef.current = false;
    sounds.playStepStart();
    if (currentMission) {
      // Any task left in 'running' or 'paused' state from a disconnected session resets cleanly to 'pending'
      const normalizedTasks = currentMission.tasks.map((t) =>
        t.status === 'running' || t.status === 'paused'
          ? { ...t, status: 'pending' as const }
          : t
      );

      const updated: Mission = {
        ...currentMission,
        status: 'executing',
        tasks: normalizedTasks,
        logs: [
          ...currentMission.logs,
          {
            id: `log-resume-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            title: 'Execution Resumed from Checkpoint',
            message: 'Continuing autonomous pipeline without repeating already-completed steps.',
          },
        ],
      };
      commitMissionState(updated);

      if (updated.tasks.length === 0) {
        void planAndLaunchMission({ targetMission: updated });
        return;
      }

      if (!isExecutingRef.current) {
        const nextIdx = updated.tasks.findIndex(
          (t) => t.status === 'pending' || t.status === 'retrying'
        );
        if (nextIdx !== -1) {
          runExecutionPipeline(updated, nextIdx, updated.elapsedMs || 0);
        } else {
          const runId = ++activeRunIdRef.current;
          void finalizeVerificationReport({ ...updated, status: 'completed', progress: 100 }, runId);
        }
      }
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    sounds.playPause();
    if (!isExecutingRef.current && currentMission) {
      const updated: Mission = {
        ...currentMission,
        status: 'cancelled',
        logs: [
          ...currentMission.logs,
          {
            id: `log-cancel-idle-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'WARN',
            title: 'Mission Cancelled',
            message: 'Operator cancelled mission at gate/checkpoint.',
          },
        ],
      };
      commitMissionState(updated);
    }
  };

  const handleStepNext = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setTimeout(() => {
        isPausedRef.current = true;
      }, 500);
    }
  };

  const handleSetSpeed = (speed: number) => {
    if (currentMission) {
      commitMissionState({
        ...currentMission,
        executionSpeed: speed,
      });
    }
  };

  const handleRetryPlanning = () => {
    if (!currentMission || isPlanning) return;
    const retryMission: Mission = {
      ...currentMission,
      status: 'planning',
      currentStage: 'UNDERSTAND',
      logs: [
        ...currentMission.logs,
        {
          id: `log-retry-plan-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'RETRY',
          stage: 'UNDERSTAND',
          title: 'Retrying Mission Planning',
          message: 'Re-running planning on the same project without creating a duplicate.',
        },
      ],
    };
    commitMissionState(retryMission);
    void planAndLaunchMission({
      targetMission: retryMission,
      clarificationAnswers: retryMission.clarificationAnswers,
      bypassClarification: Boolean(retryMission.clarificationResolved),
    });
  };

  const handleRestartMission = () => {
    if (!currentMission || isPlanning) return;
    if (currentMission.tasks.length === 0 && currentMission.status === 'failed') {
      handleRetryPlanning();
      return;
    }
    handleStartMission({
      goal: currentMission.goal,
      persona: currentMission.persona,
      executionDepth: currentMission.executionDepth,
      targetDeadline: currentMission.targetDeadline,
      demoMode: Boolean(currentMission.understanding?.isDemoExample),
    });
  };

  const handleSelectMission = (m: Mission) => {
    speechController.stop();
    setCurrentMission(m);
    missionRef.current = m;
    setActiveTab(m.report ? 'report' : 'execution');
  };

  const handleForkGoal = () => {
    setActiveTab('dashboard');
  };

  const handleRefineInstruction = async (instruction: string) => {
    if (!currentMission || !instruction.trim() || isPlanning) return;
    activeRunIdRef.current += 1;
    isExecutingRef.current = false;
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setIsLoopRunning(false);

    const updatedGoal = `${currentMission.goal}\n\nFollow-up guidance: ${instruction.trim()}`;
    const updatedMission: Mission = {
      ...currentMission,
      goal: updatedGoal,
      status: 'planning',
      currentStage: 'UNDERSTAND',
      progress: 10,
      report: undefined,
      logs: [
        ...currentMission.logs,
        {
          id: `log-refine-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'CLARIFICATION',
          stage: 'UNDERSTAND',
          title: 'Follow-up Instruction Applied',
          message: `Updated project plan with your guidance: "${instruction.trim()}"`,
        },
      ],
    };

    commitMissionState(updatedMission);
    setActiveTab('execution');
    await planAndLaunchMission({
      targetMission: updatedMission,
      clarificationAnswers: updatedMission.clarificationAnswers,
      bypassClarification: Boolean(updatedMission.clarificationResolved),
    });
  };

  const handleLaunchGoalFromChat = (goalText: string) => {
    const trimmed = goalText.trim();
    if (!trimmed) return;
    void handleStartMission({
      goal: trimmed,
      persona: userPreferences?.defaultPersona || 'Apex Growth',
      executionDepth: userPreferences?.defaultDepth || 'Standard DAG',
      targetDeadline: 'Immediate / Real-time',
    });
  };

  const showMigrationPrompt =
    Boolean(user) &&
    (pendingGuestMissions.length > 0 || pendingGuestChatCount > 0) &&
    migrationDismissedForUid !== user?.uid;

  return (
    <div className="min-h-screen bg-[#08090E] text-slate-100 cyber-grid flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      <Navbar
        currentMission={currentMission}
        historyCount={missionHistory.length}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        animationsEnabled={effectiveAnimationsEnabled}
        onToggleAnimations={toggleAnimations}
        advancedMode={advancedMode}
        onToggleAdvancedMode={toggleAdvancedMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onNewMission={() => setActiveTab('dashboard')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accountEmail={user?.email}
        accountName={user?.displayName}
        isVerifiedAccount={Boolean(user?.emailVerified)}
        isAdmin={isAdmin}
        onOpenAccount={() => openAuthModal()}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <SystemNoticeBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {currentMission && currentMission.status !== 'idle' && activeTab !== 'dashboard' && (
          <ExecutionControls
            mission={currentMission}
            isLoopRunning={isLoopRunning}
            advancedMode={advancedMode}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onStepNext={handleStepNext}
            onSetSpeed={handleSetSpeed}
            onRestart={handleRestartMission}
          />
        )}

        {activeTab === 'dashboard' && (
          <GoalInputDashboard
            onStartMission={handleStartMission}
            isPlanning={isPlanning}
            missions={workspaceLoading ? [] : missionHistory}
            activeMissionId={currentMission?.id}
            onSelectMission={handleSelectMission}
            isGuest={!user}
            guestTrial={guestTrial}
            accountEmail={user?.email}
            onOpenAuthModal={openAuthModal}
            defaultPersona={userPreferences?.defaultPersona}
            defaultDepth={userPreferences?.defaultDepth}
            advancedMode={advancedMode}
            onToggleAdvancedMode={toggleAdvancedMode}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            animationsEnabled={effectiveAnimationsEnabled}
            onToggleAnimations={toggleAnimations}
          />
        )}

        {activeTab === 'planner' && currentMission && (
          <TaskPlannerView
            mission={currentMission}
            onSelectArtifact={(art) => setSelectedArtifact(art)}
            onRateResponse={handleResponseFeedback}
            speechState={speechState}
            onSpeak={handleSpeakSingle}
            onPauseSpeech={() => speechController.pause()}
            onResumeSpeech={() => speechController.resume()}
            onStopSpeech={() => speechController.stop()}
          />
        )}

        {activeTab === 'execution' && currentMission && (
          <ExecutionMonitor
            mission={currentMission}
            advancedMode={advancedMode}
            animationsEnabled={effectiveAnimationsEnabled}
            idToken={idToken}
            onSelectArtifact={(art) => setSelectedArtifact(art)}
            onViewReport={() => setActiveTab('report')}
            onApproveTask={handleApproveTask}
            onRejectTask={handleRejectTask}
            onRetryFailedTask={handleRetryFailedTask}
            onRetryPlanning={handleRetryPlanning}
            onContinueWithEstimates={handleContinueWithEstimates}
            onFinalizePartialDelivery={handleFinalizePartialDelivery}
            onSubmitClarifications={handleSubmitClarifications}
            onProceedWithPlaceholders={handleProceedWithPlaceholders}
            onResumeMission={handleResume}
            onRefineInstruction={handleRefineInstruction}
            isLoopRunning={isLoopRunning}
            onRateResponse={handleResponseFeedback}
            speechState={speechState}
            onSpeak={handleSpeakSingle}
            onSpeakSequence={handleSpeakAllMissionResponses}
            onPauseSpeech={() => speechController.pause()}
            onResumeSpeech={() => speechController.resume()}
            onStopSpeech={() => speechController.stop()}
          />
        )}

        {activeTab === 'logs' && currentMission && (
          <ActivityLogView
            logs={currentMission.logs}
            onClearLogs={() => {
              if (currentMission) {
                commitMissionState({ ...currentMission, logs: [] });
              }
            }}
          />
        )}

        {activeTab === 'report' &&
          currentMission &&
          (currentMission.report ? (
            <VerificationReportView
              report={currentMission.report}
              mission={currentMission}
              advancedMode={advancedMode}
              animationsEnabled={effectiveAnimationsEnabled}
              onToggleAdvancedMode={toggleAdvancedMode}
              onSelectArtifact={(art) => setSelectedArtifact(art)}
              onRerun={handleRestartMission}
              onForkGoal={handleForkGoal}
              onRateResponse={handleResponseFeedback}
              speechState={speechState}
              onSpeak={handleSpeakSingle}
              onSpeakSequence={handleSpeakAllMissionResponses}
              onPauseSpeech={() => speechController.pause()}
              onResumeSpeech={() => speechController.resume()}
              onStopSpeech={() => speechController.stop()}
            />
          ) : (
            <div className="glass-panel p-8 sm:p-10 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
              <div className="p-3 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 w-12 h-12 mx-auto flex items-center justify-center">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">
                {currentMission.status === 'awaiting_clarification'
                  ? 'Quick question waiting for you'
                  : currentMission.status === 'awaiting_approval'
                  ? 'Waiting for your approval'
                  : currentMission.status === 'failed'
                  ? 'Paused on a snag — ready to retry'
                  : 'Still working on your project'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-sans">
                Your completed results and files will appear here as soon as the steps finish.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('execution')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs transition-colors cursor-pointer"
              >
                View Live Progress ({Math.round(currentMission.progress)}%)
              </button>
            </div>
          ))}
      </main>

      <ArtifactModal
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        missions={missionHistory}
        onSelectMission={handleSelectMission}
        onDeleteMission={handleDeleteMission}
        onClearHistory={handleClearHistory}
        isGuest={!user}
        onOpenAuthModal={openAuthModal}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <AuthAccountModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        missionCount={missionHistory.length}
      />

      {showMigrationPrompt && (
        <GuestMigrationModal
          pendingMissions={pendingGuestMissions}
          pendingChatCount={pendingGuestChatCount}
          onConfirm={handleConfirmMigration}
          onDecline={handleDeclineMigration}
          onKeepLater={() => setMigrationDismissedForUid(user?.uid || null)}
        />
      )}

      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      <AdminConsoleModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      <PhoenixChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        idToken={idToken}
        actorKey={user?.uid || 'guest'}
        currentMission={currentMission}
        advancedMode={advancedMode}
        onLaunchGoalFromChat={handleLaunchGoalFromChat}
      />

      <footer className="border-t border-slate-900 bg-[#06070B] py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong className="text-amber-300/90 font-display">{BRAND_CONFIG.name}</strong> ·{' '}
            {BRAND_CONFIG.tagline}
          </span>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Privacy &amp; Data Policy</span>
            </button>
            <span className="text-slate-600 hidden md:inline">
              {BRAND_CONFIG.copyrightNotice}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
