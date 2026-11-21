import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Terminal,
  FileCode,
  GitBranch,
  Eye,
  AlertCircle,
  Calculator,
  ShieldAlert,
  Brain,
  Compass,
  SkipForward,
  RefreshCw,
  Zap,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import {
  Task,
  Mission,
  Artifact,
  PhoenixStage,
  ResponseFeedbackRating,
} from '../types/agent';
import { SpeechState } from '../utils/speech';
import { ResponseActionBar } from './ResponseActionBar';

interface TaskPlannerViewProps {
  mission: Mission;
  onSelectArtifact?: (artifact: Artifact) => void;
  onRateResponse?: (
    responseId: string,
    rating: ResponseFeedbackRating | null,
    label?: string,
    snippet?: string
  ) => void;
  speechState?: SpeechState;
  onSpeak?: (responseId: string, text: string, label?: string) => void;
  onPauseSpeech?: () => void;
  onResumeSpeech?: () => void;
  onStopSpeech?: () => void;
}

export const TaskPlannerView: React.FC<TaskPlannerViewProps> = ({
  mission,
  onSelectArtifact,
  onRateResponse,
  speechState,
  onSpeak,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'dag'>('cards');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(
    mission.currentStepId || null
  );

  const safeSpeechState: SpeechState = speechState || {
    supported: false,
    status: 'idle',
    activeId: null,
    isSequence: false,
    queueIndex: 0,
    queueTotal: 0,
    error: null,
  };
  const understandingRespId = `resp-understanding-${mission.id}`;
  const isUnderstandingSpeaking = safeSpeechState.activeId === understandingRespId;

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'running':
        return (
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <div className="absolute w-2 h-2 rounded-full bg-cyan-400" />
          </div>
        );
      case 'retrying':
        return (
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <div className="absolute w-2 h-2 rounded-full bg-amber-400" />
          </div>
        );
      case 'awaiting_approval':
        return <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />;
      case 'skipped':
        return <SkipForward className="w-5 h-5 text-slate-400 shrink-0" />;
      case 'paused':
        return <Clock className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-slate-600 shrink-0" />;
    }
  };

  const getStageBadgeColor = (stage?: PhoenixStage) => {
    switch (stage) {
      case 'UNDERSTAND':
        return 'text-cyan-300 bg-cyan-950/70 border-cyan-700/50';
      case 'STRATEGISE':
        return 'text-purple-300 bg-purple-950/70 border-purple-700/50';
      case 'EXECUTE':
        return 'text-indigo-300 bg-indigo-950/70 border-indigo-700/50';
      case 'COORDINATE':
        return 'text-sky-300 bg-sky-950/70 border-sky-700/50';
      case 'VERIFY_RECOVER':
        return 'text-amber-300 bg-amber-950/70 border-amber-700/50';
      case 'DELIVER':
        return 'text-emerald-300 bg-emerald-950/70 border-emerald-700/50';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const isRealTool = (task: Task) => task.toolType === 'REAL';
  const isAiSynthesis = (task: Task) => task.toolType === 'LLM_REASONING';
  const dagAnalysis = mission.dagAnalysis || mission.understanding?.dagAnalysis;
  const deadlineAssessment =
    mission.deadlineAssessment || mission.understanding?.deadlineAssessment;

  return (
    <div className="space-y-6">
      {/* Stage 1 & 2: Understand & Strategise Intelligence Card */}
      {mission.understanding && (
        <div
          className={`glass-panel p-5 sm:p-6 rounded-2xl space-y-4 transition-all ${
            isUnderstandingSpeaking
              ? 'border-cyan-400/80 ring-1 ring-cyan-400/50 bg-cyan-950/15'
              : 'border-cyan-500/25'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">
                Stage 1 &amp; 2 · Goal Understanding &amp; Strategy
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              INTENTION ANALYSIS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                Intended Outcome
              </div>
              <p className="text-slate-200 font-sans leading-relaxed">
                {mission.understanding.intendedOutcome}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-mono text-purple-400 uppercase font-semibold flex items-center gap-1">
                <Compass className="w-3 h-3" />
                Strategic Approach
              </div>
              <p className="text-slate-200 font-sans leading-relaxed">
                {mission.understanding.strategySummary}
              </p>
            </div>
          </div>

          {/* Supplied Facts & Contradiction Alerts */}
          {(mission.understanding.suppliedInformation?.length ||
            mission.understanding.contradictionsDetected?.length) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {mission.understanding.suppliedInformation &&
                mission.understanding.suppliedInformation.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1">
                    <span className="text-[10px] font-mono text-emerald-300 uppercase font-semibold block">
                      User-Supplied Requirements Extracted
                    </span>
                    <ul className="space-y-1 text-emerald-100/90 font-sans">
                      {mission.understanding.suppliedInformation.map((info, idx) => (
                        <li key={idx}>• {info}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {mission.understanding.contradictionsDetected &&
                mission.understanding.contradictionsDetected.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-700/50 space-y-1">
                    <span className="text-[10px] font-mono text-rose-300 uppercase font-semibold block">
                      Contradictions Detected in Goal
                    </span>
                    <ul className="space-y-1 text-rose-200 font-sans">
                      {mission.understanding.contradictionsDetected.map((c, idx) => (
                        <li key={idx}>! {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-mono text-amber-300 uppercase font-semibold block">
                Resource Constraints
              </span>
              <ul className="space-y-1 text-slate-300 font-sans">
                {mission.understanding.resourceConstraints.map((c, idx) => (
                  <li key={idx}>• {c}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-mono text-emerald-300 uppercase font-semibold block">
                Opportunities
              </span>
              <ul className="space-y-1 text-slate-300 font-sans">
                {mission.understanding.opportunities.map((o, idx) => (
                  <li key={idx}>+ {o}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-mono text-rose-300 uppercase font-semibold block">
                Risks &amp; Unprovided Placeholders
              </span>
              <ul className="space-y-1 text-slate-300 font-sans">
                {mission.understanding.risks.map((r, idx) => (
                  <li key={`r-${idx}`}>! {r}</li>
                ))}
                {mission.understanding.missingInformation.map((m, idx) => (
                  <li key={`m-${idx}`} className="text-slate-400">? {m}</li>
                ))}
              </ul>
            </div>
          </div>

          <ResponseActionBar
            responseId={understandingRespId}
            missionId={mission.id}
            label="Stage 1 & 2 Intention Analysis"
            textToCopy={`Intended Outcome: ${mission.understanding.intendedOutcome}\n\nStrategy: ${mission.understanding.strategySummary}\n\nSupplied: ${(mission.understanding.suppliedInformation || []).join('; ') || 'None'}\nMissing/Placeholders: ${mission.understanding.missingInformation.join('; ') || 'None'}`}
            textToSpeak={`Intended outcome: ${mission.understanding.intendedOutcome}. Strategy: ${mission.understanding.strategySummary}.`}
            currentRating={mission.responseFeedback?.[understandingRespId]?.rating}
            onRate={onRateResponse}
            speechState={safeSpeechState}
            onSpeak={onSpeak}
            onPauseSpeech={onPauseSpeech}
            onResumeSpeech={onResumeSpeech}
            onStopSpeech={onStopSpeech}
          />
        </div>
      )}

      {/* Parallel DAG Speed & Deadline Intelligence Card */}
      {(dagAnalysis || deadlineAssessment) && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-500/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">
                Parallel Wave &amp; Critical-Path Optimization
              </h3>
            </div>
            {dagAnalysis && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 tabular-nums">
                {dagAnalysis.totalWaves} Wave(s) · Max Concurrency: {dagAnalysis.maxParallelism}x
              </span>
            )}
          </div>

          {dagAnalysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Sequential Est.</span>
                <span className="text-slate-200 font-bold text-sm tabular-nums">
                  {(dagAnalysis.estimatedSequentialMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-800/40">
                <span className="text-[10px] text-cyan-400 uppercase block">Parallel Wave Est.</span>
                <span className="text-cyan-200 font-bold text-sm tabular-nums">
                  {(dagAnalysis.estimatedParallelMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-800/40">
                <span className="text-[10px] text-emerald-400 uppercase block">Est. Time Saved</span>
                <span className="text-emerald-300 font-bold text-sm tabular-nums">
                  {(dagAnalysis.estimatedTimeSavedMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-purple-800/40">
                <span className="text-[10px] text-purple-300 uppercase block">Critical Path</span>
                <span className="text-purple-200 font-bold text-sm tabular-nums">
                  {dagAnalysis.criticalPathIds.length} steps ({(dagAnalysis.criticalPathEstimateMs / 1000).toFixed(1)}s)
                </span>
              </div>
            </div>
          )}

          {deadlineAssessment && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                deadlineAssessment.realistic
                  ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-100'
                  : 'bg-amber-950/30 border-amber-500/50 text-amber-100'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold">
                <span className="flex items-center gap-1.5">
                  {deadlineAssessment.realistic ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    Deadline Target ({deadlineAssessment.requestedDeadline}):{' '}
                    {deadlineAssessment.realistic ? 'FEASIBLE' : 'UNREALISTIC WITHOUT COMPROMISE'}
                  </span>
                </span>
                <span className="text-slate-300 tabular-nums">
                  Fastest Safe Est: {(deadlineAssessment.fastestAchievableMs / 1000).toFixed(1)}s
                </span>
              </div>
              <p className="font-sans leading-relaxed text-slate-200">
                {deadlineAssessment.explanation}
              </p>
              {deadlineAssessment.alternativePlan && (
                <p className="font-sans text-[11px] text-cyan-200 border-t border-slate-800/80 pt-1.5">
                  <strong className="font-mono text-cyan-300">Fastest Safe Alternative:</strong>{' '}
                  {deadlineAssessment.alternativePlan}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Header bar with summary & view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-purple-900/30">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display font-bold text-base text-slate-100">
              Six-Stage Coordinated Execution Graph
            </h3>
            <span className="text-xs font-mono text-purple-300 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/40">
              {mission.tasks.length} Steps
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Distinguishes genuine backend tools, Gemini synthesis deliverables, simulated workflows, and human approval gates.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                viewMode === 'cards'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Step Cards
            </button>
            <button
              onClick={() => setViewMode('dag')}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                viewMode === 'dag'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Interactive Flow
            </button>
          </div>
        </div>
      </div>

      {/* DAG Flow Visualizer View */}
      {viewMode === 'dag' && (
        <div className="glass-panel p-6 rounded-2xl border-purple-500/20 overflow-x-auto">
          <div className="min-w-[720px] flex items-center justify-between relative py-6 gap-2">
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-purple-800 via-indigo-700 to-cyan-800 -translate-y-1/2 z-0" />

            {mission.tasks.map((task, idx) => {
              const isCurrent = mission.currentStepId === task.id;
              const isDone = task.status === 'completed';
              const isReal = isRealTool(task);
              const isAi = isAiSynthesis(task);
              return (
                <div
                  key={task.id}
                  className="relative z-10 flex flex-col items-center group max-w-[140px]"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isDone
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                        : task.status === 'failed'
                        ? 'bg-rose-950 border-rose-500 text-rose-400'
                        : task.status === 'awaiting_approval'
                        ? 'bg-amber-950 border-amber-400 text-amber-300 animate-pulse'
                        : isCurrent
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/30 ring-4 ring-cyan-500/20 animate-pulse'
                        : 'bg-slate-900 border-slate-700 text-slate-500 group-hover:border-slate-500'
                    }`}
                    onClick={() => {
                      setViewMode('cards');
                      setExpandedTaskId(task.id);
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : task.requiresApproval ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <span className="font-mono text-xs font-bold">0{idx + 1}</span>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${getStageBadgeColor(
                        task.stage
                      )}`}
                    >
                      {task.stage || task.phase}
                    </span>
                    <h5 className="font-sans font-medium text-xs text-slate-200 mt-1 line-clamp-2">
                      {task.title}
                    </h5>
                    <span
                      className={`text-[10px] font-mono mt-0.5 block ${
                        isReal
                          ? 'text-emerald-400 font-bold'
                          : isAi
                          ? 'text-purple-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {isReal ? '[REAL TOOL]' : isAi ? '[AI SYNTHESIS]' : '[SIMULATED]'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step Cards List View */}
      <div className="space-y-3">
        {mission.tasks.map((task, idx) => {
          const isCurrent = mission.currentStepId === task.id;
          const isExpanded = expandedTaskId === task.id;
          const isReal = isRealTool(task);
          const isAi = isAiSynthesis(task);

          return (
            <div
              key={task.id}
              className={`glass-panel rounded-xl border transition-all overflow-hidden ${
                task.status === 'awaiting_approval'
                  ? 'border-amber-400/80 bg-amber-950/20 ring-1 ring-amber-500/30'
                  : isCurrent
                  ? 'border-cyan-400/80 bg-slate-900/90 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : task.status === 'completed'
                  ? 'border-purple-900/40 bg-slate-950/60'
                  : task.status === 'failed'
                  ? 'border-rose-500/50 bg-rose-950/20'
                  : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div
                className="p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer select-none"
                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="pt-0.5">{getStatusIcon(task.status)}</div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        STEP #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStageBadgeColor(
                          task.stage
                        )}`}
                      >
                        {task.stage || task.phase}
                      </span>
                      {isReal ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          REAL BACKEND TOOL
                        </span>
                      ) : isAi ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-700/60">
                          AI SYNTHESIS (GEMINI)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700">
                          SIMULATED WORKFLOW
                        </span>
                      )}

                      {typeof task.waveIndex === 'number' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-cyan-800/50 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          WAVE #{task.waveIndex + 1}
                        </span>
                      )}

                      {task.isCriticalPath && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/90 text-purple-200 border border-purple-500/60 font-bold">
                          CRITICAL PATH
                        </span>
                      )}

                      {task.canRunInParallel && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-200 border border-cyan-600/50">
                          PARALLEL READY
                        </span>
                      )}

                      {task.reusedCachedResult && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                          CACHED REUSE
                        </span>
                      )}

                      {task.requiresApproval && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                            task.approvalStatus === 'approved'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : task.approvalStatus === 'rejected'
                              ? 'bg-slate-900 text-slate-400 border-slate-700'
                              : 'bg-amber-950 text-amber-300 border-amber-500/60 font-bold'
                          }`}
                        >
                          <ShieldAlert className="w-3 h-3" />
                          {task.approvalStatus === 'approved'
                            ? 'OPERATOR APPROVED'
                            : task.approvalStatus === 'rejected'
                            ? 'OPERATOR DECLINED'
                            : 'APPROVAL GATE'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-display font-bold text-sm sm:text-base text-slate-100 truncate">
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-sans line-clamp-1">
                      {task.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-end gap-1 tabular-nums">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {typeof task.executionTimeMs === 'number'
                        ? `${Math.round(task.executionTimeMs)}ms actual`
                        : `${task.estimatedDurationSec}s est`}
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                      {task.tool}
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono ml-1">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Expanded Details Pane */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-black/30 space-y-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono text-slate-400 uppercase">
                      Operational Specification:
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                      {task.description}
                    </p>
                  </div>

                  {task.dependencies && task.dependencies.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="text-slate-500 uppercase">Coordinated Upstream Inputs:</span>
                      {task.dependencies.map((dep) => (
                        <span
                          key={dep}
                          className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-300"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}

                  {task.requiresApproval && (
                    <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-700/40 text-xs font-sans text-amber-200 space-y-1">
                      <div className="font-mono text-[11px] font-bold text-amber-300 uppercase flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Human Approval Policy ({task.approvalActionType || 'Sensitive Action'})
                      </div>
                      <p>{task.approvalReason || 'Requires explicit operator confirmation before execution.'}</p>
                    </div>
                  )}

                  {/* Genuine Tool Execution Card */}
                  {isReal && task.toolOutput && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5 uppercase text-[11px]">
                          <Calculator className="w-3.5 h-3.5" />
                          Genuine Tool Execution Evidence
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 text-[10px] border border-emerald-700">
                          {task.verificationPassed ? 'VERIFIED PASS' : 'VERIFICATION FAILED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Tool Name</span>
                          <span className="text-white font-bold">{task.tool}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Input</span>
                          <span className="text-cyan-300 font-bold break-all">
                            {task.toolInput?.expression ||
                              task.toolOutput.inputExpression ||
                              task.toolInput?.fileName ||
                              (task.toolInput?.artifactsChecked !== undefined
                                ? `${task.toolInput.artifactsChecked} artifacts`
                                : JSON.stringify(task.toolInput || {}))}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Actual Output</span>
                          <span className="text-emerald-300 font-bold text-xs break-all">
                            {task.toolOutput.result !== undefined
                              ? String(task.toolOutput.result)
                              : task.toolOutput.passedArtifacts !== undefined
                              ? `${task.toolOutput.passedArtifacts}/${task.toolOutput.artifactsChecked} Validated`
                              : task.toolOutput.byteLength !== undefined
                              ? `${task.toolOutput.fileName}: ${task.toolOutput.byteLength}B OK`
                              : JSON.stringify(task.toolOutput)}
                          </span>
                        </div>
                      </div>
                      {task.verificationEvidence && (
                        <div className="text-[10px] text-slate-300">
                          Verification: <span className="text-emerald-300">{task.verificationEvidence}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error & Recovery Pane */}
                  {task.error && (
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 font-mono text-xs text-rose-300 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 uppercase text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        Recorded Execution Error {(task.retryCount || 0) > 0 ? `(Retries: ${task.retryCount})` : ''}
                      </div>
                      <p className="font-sans text-rose-200">{task.error}</p>
                      {task.recoveryStrategy && (
                        <div className="pt-1 border-t border-rose-800/40 text-amber-200 font-sans flex items-start gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{task.recoveryStrategy}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Assigned Tool</span>
                      <span className="text-cyan-300 font-semibold">{task.tool}</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        {isReal
                          ? 'Real deterministic engine (backend evaluated)'
                          : isAi
                          ? 'Live Gemini 4 Flash deliverable synthesis'
                          : 'Safe demo simulation container'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Expected Deliverable</span>
                      <span className="text-purple-300 font-semibold">{task.expectedArtifact}</span>
                    </div>
                  </div>

                  {/* Real-time reasoning trace with Conversational Controls */}
                  {task.reasoning && (
                    <div
                      className={`p-3 rounded-xl border transition-all space-y-1 ${
                        safeSpeechState.activeId === `resp-task-${task.id}`
                          ? 'bg-cyan-950/35 border-cyan-400/70 ring-1 ring-cyan-400/40'
                          : 'bg-cyan-950/20 border-cyan-800/30'
                      }`}
                    >
                      <span className="text-[11px] font-mono text-cyan-400 uppercase flex items-center gap-1.5 font-semibold">
                        <Terminal className="w-3.5 h-3.5" />
                        Agent Cognitive Reasoning &amp; Execution Trace
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {task.reasoning}
                      </p>
                      <ResponseActionBar
                        responseId={`resp-task-${task.id}`}
                        missionId={mission.id}
                        label={`Step #${idx + 1}: ${task.title}`}
                        textToCopy={`${task.title}\nTool: ${task.tool} (${task.toolType})\n\n${task.reasoning}`}
                        textToSpeak={`Step ${idx + 1}, ${task.title}. ${task.reasoning}`}
                        currentRating={mission.responseFeedback?.[`resp-task-${task.id}`]?.rating}
                        onRate={onRateResponse}
                        speechState={safeSpeechState}
                        onSpeak={onSpeak}
                        onPauseSpeech={onPauseSpeech}
                        onResumeSpeech={onResumeSpeech}
                        onStopSpeech={onStopSpeech}
                      />
                    </div>
                  )}

                  {/* Output Artifact link */}
                  {task.outputArtifact && onSelectArtifact && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-950/30 border border-purple-800/40">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-xs font-mono text-purple-200 font-semibold">
                            {task.outputArtifact.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Format: {task.outputArtifact.format.toUpperCase()} •{' '}
                            {task.outputArtifact.isRealExecution
                              ? 'REAL VERIFIED'
                              : task.simulated
                              ? 'SIMULATED DRAFT'
                              : 'AI DELIVERABLE'}
                            {task.outputArtifact.validated ? ' • VALIDATED' : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onSelectArtifact(task.outputArtifact!)}
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Deliverable</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
