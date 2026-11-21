import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  FileCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Calculator,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  SkipForward,
  Layers,
  Brain,
  MessageSquareMore,
  Volume2,
  Pause,
  Play,
  Square,
  Clock,
  Zap,
  Globe,
  ExternalLink,
  Send,
  Wand2,
  Eye,
  Download,
} from 'lucide-react';
import {
  Mission,
  Artifact,
  PhoenixStage,
  ResponseFeedbackRating,
} from '../types/agent';
import { SpeechState } from '../utils/speech';
import { ResponseActionBar } from './ResponseActionBar';
import { FRIENDLY_STAGE_LABELS, TECHNICAL_STAGE_LABELS } from '../config/brand';
import {
  evaluateMissionCelebration,
  shouldCelebrateStep,
} from '../utils/celebration';
import { SuccessCelebrationBanner } from './SuccessCelebrationBanner';
import { apiFetch } from '../services/workspaceService';
import { toFriendlyCustomerError, toFriendlyRecoveryNote } from '../utils/customerMessages';

interface ExecutionMonitorProps {
  mission: Mission;
  advancedMode?: boolean;
  animationsEnabled?: boolean;
  idToken?: string | null;
  onSelectArtifact?: (artifact: Artifact) => void;
  onViewReport?: () => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
  onRetryFailedTask?: (taskId: string) => void;
  onRetryPlanning?: () => void;
  onContinueWithEstimates?: () => void;
  onFinalizePartialDelivery?: () => void;
  onSubmitClarifications?: (answers: Record<string, string>) => void;
  onProceedWithPlaceholders?: () => void;
  onResumeMission?: () => void;
  onRefineInstruction?: (instruction: string) => void;
  isLoopRunning?: boolean;
  onRateResponse?: (
    responseId: string,
    rating: ResponseFeedbackRating | null,
    label?: string,
    snippet?: string
  ) => void;
  speechState?: SpeechState;
  onSpeak?: (responseId: string, text: string, label?: string) => void;
  onSpeakSequence?: () => void;
  onPauseSpeech?: () => void;
  onResumeSpeech?: () => void;
  onStopSpeech?: () => void;
}

const STAGE_ORDER: PhoenixStage[] = [
  'UNDERSTAND',
  'STRATEGISE',
  'EXECUTE',
  'COORDINATE',
  'VERIFY_RECOVER',
  'DELIVER',
];

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  mission,
  advancedMode = false,
  animationsEnabled = true,
  idToken = null,
  onSelectArtifact,
  onViewReport,
  onApproveTask,
  onRejectTask,
  onRetryFailedTask,
  onRetryPlanning,
  onContinueWithEstimates,
  onFinalizePartialDelivery,
  onSubmitClarifications,
  onProceedWithPlaceholders,
  onResumeMission,
  onRefineInstruction,
  isLoopRunning = true,
  onRateResponse,
  speechState,
  onSpeak,
  onSpeakSequence,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
}) => {
  const [clarificationInputs, setClarificationInputs] = useState<Record<string, string>>({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [liveElapsedMs, setLiveElapsedMs] = useState<number>(() => mission.elapsedMs || 0);

  // Connected inline assistant state
  const [companionInput, setCompanionInput] = useState('');
  const [companionTurns, setCompanionTurns] = useState<
    Array<{ id: string; role: 'user' | 'model'; text: string }>
  >([]);
  const [companionSending, setCompanionSending] = useState(false);
  const [companionError, setCompanionError] = useState<string | null>(null);
  const [failedCompanionPrompt, setFailedCompanionPrompt] = useState<string | null>(null);
  const [selectedLiveArtifactId, setSelectedLiveArtifactId] = useState<string | null>(null);

  useEffect(() => {
    setClarificationInputs({});
    setActiveQuestionIdx(0);
    setCompanionTurns([]);
    setCompanionError(null);
    setFailedCompanionPrompt(null);
    setSelectedLiveArtifactId(null);
  }, [mission.id]);

  // Auto-focus newest primary deliverable (prefer HTML prototype or latest document) when artifacts grow
  useEffect(() => {
    if (!mission.artifacts || mission.artifacts.length === 0) return;
    const stillExists = selectedLiveArtifactId
      ? mission.artifacts.some((a) => a.id === selectedLiveArtifactId)
      : false;
    const newest = mission.artifacts[mission.artifacts.length - 1];
    if (!stillExists) {
      setSelectedLiveArtifactId(newest.id);
    } else if (newest.format === 'html' || newest.name.endsWith('.html')) {
      setSelectedLiveArtifactId(newest.id);
    }
  }, [mission.artifacts.length]);

  useEffect(() => {
    const startEpoch = new Date(mission.startedAt).getTime();
    const isRunning = mission.status === 'planning' || mission.status === 'executing';
    if (!isRunning || Number.isNaN(startEpoch)) {
      setLiveElapsedMs(
        mission.performanceMetrics?.totalDurationMs ||
          mission.elapsedMs ||
          (!Number.isNaN(startEpoch) && mission.endedAt
            ? Math.max(0, new Date(mission.endedAt).getTime() - startEpoch)
            : 0)
      );
      return;
    }

    const tick = () => {
      setLiveElapsedMs(Math.max(0, Date.now() - startEpoch));
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [
    mission.id,
    mission.status,
    mission.startedAt,
    mission.endedAt,
    mission.elapsedMs,
    mission.performanceMetrics?.totalDurationMs,
  ]);

  const safeSpeechState: SpeechState = speechState || {
    supported: false,
    status: 'idle',
    activeId: null,
    isSequence: false,
    queueIndex: 0,
    queueTotal: 0,
    error: null,
  };
  const hasReadableResponses =
    !!mission.understanding ||
    mission.tasks.some((t) => !!t.reasoning) ||
    !!mission.report?.executiveSummary;

  const completedSteps = mission.tasks.filter((t) => t.status === 'completed').length;
  const skippedSteps = mission.tasks.filter((t) => t.status === 'skipped').length;
  const totalSteps = mission.tasks.length;
  const currentTask = mission.tasks.find((t) => t.id === mission.currentStepId);
  const runningTasks =
    mission.activeStepIds && mission.activeStepIds.length > 0
      ? mission.tasks.filter((t) => mission.activeStepIds!.includes(t.id) && t.status === 'running')
      : mission.tasks.filter((t) => t.status === 'running');
  const awaitingTask = mission.tasks.find((t) => t.status === 'awaiting_approval');
  const failedTask = mission.tasks.find((t) => t.status === 'failed');

  const isPlanning = mission.status === 'planning';
  const isAwaitingClarification = mission.status === 'awaiting_clarification';
  const isFinished = mission.status === 'completed';
  const isFailed = mission.status === 'failed';
  const isAwaitingApproval = mission.status === 'awaiting_approval' && !!awaitingTask;

  const realTasks = mission.tasks.filter((t) => t.toolType === 'REAL');
  const aiTasks = mission.tasks.filter((t) => t.toolType === 'LLM_REASONING');
  const simulatedTasks = mission.tasks.filter((t) => t.toolType === 'SIMULATED' || t.simulated);
  const approvalTasks = mission.tasks.filter((t) => t.requiresApproval);
  const failedTasks = mission.tasks.filter((t) => t.status === 'failed');

  const activeStage: PhoenixStage =
    mission.currentStage ||
    currentTask?.stage ||
    (isPlanning ? 'UNDERSTAND' : isFinished ? 'DELIVER' : isFailed ? 'VERIFY_RECOVER' : 'EXECUTE');
  const activeStageIndex = STAGE_ORDER.indexOf(activeStage);
  const stageLabels = advancedMode ? TECHNICAL_STAGE_LABELS : FRIENDLY_STAGE_LABELS;

  const questions =
    mission.understanding?.clarifyingQuestions && mission.understanding.clarifyingQuestions.length > 0
      ? mission.understanding.clarifyingQuestions
      : mission.understanding?.missingInformation || [];
  const safeQuestionIdx = Math.min(activeQuestionIdx, Math.max(0, questions.length - 1));
  const currentQuestion = questions[safeQuestionIdx] || '';

  const celebrationDecision = evaluateMissionCelebration(mission);
  const isDemoExample = Boolean(
    mission.understanding?.isDemoExample || mission.report?.isDemoExample
  );
  const demoExampleLabel =
    mission.understanding?.exampleLabel || mission.report?.exampleLabel || 'Illustrative example';

  const activeLiveArtifact =
    mission.artifacts.find((a) => a.id === selectedLiveArtifactId) ||
    mission.artifacts[mission.artifacts.length - 1] ||
    null;

  const handleDownloadLiveArtifact = (art: Artifact) => {
    const mime =
      art.format === 'html' || art.name.endsWith('.html')
        ? 'text/html'
        : art.format === 'json' || art.name.endsWith('.json')
        ? 'application/json'
        : 'text/plain';
    const blob = new Blob([art.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = art.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (mission.progress / 100) * circumference;

  const sendCompanionQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || companionSending) return;
    setCompanionError(null);
    setFailedCompanionPrompt(null);
    setCompanionSending(true);
    setCompanionInput('');

    const userId = `cmp-u-${Date.now()}`;
    setCompanionTurns((prev) => [...prev, { id: userId, role: 'user', text: trimmed }]);

    try {
      const done = mission.tasks.filter((t) => t.status === 'completed').length;
      const recentCompanionNotes = companionTurns
        .slice(-4)
        .map((t) => `${t.role === 'user' ? 'User' : 'PHOENIX'}: ${t.text}`)
        .join('\n');
      const contextStr = [
        `Project: ${mission.title}`,
        `Goal: ${mission.goal}`,
        `Status: ${mission.status} (${done}/${mission.tasks.length} steps finished)`,
        currentTask ? `Current step: ${currentTask.title}` : '',
        mission.understanding?.intendedOutcome
          ? `Outcome: ${mission.understanding.intendedOutcome}`
          : '',
        recentCompanionNotes ? `Recent inline Q&A:\n${recentCompanionNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const res = await apiFetch(
        '/api/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            model: 'gemini-3.1-flash-lite',
            systemPreset: 'strategist',
            useSearchGrounding: false,
            missionContext: contextStr,
          }),
        },
        idToken
      );
      const data = await res.json();
      if (!res.ok) {
        setCompanionError(data?.error || 'Could not reach PHOENIX right now.');
        setFailedCompanionPrompt(trimmed);
        setCompanionTurns((prev) => prev.filter((t) => t.id !== userId));
        setCompanionInput(trimmed);
        return;
      }
      setCompanionTurns((prev) => [
        ...prev,
        { id: `cmp-m-${Date.now()}`, role: 'model', text: data.reply || 'Done.' },
      ]);
    } catch (err: any) {
      setCompanionError(err?.message || 'Unable to send your message right now.');
      setFailedCompanionPrompt(trimmed);
      setCompanionTurns((prev) => prev.filter((t) => t.id !== userId));
      setCompanionInput(trimmed);
    } finally {
      setCompanionSending(false);
    }
  };

  const handleCompanionAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendCompanionQuestion(companionInput);
  };

  return (
    <div className="space-y-6">
      {/* 6-Stage Progress Strip */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border-amber-400/15 overflow-x-auto">
        <div className="flex items-center justify-between gap-2 min-w-[660px]">
          {STAGE_ORDER.map((stgId, idx) => {
            const isPast = isFinished || idx < activeStageIndex;
            const isActive = !isFinished && idx === activeStageIndex;
            const isStageError = isFailed && stgId === 'VERIFY_RECOVER';

            return (
              <div
                key={stgId}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                  isStageError
                    ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 font-semibold'
                    : isActive
                    ? 'bg-amber-500/15 border-amber-400/70 text-amber-200 font-semibold'
                    : isPast
                    ? 'bg-emerald-950/35 border-emerald-700/45 text-emerald-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <span className="truncate">{stageLabels[stgId]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Progress Banner */}
      <div className="glass-panel p-5 sm:p-7 rounded-2xl border-amber-400/20 relative overflow-hidden shadow-2xl">
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2.5 flex-1 text-center md:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-amber-300">
              <span>{stageLabels[activeStage]}</span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-slate-300 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                {(liveElapsedMs / 1000).toFixed(1)}s
              </span>
              {isDemoExample && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 font-semibold text-[11px]">
                    {demoExampleLabel}
                  </span>
                </>
              )}
              {advancedMode && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-cyan-300">{mission.persona}</span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
              {mission.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-2xl">
              {mission.understanding?.intendedOutcome || mission.goal}
            </p>
            {isDemoExample && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/35 border border-amber-400/35 text-xs text-amber-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  <strong>{demoExampleLabel}:</strong> Built with sample business figures, computed unit math, and a live interactive starter website.
                </span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-400">
                  {isPlanning ? (
                    'Understanding your goal and planning the steps...'
                  ) : (
                    <>
                      <span className="text-amber-300 font-semibold">{completedSteps}</span> of{' '}
                      {totalSteps} step{totalSteps === 1 ? '' : 's'} done
                      {skippedSteps > 0 ? ` (${skippedSteps} skipped)` : ''}
                    </>
                  )}
                </span>
                <span className="text-amber-300 font-semibold font-mono">
                  {Math.round(mission.progress)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    isFailed
                      ? 'bg-rose-500'
                      : isAwaitingApproval
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400'
                  }`}
                  style={{ width: `${mission.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right Circular Progress */}
          <div className="relative flex flex-col items-center justify-center shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke="#1E2337"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke={
                    isFailed
                      ? '#F43F5E'
                      : isAwaitingApproval
                      ? '#F59E0B'
                      : 'url(#phoenixGoldGrad)'
                  }
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 ease-out"
                />
                <defs>
                  <linearGradient id="phoenixGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="55%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black font-display text-white tabular-nums">
                  {Math.round(mission.progress)}%
                </span>
                <span className="text-[10px] text-amber-300 font-medium">
                  {isPlanning
                    ? 'Planning'
                    : isAwaitingClarification
                    ? 'Question'
                    : isAwaitingApproval
                    ? 'Approval'
                    : isFailed
                    ? 'Paused'
                    : isFinished
                    ? 'Done'
                    : 'Working'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Tool Counters — Visible in Advanced Mode only */}
        {advancedMode && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-5 mt-5 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-800/40">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <Calculator className="w-3 h-3 text-emerald-400" />
                Real Execution
              </div>
              <div className="text-sm font-mono font-bold text-emerald-300 mt-1 tabular-nums">
                {realTasks.filter((t) => t.status === 'completed').length} / {realTasks.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-800/40">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <Cpu className="w-3 h-3 text-purple-400" />
                AI Synthesis
              </div>
              <div className="text-sm font-mono font-bold text-purple-300 mt-1 tabular-nums">
                {aiTasks.filter((t) => t.status === 'completed').length} / {aiTasks.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-800/40">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                Simulated
              </div>
              <div className="text-sm font-mono font-bold text-cyan-300 mt-1 tabular-nums">
                {simulatedTasks.filter((t) => t.status === 'completed').length} / {simulatedTasks.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-800/40">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Approvals
              </div>
              <div className="text-sm font-mono font-bold text-amber-300 mt-1 tabular-nums">
                {approvalTasks.filter((t) => t.status === 'awaiting_approval').length} Pending
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-rose-800/40">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                Failures
              </div>
              <div className={`text-sm font-mono font-bold mt-1 tabular-nums ${failedTasks.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {failedTasks.length} Failed
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audio Reader (Optional clean bar) */}
      {hasReadableResponses && (advancedMode || safeSpeechState.status !== 'idle') && (
        <div className="glass-panel px-4 py-2.5 rounded-xl border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Volume2 className="w-4 h-4 text-amber-300" />
            <span>Read progress aloud</span>
            {safeSpeechState.isSequence && safeSpeechState.status !== 'idle' && (
              <span className="text-cyan-300 font-mono">
                ({safeSpeechState.queueIndex}/{safeSpeechState.queueTotal})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!safeSpeechState.supported ? (
              <span className="text-slate-500 text-[11px]">Voice reader unavailable</span>
            ) : safeSpeechState.isSequence && safeSpeechState.status === 'playing' ? (
              <>
                <button
                  type="button"
                  onClick={onPauseSpeech}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/60 text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  onClick={onStopSpeech}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </>
            ) : safeSpeechState.isSequence && safeSpeechState.status === 'paused' ? (
              <>
                <button
                  type="button"
                  onClick={onResumeSpeech}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/60 text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
                <button
                  type="button"
                  onClick={onStopSpeech}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSpeakSequence}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Listen</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Planning State */}
      {isPlanning && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-400/35 flex items-center gap-4">
          <div className="w-7 h-7 border-2 border-amber-300 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-amber-200 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-amber-300" />
              <span>Understanding your goal &amp; mapping out the best path</span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Breaking your request into clear, reliable steps so nothing important is guessed or skipped.
            </p>
          </div>
        </div>
      )}

      {/* Paused / Checkpoint Resume Card */}
      {(mission.status === 'paused' || (mission.status === 'executing' && !isLoopRunning)) && (
        <div className="glass-panel p-5 rounded-2xl border-amber-400/45 bg-amber-950/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              <span>Paused — your progress is saved</span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              {completedSteps} of {totalSteps} step(s) finished so far. Ready to continue right where we left off.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {(onContinueWithEstimates || onResumeMission) && (
              <button
                type="button"
                onClick={onContinueWithEstimates || onResumeMission}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-2 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Continue with estimates</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ONE QUESTION AT A TIME CLARIFICATION FLOW */}
      {isAwaitingClarification && questions.length > 0 && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-400/55 bg-slate-900/90 shadow-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-400/35 shrink-0">
              <MessageSquareMore className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-amber-300">
                Quick question {safeQuestionIdx + 1} of {questions.length}
              </div>
              <h3 className="text-base sm:text-lg font-display font-bold text-white">
                Let&apos;s make sure I get this right for you
              </h3>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                I never guess details like business names, pricing, or contact info. Answer one question at a time, or use placeholders if you&apos;d rather fill those in later.
              </p>
            </div>
          </div>

          {!advancedMode ? (
            /* Conversational Single-Question Stepper */
            <div className="p-4 rounded-xl bg-[#07080E]/90 border border-slate-800 space-y-3">
              <label
                htmlFor="phoenix-single-clarification"
                className="block text-sm font-medium text-white leading-snug"
              >
                {currentQuestion}
              </label>
              <input
                id="phoenix-single-clarification"
                type="text"
                value={clarificationInputs[currentQuestion] || ''}
                onChange={(e) =>
                  setClarificationInputs((prev) => ({
                    ...prev,
                    [currentQuestion]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (safeQuestionIdx < questions.length - 1) {
                      setActiveQuestionIdx((i) => i + 1);
                    } else if (onSubmitClarifications) {
                      onSubmitClarifications(clarificationInputs);
                    }
                  }
                }}
                placeholder="Type your answer here..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {safeQuestionIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveQuestionIdx((i) => Math.max(0, i - 1))}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                  {onProceedWithPlaceholders && (
                    <button
                      type="button"
                      onClick={onProceedWithPlaceholders}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer"
                    >
                      Use placeholders for all
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {safeQuestionIdx < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setActiveQuestionIdx((i) => i + 1)}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next question</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    onSubmitClarifications && (
                      <button
                        type="button"
                        onClick={() => onSubmitClarifications(clarificationInputs)}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Continue &amp; Build</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Advanced Mode shows all questions directly */
            <div className="space-y-3">
              {questions.map((question, idx) => (
                <div key={idx} className="space-y-1.5">
                  <label className="block text-xs font-sans font-medium text-slate-200">
                    {idx + 1}. {question}
                  </label>
                  <input
                    type="text"
                    value={clarificationInputs[question] || ''}
                    onChange={(e) =>
                      setClarificationInputs((prev) => ({
                        ...prev,
                        [question]: e.target.value,
                      }))
                    }
                    placeholder="Type your answer (leave blank to keep as a placeholder)..."
                    className="w-full rounded-xl bg-[#07080E]/90 border border-slate-700/80 focus:border-cyan-400 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none font-sans"
                  />
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {onSubmitClarifications && (
                  <button
                    type="button"
                    onClick={() => onSubmitClarifications(clarificationInputs)}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-display font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Details &amp; Build</span>
                  </button>
                )}
                {onProceedWithPlaceholders && (
                  <button
                    type="button"
                    onClick={onProceedWithPlaceholders}
                    className="min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                    <span>Proceed with [PLACEHOLDER] Markers</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <ResponseActionBar
            responseId={`resp-clarification-${mission.id}`}
            missionId={mission.id}
            label="Clarification Questions"
            textToCopy={questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
            textToSpeak={`Questions to clarify: ${questions.join('. ')}`}
            currentRating={mission.responseFeedback?.[`resp-clarification-${mission.id}`]?.rating}
            onRate={onRateResponse}
            speechState={safeSpeechState}
            onSpeak={onSpeak}
            onPauseSpeech={onPauseSpeech}
            onResumeSpeech={onResumeSpeech}
            onStopSpeech={onStopSpeech}
          />
        </div>
      )}

      {/* HUMAN APPROVAL GATE CARD */}
      {isAwaitingApproval && awaitingTask && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-400/65 bg-amber-950/20 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-amber-300">
                  Your approval is needed before this step runs
                </div>
                <h3 className="text-base sm:text-lg font-display font-bold text-white">
                  {awaitingTask.title}
                </h3>
                <p className="text-xs text-slate-200 font-sans leading-relaxed">
                  {awaitingTask.approvalReason ||
                    'This step affects external systems or sensitive actions, so we pause and ask you first.'}
                </p>
              </div>
            </div>
          </div>

          {awaitingTask.simulated && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-amber-200">
              Live external accounts are not connected here — approving creates a safe preview draft only, with no real external side effects.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onApproveTask && (
              <button
                type="button"
                onClick={() => onApproveTask(awaitingTask.id)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{awaitingTask.simulated ? 'Approve Preview Draft' : 'Approve & Continue'}</span>
              </button>
            )}
            {onRejectTask && (
              <button
                type="button"
                onClick={() => onRejectTask(awaitingTask.id)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 text-xs font-medium flex items-center gap-2 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
                <span>Skip This Step</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Parallel Running Wave Card */}
      {mission.status === 'executing' && runningTasks.length >= 2 && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-400/50 bg-cyan-950/15 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-300" />
              Working on {runningTasks.length} independent steps at the same time
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runningTasks.map((rt) => (
              <div
                key={rt.id}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/35 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  {advancedMode && (
                    <div className="text-[10px] font-mono text-cyan-300 uppercase">
                      {rt.stage} · {rt.tool} [{rt.toolType}]
                    </div>
                  )}
                  <div className="text-xs sm:text-sm font-display font-bold text-white truncate">
                    {rt.title}
                  </div>
                  <p className="text-xs text-slate-400 font-sans line-clamp-2">{rt.description}</p>
                </div>
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0 mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Active Step Card */}
      {currentTask && mission.status === 'executing' && runningTasks.length < 2 && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-500/45 shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-cyan-300">
                {advancedMode
                  ? `Executing · ${currentTask.stage} · ${currentTask.tool}`
                  : 'Currently working on'}
              </div>
              <h3 className="text-base sm:text-lg font-display font-bold text-white">
                {currentTask.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-sans">
                {currentTask.description}
              </p>
            </div>
            {advancedMode && (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded border bg-slate-900 text-cyan-300 border-slate-700 shrink-0">
                {currentTask.toolType}
              </span>
            )}
          </div>

          {currentTask.reasoning && (
            <div className="p-3.5 rounded-xl border border-cyan-800/30 bg-cyan-950/20 text-xs text-slate-200 space-y-2">
              {advancedMode && (
                <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] uppercase">
                  <Terminal className="w-3.5 h-3.5" />
                  Live Cognitive Stream
                </div>
              )}
              <p className="font-sans leading-relaxed">{currentTask.reasoning}</p>
              <ResponseActionBar
                responseId={`resp-task-${currentTask.id}`}
                missionId={mission.id}
                label={currentTask.title}
                textToCopy={currentTask.reasoning}
                textToSpeak={`${currentTask.title}. ${currentTask.reasoning}`}
                currentRating={mission.responseFeedback?.[`resp-task-${currentTask.id}`]?.rating}
                onRate={onRateResponse}
                speechState={safeSpeechState}
                onSpeak={onSpeak}
                onPauseSpeech={onPauseSpeech}
                onResumeSpeech={onResumeSpeech}
                onStopSpeech={onStopSpeech}
              />
            </div>
          )}
        </div>
      )}

      {/* Live Intermediate Deliverables Preview ("Ready So Far") */}
      {mission.artifacts.length > 0 && activeLiveArtifact && (
        <div className="glass-panel p-5 rounded-2xl border-amber-400/35 bg-[#090B14]/95 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>
                  {isFinished
                    ? `Deliverables Ready (${mission.artifacts.length})`
                    : `Ready So Far — Live Intermediate Deliverables (${mission.artifacts.length})`}
                </span>
                {isDemoExample && (
                  <span className="ml-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10px]">
                    {demoExampleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isFinished
                  ? 'Preview generated prototypes, strategies, and financial tables directly below.'
                  : 'Inspect finished outputs right away while remaining steps continue running.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onSelectArtifact && (
                <button
                  type="button"
                  onClick={() => onSelectArtifact(activeLiveArtifact)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-amber-200 font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full View</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownloadLiveArtifact(activeLiveArtifact)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs text-amber-200 font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {mission.artifacts.map((art) => {
              const selected = art.id === activeLiveArtifact.id;
              return (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setSelectedLiveArtifactId(art.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selected
                      ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span>{art.name}</span>
                </button>
              );
            })}
          </div>

          {activeLiveArtifact.format === 'html' || activeLiveArtifact.name.endsWith('.html') ? (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-white">
              <iframe
                title={`Live preview of ${activeLiveArtifact.name}`}
                srcDoc={activeLiveArtifact.content}
                sandbox="allow-scripts"
                className="w-full h-[360px] bg-white"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#06070D] p-4 max-h-72 overflow-y-auto">
              <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {activeLiveArtifact.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Level 1 Step Checklist (shows subtle gold check on genuine verified steps) */}
      {mission.tasks.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-300">
              {advancedMode ? 'Step Pipeline & Verification Status' : 'Step-by-step progress'}
            </h3>
            <span className="text-xs text-slate-400 tabular-nums">
              {completedSteps}/{totalSteps} finished
            </span>
          </div>

          <div className="space-y-2">
            {mission.tasks.map((task, idx) => {
              const goldVerified = shouldCelebrateStep(task);
              const isSimulatedDone =
                task.status === 'completed' && (task.toolType === 'SIMULATED' || task.simulated);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                    goldVerified
                      ? 'bg-amber-950/15 border-amber-400/35'
                      : task.status === 'failed'
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : task.status === 'running'
                      ? 'bg-cyan-950/20 border-cyan-500/40'
                      : 'bg-slate-900/50 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {goldVerified ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    ) : isSimulatedDone ? (
                      <ShieldCheck className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                    ) : task.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : task.status === 'running' ? (
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                    ) : task.status === 'awaiting_approval' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : task.status === 'skipped' ? (
                      <SkipForward className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}

                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs sm:text-sm font-medium text-slate-100">
                        <span className="text-slate-500 font-mono mr-1.5">{idx + 1}.</span>
                        {task.title}
                      </div>
                      {isSimulatedDone && (
                        <div className="text-[11px] text-amber-200/90">
                          Draft preview only — external service not connected
                        </div>
                      )}
                      {task.status === 'failed' && task.error && (
                        <div className="text-[11px] text-amber-200">
                          {toFriendlyCustomerError(task.error, task.tool)}
                        </div>
                      )}
                      {advancedMode && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {task.tool} [{task.toolType}] · {task.status}
                          {typeof task.executionTimeMs === 'number'
                            ? ` · ${Math.round(task.executionTimeMs)}ms`
                            : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {task.outputArtifact && onSelectArtifact && (
                    <button
                      type="button"
                      onClick={() => onSelectArtifact(task.outputArtifact!)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-200 shrink-0 cursor-pointer"
                    >
                      Open
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failure Recovery Panel */}
      {isFailed && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-500/45 bg-amber-950/15 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-display font-bold text-base text-white">
                We paused safely — ready to keep moving
              </h4>
              <p className="text-xs text-slate-200 font-sans">
                {failedTask
                  ? toFriendlyCustomerError(failedTask.error, failedTask.tool)
                  : 'A step could not finish on its own, and your completed work has been saved.'}
              </p>
              {failedTask?.recoveryStrategy && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-amber-200 font-sans">
                  {toFriendlyRecoveryNote(failedTask.recoveryStrategy, failedTask.tool)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onContinueWithEstimates && (
              <button
                type="button"
                onClick={onContinueWithEstimates}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-display font-bold text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Continue with estimates</span>
              </button>
            )}
            {failedTask && onRetryFailedTask && (
              <button
                type="button"
                onClick={() => onRetryFailedTask(failedTask.id)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/40 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try This Step Again</span>
              </button>
            )}
            {!failedTask && mission.tasks.length === 0 && onRetryPlanning && (
              <button
                type="button"
                onClick={onRetryPlanning}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/40 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Planning Again</span>
              </button>
            )}
            {onFinalizePartialDelivery && mission.tasks.length > 0 && (
              <button
                type="button"
                onClick={onFinalizePartialDelivery}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Review Completed Work So Far</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Truthful Celebration / Completion Callout */}
      {isFinished && (
        <SuccessCelebrationBanner
          decision={celebrationDecision}
          animationsEnabled={animationsEnabled}
          artifactCount={mission.artifacts.length}
          primaryActionLabel={
            celebrationDecision.allowCelebrate ? 'View Your Completed Work' : 'Review Results & Notes'
          }
          onPrimaryAction={onViewReport}
        />
      )}

      {/* Connected Mid-Mission Assistant & Follow-up Instruction Box */}
      <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-display font-bold text-white">
              Ask a question or adjust your goal
            </h4>
            <p className="text-xs text-slate-400">
              Ask PHOENIX about what&apos;s happening, or add new instructions using your saved context.
            </p>
          </div>
        </div>

        {companionTurns.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto p-3 rounded-xl bg-[#07080E] border border-slate-800">
            {companionTurns.map((turn) => (
              <div
                key={turn.id}
                className={`text-xs leading-relaxed p-2.5 rounded-lg ${
                  turn.role === 'user'
                    ? 'bg-purple-950/35 border border-purple-700/40 text-white ml-6'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 mr-6 whitespace-pre-wrap'
                }`}
              >
                <span className="font-semibold text-[11px] block mb-0.5 text-amber-300">
                  {turn.role === 'user' ? 'You' : 'PHOENIX'}
                </span>
                {turn.text}
              </div>
            ))}
          </div>
        )}

        {companionError && (
          <div className="text-xs text-rose-200 bg-rose-950/50 border border-rose-800/60 p-2.5 rounded-lg flex items-center justify-between gap-3">
            <span>{companionError}</span>
            {failedCompanionPrompt && (
              <button
                type="button"
                disabled={companionSending}
                onClick={() => void sendCompanionQuestion(failedCompanionPrompt)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/45 text-amber-200 font-medium flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleCompanionAsk} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={companionInput}
            onChange={(e) => setCompanionInput(e.target.value)}
            placeholder="Ask a question or type an updated instruction..."
            className="flex-1 min-h-[44px] bg-[#07080E] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={companionSending || !companionInput.trim()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-amber-300" />
              <span>{companionSending ? 'Asking...' : 'Ask'}</span>
            </button>

            {onRefineInstruction && (
              <button
                type="button"
                disabled={!companionInput.trim() || isPlanning}
                onClick={() => {
                  const text = companionInput.trim();
                  if (!text) return;
                  setCompanionInput('');
                  onRefineInstruction(text);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/45 text-amber-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Update the plan with this new instruction"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Apply Update</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Live Web Sources Checked */}
      {mission.groundingSources && mission.groundingSources.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-500/25 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-cyan-400" />
              Sources checked online ({mission.groundingSources.length})
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {mission.groundingSources.map((src, idx) => (
              <a
                key={`${src.uri}-${idx}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-700 text-xs text-cyan-200 transition-colors"
              >
                <span className="truncate max-w-[260px]">{src.title}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Deliverables Preview Grid */}
      {mission.artifacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-amber-300" />
              Files &amp; results created ({mission.artifacts.length})
            </h4>
            <span className="text-xs text-slate-500">Click to open or download</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {mission.artifacts.map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => onSelectArtifact && onSelectArtifact(art)}
                className={`glass-panel-interactive p-3.5 rounded-xl cursor-pointer group flex items-center justify-between text-left ${
                  art.isRealExecution
                    ? 'border-amber-400/40'
                    : art.validated
                    ? 'border-cyan-500/35'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg border bg-slate-900 border-slate-700 text-amber-300">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                      {art.name}
                    </div>
                    <div className="text-[11px] text-slate-400 uppercase">
                      {art.format}
                      {advancedMode &&
                        ` · ${
                          art.isRealExecution
                            ? 'REAL VERIFIED'
                            : art.validated
                            ? 'VALIDATED'
                            : 'GENERATED'
                        }`}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
