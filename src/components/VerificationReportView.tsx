import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Download,
  Sparkles,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  XCircle,
  Calculator,
  Cpu,
  ShieldAlert,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Clock,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  VerificationReport,
  Artifact,
  Mission,
  ResponseFeedbackRating,
  VerificationLayerDetail,
} from '../types/agent';
import { SpeechState } from '../utils/speech';
import { ResponseActionBar } from './ResponseActionBar';
import { evaluateMissionCelebration } from '../utils/celebration';
import { SuccessCelebrationBanner } from './SuccessCelebrationBanner';
import { toFriendlyCustomerError } from '../utils/customerMessages';

interface VerificationReportViewProps {
  report: VerificationReport;
  mission: Mission;
  advancedMode?: boolean;
  animationsEnabled?: boolean;
  onToggleAdvancedMode?: () => void;
  onSelectArtifact?: (artifact: Artifact) => void;
  onRerun: () => void;
  onForkGoal: () => void;
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

export const VerificationReportView: React.FC<VerificationReportViewProps> = ({
  report,
  mission,
  advancedMode = false,
  animationsEnabled = true,
  onToggleAdvancedMode,
  onSelectArtifact,
  onRerun,
  onForkGoal,
  onRateResponse,
  speechState,
  onSpeak,
  onSpeakSequence,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
}) => {
  const safeSpeechState: SpeechState = speechState || {
    supported: false,
    status: 'idle',
    activeId: null,
    isSequence: false,
    queueIndex: 0,
    queueTotal: 0,
    error: null,
  };
  const summaryRespId = `resp-summary-${mission.id}`;
  const recRespId = `resp-recommendations-${mission.id}`;

  const feedbackEntries = Object.values(mission.responseFeedback || {});
  const likeCount = feedbackEntries.filter((f) => f.rating === 'up').length;
  const dislikeCount = feedbackEntries.filter((f) => f.rating === 'down').length;

  const failedSteps = report.metrics.failedSteps ?? 0;
  const skippedSteps = report.metrics.skippedSteps ?? 0;
  const llmReasoningSteps = report.metrics.llmReasoningSteps ?? 0;
  const simulatedToolsRun = report.metrics.simulatedToolsRun ?? 0;
  const realToolsExecuted = report.metrics.realToolsExecuted ?? 0;

  // Compute backward-compatible 10-point fields if viewing an older saved mission
  const overallStatus =
    report.overallMissionStatus ||
    (mission.tasks.some((t) => t.status === 'awaiting_approval')
      ? 'awaiting approval'
      : failedSteps > 0 && report.metrics.verifiedSteps === 0
      ? 'failed'
      : failedSteps > 0 || skippedSteps > 0
      ? 'partially completed'
      : 'completed');

  const userGoal = report.userGoal || mission.goal;
  const requirementsUnderstood = report.requirementsUnderstood || {
    outcome: mission.understanding?.intendedOutcome || `Deliver verifiable work for: ${mission.goal}`,
    constraints: mission.understanding?.resourceConstraints || ['Safe execution boundary; no fabricated details'],
    missingInformation: mission.understanding?.missingInformation || [],
    userSuppliedDetails: mission.clarificationAnswers
      ? Object.entries(mission.clarificationAnswers).map(([q, a]) => `${q} -> ${a}`)
      : [],
  };
  const executionPlanSummary =
    report.executionPlanSummary ||
    mission.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      stage: t.stage || t.phase,
      tool: t.tool,
      toolType: t.toolType,
      status: t.status,
    }));

  const realExecutedTasks = mission.tasks.filter(
    (t) => t.toolType === 'REAL' && t.status === 'completed'
  );
  const aiReasoningTasks = mission.tasks.filter(
    (t) => t.toolType === 'LLM_REASONING' && t.status === 'completed'
  );
  const simulatedTasks = mission.tasks.filter(
    (t) => (t.toolType === 'SIMULATED' || t.simulated) && t.status === 'completed'
  );
  const approvalGatedTasks = mission.tasks.filter((t) => t.requiresApproval);
  const failedTasks = mission.tasks.filter((t) => t.status === 'failed');

  const toolsActuallyUsed = report.toolsActuallyUsed || {
    realTools: Array.from(new Set(realExecutedTasks.map((t) => t.tool))),
    aiReasoning: aiReasoningTasks.map((t) => `${t.tool} (${t.title})`),
    simulatedTools: Array.from(new Set(simulatedTasks.map((t) => t.tool))),
  };

  const actionsCompleted =
    report.completedWorkSummary && report.completedWorkSummary.length > 0
      ? report.completedWorkSummary
      : mission.tasks.filter((t) => t.status === 'completed').map((t) => `[${t.toolType}] ${t.title}`);

  const verificationEvidenceList =
    report.verificationEvidenceList ||
    mission.tasks
      .filter((t) => t.status === 'completed' && t.verificationEvidence)
      .map((t) => `${t.tool}: ${t.verificationEvidence}`);

  const failuresOrLimitations =
    report.failuresOrLimitations || [
      ...(report.unresolvedIssues || []),
      ...(simulatedToolsRun > 0
        ? ['Simulated workflows ran inside a safe demo sandbox and did NOT execute real external actions.']
        : []),
    ];

  const itemsRequiringApproval =
    report.itemsRequiringApproval ||
    approvalGatedTasks.map((t) => ({
      stepTitle: t.title,
      tool: t.tool,
      reason: t.approvalReason || 'Operator approval required before external action.',
      approvalStatus: t.approvalStatus || 'pending_approval',
    }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'VERIFIED_SATISFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5" />
            STATUS: {overallStatus}
          </span>
        );
      case 'awaiting approval':
      case 'partially completed':
      case 'CONDITIONALLY_VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            STATUS: {overallStatus}
          </span>
        );
      case 'PARTIAL_FAILURE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-rose-300 border border-rose-500/50 uppercase">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            STATUS: {overallStatus}
          </span>
        );
      case 'failed':
      case 'FAILED_VALIDATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 uppercase">
            <XCircle className="w-3.5 h-3.5" />
            STATUS: {overallStatus}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            {overallStatus}
          </span>
        );
    }
  };

  const scoreRingColor =
    overallStatus === 'failed' || report.satisfactionScore < 50
      ? '#F43F5E'
      : overallStatus === 'partially completed' || overallStatus === 'awaiting approval'
      ? '#F59E0B'
      : '#10B981';

  const handleDownloadReport = () => {
    const reportMarkdown = `# PHOENIX MISSION DELIVERY & VERIFICATION REPORT
**Mission:** ${mission.title}
**Score:** ${report.satisfactionScore} / 100
**Date:** ${new Date().toISOString()}

---

## 1. USER'S GOAL
${userGoal}

## 2. REQUIREMENTS UNDERSTOOD
- **Intended Outcome:** ${requirementsUnderstood.outcome}
- **Constraints:** ${requirementsUnderstood.constraints.join('; ') || 'None specified'}
${requirementsUnderstood.userSuppliedDetails && requirementsUnderstood.userSuppliedDetails.length > 0 ? `- **User-Supplied Clarifications:**\n${requirementsUnderstood.userSuppliedDetails.map((d) => `  - ${d}`).join('\n')}` : ''}
${requirementsUnderstood.missingInformation.length > 0 ? `- **Missing / Placeholder Items:** ${requirementsUnderstood.missingInformation.join('; ')}` : ''}

## 3. EXECUTION PLAN
${executionPlanSummary.map((s, i) => `${i + 1}. **${s.title}** [${s.stage}] — Tool: \`${s.tool}\` (${s.toolType}) — Status: \`${s.status}\``).join('\n')}

## 4. TOOLS ACTUALLY USED
- **Real Backend Tools:** ${toolsActuallyUsed.realTools.join(', ') || 'None'}
- **AI Reasoning / Synthesis:** ${toolsActuallyUsed.aiReasoning.join(', ') || 'None'}
- **Simulated Tools (No Real External Action):** ${toolsActuallyUsed.simulatedTools.join(', ') || 'None'}

## 5. ACTIONS COMPLETED
${actionsCompleted.length > 0 ? actionsCompleted.map((c) => `- ${c}`).join('\n') : '- No steps completed.'}

## 6. VERIFICATION EVIDENCE
${verificationEvidenceList.length > 0 ? verificationEvidenceList.map((e) => `- ${e}`).join('\n') : '- No verification evidence recorded.'}

## 7. FAILURES OR LIMITATIONS
${failuresOrLimitations.length > 0 ? failuresOrLimitations.map((f) => `- ${f}`).join('\n') : '- None reported.'}

## 8. ITEMS REQUIRING USER APPROVAL
${itemsRequiringApproval.length > 0 ? itemsRequiringApproval.map((a) => `- **${a.stepTitle}** (${a.tool}) — Status: ${a.approvalStatus} — ${a.reason}`).join('\n') : '- None'}

## 9. FINAL DELIVERABLES
${report.verifiedArtifacts.length > 0 ? report.verifiedArtifacts.map((a) => `- **${a.title}** [${a.status}]: ${a.summary}`).join('\n') : '- None'}

## 10. OVERALL MISSION STATUS
**${overallStatus}**

${
  report.performanceMetrics
    ? `---

## SPEED, PARALLELISM & TIME TELEMETRY
- **Total Duration:** ${(report.performanceMetrics.totalDurationMs / 1000).toFixed(2)}s (Understand: ${report.performanceMetrics.understandMs}ms · Plan: ${report.performanceMetrics.planMs}ms · Execute: ${report.performanceMetrics.executionMs}ms · Verify: ${report.performanceMetrics.verificationMs}ms · Recovery: ${report.performanceMetrics.recoveryMs}ms)
- **Sequential Equivalent:** ${(report.performanceMetrics.sequentialEquivalentMs / 1000).toFixed(2)}s vs **Actual Parallel Wall-Clock:** ${(report.performanceMetrics.actualWaveWallClockMs / 1000).toFixed(2)}s (Saved ${(report.performanceMetrics.timeSavedByParallelMs / 1000).toFixed(2)}s across ${report.performanceMetrics.parallelWavesExecuted} parallel wave(s), max ${report.performanceMetrics.maxConcurrencyAchieved}x concurrency)
- **Bottleneck Diagnosis:** ${report.performanceMetrics.bottleneckReason}
${report.performanceMetrics.comparedToPrevious ? `- **Historical Benchmark:** ${report.performanceMetrics.comparedToPrevious.summary}` : ''}
`
    : ''
}${
  report.groundingSources && report.groundingSources.length > 0
    ? `---

## GOOGLE SEARCH GROUNDING SOURCES (${report.groundingSources.length})
${report.groundingSources.map((s, i) => `${i + 1}. [${s.title}](${s.uri})`).join('\n')}
`
    : ''
}
---

### Executive Summary & Next Steps
${report.executiveSummary}

${report.humanRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;

    const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phoenix_delivery_${mission.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const celebrationDecision = evaluateMissionCelebration(mission, report);
  const primaryArtifact = mission.artifacts[0];
  const isDemoExample = Boolean(
    report.isDemoExample || mission.understanding?.isDemoExample
  );
  const demoExampleLabel =
    report.exampleLabel || mission.understanding?.exampleLabel || 'Illustrative example';

  if (!advancedMode) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-2">
        <SuccessCelebrationBanner
          decision={celebrationDecision}
          animationsEnabled={animationsEnabled}
          artifactCount={mission.artifacts.length}
          primaryActionLabel={primaryArtifact ? `Open ${primaryArtifact.name}` : undefined}
          onPrimaryAction={
            primaryArtifact && onSelectArtifact
              ? () => onSelectArtifact(primaryArtifact)
              : undefined
          }
        />

        {/* Friendly Summary Card */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-amber-300">What we accomplished</span>
              {isDemoExample && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 font-semibold text-[11px]">
                  {demoExampleLabel}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
              {mission.title}
            </h2>
            <p className="text-sm text-slate-200 font-sans leading-relaxed">
              {report.executiveSummary}
            </p>
          </div>

          {(simulatedToolsRun > 0 || failedSteps > 0 || skippedSteps > 0) && (
            <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/40 text-xs text-amber-100 leading-relaxed">
              <strong>Good to know:</strong> {report.environmentNote}
            </div>
          )}

          <ResponseActionBar
            responseId={summaryRespId}
            missionId={mission.id}
            label="Summary"
            textToCopy={`${mission.title}\n${report.executiveSummary}`}
            textToSpeak={report.executiveSummary}
            currentRating={mission.responseFeedback?.[summaryRespId]?.rating}
            onRate={onRateResponse}
            speechState={safeSpeechState}
            onSpeak={onSpeak}
            onPauseSpeech={onPauseSpeech}
            onResumeSpeech={onResumeSpeech}
            onStopSpeech={onStopSpeech}
          />
        </div>

        {/* Ready Files */}
        {mission.artifacts.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl border-amber-400/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-300" />
                <span>Your Ready Files ({mission.artifacts.length})</span>
              </h3>
              <span className="text-xs text-slate-400">Click any file to view or download</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mission.artifacts.map((art) => {
                const isHtml = art.format === 'html' || art.name.endsWith('.html');
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => onSelectArtifact && onSelectArtifact(art)}
                    className="p-4 rounded-xl bg-slate-900/75 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-left flex items-center justify-between gap-3 transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-sm font-semibold text-white group-hover:text-amber-300 truncate">
                        {art.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isHtml ? 'Interactive prototype preview' : `${art.format.toUpperCase()} file`}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-300 flex items-center gap-1 shrink-0">
                      <span>{isHtml ? 'Preview' : 'Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sources Checked */}
        {report.groundingSources && report.groundingSources.length > 0 && (
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              <span>Web sources used ({report.groundingSources.length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {report.groundingSources.map((src, idx) => (
                <a
                  key={`${src.uri}-${idx}`}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-cyan-200"
                >
                  <span className="truncate max-w-[240px]">{src.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Helpful Next Steps */}
        {report.humanRecommendations.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
            <h3 className="font-display font-bold text-sm text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Suggested Next Steps</span>
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-200 font-sans">
              {report.humanRecommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800"
                >
                  <span className="text-amber-300 font-semibold">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 glass-panel rounded-2xl border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Save Summary (.md)</span>
            </button>
            {onToggleAdvancedMode && (
              <button
                type="button"
                onClick={onToggleAdvancedMode}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs cursor-pointer"
              >
                Inspect Technical Details
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onForkGoal}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              Start Something New
            </button>
            <button
              type="button"
              onClick={onRerun}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <SuccessCelebrationBanner
        decision={celebrationDecision}
        animationsEnabled={animationsEnabled}
        artifactCount={mission.artifacts.length}
      />

      {/* Header Card & Item 10 (Overall Mission Status) + Item 1 (User's Goal) */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-purple-500/30 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                Mission Delivery · 10-Point Verification Report
              </span>
              {isDemoExample && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 font-mono font-semibold text-[11px]">
                    {demoExampleLabel}
                  </span>
                </>
              )}
              <span className="text-slate-600">·</span>
              {getStatusBadge(overallStatus)}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
              {mission.title}
            </h2>
            <p
              className={`text-xs sm:text-sm font-sans max-w-2xl p-2 rounded-lg transition-all ${
                safeSpeechState.activeId === summaryRespId
                  ? 'bg-cyan-950/35 text-white ring-1 ring-cyan-400/50'
                  : 'text-slate-300'
              }`}
            >
              {report.executiveSummary}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              {safeSpeechState.supported && onSpeakSequence && (
                <button
                  type="button"
                  onClick={onSpeakSequence}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/60 text-cyan-200 text-[11px] font-mono inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Listen to Full Mission Sequence</span>
                </button>
              )}
              {feedbackEntries.length > 0 && (
                <span className="text-[11px] font-mono text-slate-400 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-800">
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <ThumbsUp className="w-3 h-3" /> {likeCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-300">
                    <ThumbsDown className="w-3 h-3" /> {dislikeCount}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Score Ring */}
          <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl">
            <div className="relative flex items-center justify-center w-24 h-24">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="#1E2337"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke={scoreRingColor}
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - report.satisfactionScore / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-display text-white tabular-nums">
                  {report.satisfactionScore}%
                </span>
                <span className="text-[9px] font-mono uppercase text-slate-300">
                  EVIDENCE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Boundary & Scoring Honesty Note */}
        <div className="mt-6 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 font-sans flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <span className="font-mono text-cyan-300 font-semibold block">
              Execution Boundary &amp; Evidence Weighting:
            </span>
            <p>{report.environmentNote}</p>
            {report.scoringBasis && (
              <p className="text-[11px] font-mono text-slate-400">{report.scoringBasis}</p>
            )}
          </div>
        </div>

        <ResponseActionBar
          responseId={summaryRespId}
          missionId={mission.id}
          label="Delivery Executive Summary"
          textToCopy={`${mission.title} (${report.satisfactionScore}%)\n${report.executiveSummary}\n\n${report.environmentNote}`}
          textToSpeak={report.executiveSummary}
          currentRating={mission.responseFeedback?.[summaryRespId]?.rating}
          onRate={onRateResponse}
          speechState={safeSpeechState}
          onSpeak={onSpeak}
          onPauseSpeech={onPauseSpeech}
          onResumeSpeech={onResumeSpeech}
          onStopSpeech={onStopSpeech}
        />
      </div>

      {/* Speed, Parallelism, Bottleneck & Historical Benchmark Telemetry */}
      {(report.performanceMetrics || report.deadlineAssessment) && (
        <div className="glass-panel p-6 rounded-2xl border-purple-500/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Speed, Parallelism &amp; Bottleneck Telemetry
            </h3>
            {report.performanceMetrics && (
              <span className="text-xs font-mono text-cyan-300 tabular-nums flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Total Time: {(report.performanceMetrics.totalDurationMs / 1000).toFixed(2)}s · Completion:{' '}
                {report.performanceMetrics.completionRate}%
              </span>
            )}
          </div>

          {report.performanceMetrics && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Understand</span>
                  <span className="text-white font-bold tabular-nums">
                    {report.performanceMetrics.understandMs}ms
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Planning</span>
                  <span className="text-white font-bold tabular-nums">
                    {report.performanceMetrics.planMs}ms
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-cyan-800/40">
                  <span className="text-[10px] text-cyan-400 uppercase block">Execute</span>
                  <span className="text-cyan-200 font-bold tabular-nums">
                    {(report.performanceMetrics.executionMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Verify</span>
                  <span className="text-white font-bold tabular-nums">
                    {report.performanceMetrics.verificationMs}ms
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-emerald-800/40">
                  <span className="text-[10px] text-emerald-400 uppercase block">Parallel Saved</span>
                  <span className="text-emerald-300 font-bold tabular-nums">
                    {(report.performanceMetrics.timeSavedByParallelMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-purple-800/40">
                  <span className="text-[10px] text-purple-300 uppercase block">Concurrency</span>
                  <span className="text-purple-200 font-bold tabular-nums">
                    {report.performanceMetrics.maxConcurrencyAchieved}x ({report.performanceMetrics.parallelWavesExecuted} wave{report.performanceMetrics.parallelWavesExecuted === 1 ? '' : 's'})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-300 font-semibold block">
                    Bottleneck &amp; Efficiency Analysis
                  </span>
                  <p className="font-sans text-slate-200 leading-relaxed">
                    {report.performanceMetrics.bottleneckReason}
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 pt-1">
                    Sequential Equivalent: {(report.performanceMetrics.sequentialEquivalentMs / 1000).toFixed(2)}s ·
                    Cached Reuses: {report.performanceMetrics.cachedReuses} · Retries/Failures:{' '}
                    {report.performanceMetrics.failedAttempts}
                  </div>
                </div>

                {report.performanceMetrics.comparedToPrevious && (
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-800/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-cyan-300 font-semibold">
                        Historical Speed Benchmark ({report.performanceMetrics.comparedToPrevious.previousCompletedCount} prior)
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          report.performanceMetrics.comparedToPrevious.verdict === 'FASTER'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : report.performanceMetrics.comparedToPrevious.verdict === 'SLOWER'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {report.performanceMetrics.comparedToPrevious.verdict}
                      </span>
                    </div>
                    <p className="font-sans text-slate-200 leading-relaxed">
                      {report.performanceMetrics.comparedToPrevious.summary}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {report.deadlineAssessment && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                report.deadlineAssessment.realistic
                  ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-100'
                  : 'bg-amber-950/25 border-amber-600/50 text-amber-100'
              }`}
            >
              <span className="font-mono font-bold text-[11px] block">
                Deadline Assessment ({report.deadlineAssessment.requestedDeadline}):{' '}
                {report.deadlineAssessment.realistic ? 'MET / FEASIBLE' : 'UNREALISTIC TARGET FLAGGED HONESTLY'}
              </span>
              <p className="font-sans text-slate-200 mt-0.5">{report.deadlineAssessment.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Google Search Grounding Sources Section */}
      {report.groundingSources && report.groundingSources.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-cyan-200 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Verified Google Search Grounding Sources ({report.groundingSources.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">External Citations Verified by Google Search</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.groundingSources.map((src, idx) => (
              <a
                key={`${src.uri}-${idx}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between gap-2 text-xs font-mono text-cyan-300 transition-colors"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Layer Verification & Artifact Reconciliation */}
      {report.verificationLayers && (
        <div className="glass-panel p-6 rounded-2xl border-cyan-500/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Multi-Layer Verification Matrix (Truth-Separated)
            </h3>
            {report.artifactReconciliation && (
              <span className="text-xs font-mono text-cyan-300 tabular-nums">
                Reconciled {report.artifactReconciliation.checkedCount}/{report.artifactReconciliation.totalGenerated} Artifacts ({report.artifactReconciliation.verifiedCount} Passed, {report.artifactReconciliation.failedCount} Failed)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {(
              [
                report.verificationLayers.structuralValidation,
                report.verificationLayers.securityTesting,
                report.verificationLayers.functionalTesting,
                report.verificationLayers.browserTesting,
                report.verificationLayers.deploymentVerification,
              ] as VerificationLayerDetail[]
            ).map((layer, idx) => {
              const badgeCls =
                layer.status === 'PASSED'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                  : layer.status === 'FAILED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-500/50';
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono font-bold text-slate-200">
                        {layer.name}
                      </span>
                    </div>
                    <span className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeCls}`}>
                      {layer.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-slate-300 font-sans leading-snug">
                      {layer.summary}
                    </p>
                  </div>
                  {layer.issues.length > 0 && (
                    <div className="text-[10px] font-mono text-amber-200/90 border-t border-slate-800 pt-1.5">
                      {layer.issues[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sections 1, 2, 3, 10: Goal, Requirements Understood, Execution Plan & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 rounded-xl border-purple-500/20 space-y-2.5">
          <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
            1. User&apos;s Goal &amp; 2. Requirements Understood
          </div>
          <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-sans text-slate-200">
            <span className="font-mono text-[10px] text-slate-400 block uppercase mb-0.5">Original Goal</span>
            {userGoal}
          </div>
          <div className="text-xs font-sans text-slate-300 space-y-1.5">
            <div>
              <span className="font-semibold text-slate-200">Outcome:</span> {requirementsUnderstood.outcome}
            </div>
            <div>
              <span className="font-semibold text-slate-200">Constraints:</span>{' '}
              {requirementsUnderstood.constraints.join(' · ') || 'None specified'}
            </div>
            {requirementsUnderstood.userSuppliedDetails && requirementsUnderstood.userSuppliedDetails.length > 0 && (
              <div className="p-2 rounded bg-cyan-950/30 border border-cyan-800/40 text-cyan-200 text-[11px]">
                <span className="font-mono uppercase text-[10px] block text-cyan-400">User-Supplied Facts:</span>
                {requirementsUnderstood.userSuppliedDetails.join(' | ')}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border-purple-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-300 uppercase">
              3. Execution Plan &amp; 10. Overall Status
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 uppercase">
              {overallStatus}
            </span>
          </div>
          <ol className="space-y-1.5 text-xs font-sans text-slate-300">
            {executionPlanSummary.map((step, i) => (
              <li
                key={step.id || i}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
              >
                <span className="truncate">
                  <span className="font-mono text-slate-500 mr-1.5">0{i + 1}.</span>
                  {step.title}
                </span>
                <span className="text-[10px] font-mono text-cyan-300 shrink-0">
                  {step.tool} · {step.status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Sections 4, 5, 6, 7, 8: Separated Execution Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider">
            4. Tools Used · 5. Actions Completed · 6. Evidence · 7. Limitations · 8. Approvals
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {realToolsExecuted} Real · {llmReasoningSteps} AI · {simulatedToolsRun} Simulated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Real Execution */}
          <div className="glass-panel p-4 rounded-xl border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                Real Backend Tools
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold tabular-nums">
                {realExecutedTasks.length}
              </span>
            </div>
            {realExecutedTasks.length === 0 ? (
              <p className="text-xs text-slate-500 font-sans">No deterministic backend tool steps ran in this mission.</p>
            ) : (
              <ul className="space-y-1.5 text-xs font-sans text-slate-200">
                {realExecutedTasks.map((t) => (
                  <li key={t.id} className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-900/40">
                    <div className="font-semibold text-emerald-200">{t.title}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {t.tool} · {t.toolOutput?.formattedResult || t.verificationEvidence || 'Verified'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Reasoning & Deliverable Synthesis */}
          <div className="glass-panel p-4 rounded-xl border-purple-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-purple-300 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                AI Reasoning &amp; Synthesis
              </span>
              <span className="text-xs font-mono text-purple-300 font-bold tabular-nums">
                {aiReasoningTasks.length}
              </span>
            </div>
            {aiReasoningTasks.length === 0 ? (
              <p className="text-xs text-slate-500 font-sans">No AI deliverable synthesis steps completed.</p>
            ) : (
              <ul className="space-y-1.5 text-xs font-sans text-slate-200">
                {aiReasoningTasks.map((t) => (
                  <li key={t.id} className="p-2 rounded-lg bg-purple-950/25 border border-purple-900/40">
                    <div className="font-semibold text-purple-200">{t.title}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Deliverable: {t.outputArtifact?.name || t.expectedArtifact}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Simulated Workflows */}
          <div className="glass-panel p-4 rounded-xl border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Simulated (No External Action)
              </span>
              <span className="text-xs font-mono text-cyan-300 font-bold tabular-nums">
                {simulatedTasks.length}
              </span>
            </div>
            {simulatedTasks.length === 0 ? (
              <p className="text-xs text-slate-500 font-sans">No simulated sandbox routines executed.</p>
            ) : (
              <ul className="space-y-1.5 text-xs font-sans text-slate-200">
                {simulatedTasks.map((t) => (
                  <li key={t.id} className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="font-semibold text-cyan-200">{t.title}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {t.tool} · Safe sandbox draft only (no live side effects)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 8. Approval Requirements */}
          <div className="glass-panel p-4 rounded-xl border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                8. Items Requiring Approval
              </span>
              <span className="text-xs font-mono text-amber-300 font-bold tabular-nums">
                {itemsRequiringApproval.length}
              </span>
            </div>
            {itemsRequiringApproval.length === 0 ? (
              <p className="text-xs text-slate-500 font-sans">No actions in this mission required external approval.</p>
            ) : (
              <ul className="space-y-1.5 text-xs font-sans text-slate-200">
                {itemsRequiringApproval.map((item, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-amber-950/20 border border-amber-900/40">
                    <div className="font-semibold text-amber-200">{item.stepTitle}</div>
                    <div className="text-[11px] font-mono text-slate-300">
                      {item.tool} · {item.approvalStatus.replace('_', ' ').toUpperCase()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 7. Failures & Limitations */}
          <div className="glass-panel p-4 rounded-xl border-rose-500/30 space-y-2.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-rose-300 uppercase flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                7. Failures &amp; Limitations
              </span>
              <span className={`text-xs font-mono font-bold tabular-nums ${failedTasks.length > 0 || skippedSteps > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {failedTasks.length} Failed · {skippedSteps} Skipped
              </span>
            </div>
            {failuresOrLimitations.length === 0 ? (
              <p className="text-xs text-slate-400 font-sans">Zero step failures or blocked deliverables recorded.</p>
            ) : (
              <ul className="space-y-1.5 text-xs font-sans text-rose-200">
                {failuresOrLimitations.map((issue, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
                    {/calculator\s*(?:syntax\s*)?error|could not extract valid arithmetic|unexpected token/i.test(issue)
                      ? toFriendlyCustomerError(issue)
                      : issue}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 6. Verification Evidence & 9. Final Deliverables */}
      <div className="glass-panel p-6 rounded-2xl border-purple-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            9. Final Deliverables &amp; 6. Verification Evidence ({report.verifiedArtifacts.length})
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Click any HTML file to launch live prototype preview
          </span>
        </div>

        <div className="space-y-3">
          {report.verifiedArtifacts.map((artifact, idx) => {
            const fullArtifact = mission.artifacts.find((a) => a.name === artifact.title);
            const isFailedArt = artifact.status.includes('FAIL');
            const isHtmlArt = fullArtifact && (fullArtifact.format === 'html' || fullArtifact.name.endsWith('.html'));
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl bg-slate-900/60 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isFailedArt
                    ? 'border-rose-700/60 bg-rose-950/20'
                    : artifact.isReal
                    ? 'border-emerald-700/50 hover:border-emerald-500/60'
                    : 'border-slate-800/80 hover:border-purple-500/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="font-bold text-purple-300">{artifact.title}</span>
                    <span className="text-slate-600">·</span>
                    <span
                      className={
                        isFailedArt
                          ? 'text-rose-300 font-semibold'
                          : artifact.isReal
                          ? 'text-emerald-300 font-semibold'
                          : artifact.status.includes('SIMULATED')
                          ? 'text-cyan-300'
                          : 'text-purple-300'
                      }
                    >
                      {artifact.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-sans">
                    {artifact.summary}
                  </p>
                </div>

                {fullArtifact && onSelectArtifact && (
                  <button
                    onClick={() => onSelectArtifact(fullArtifact)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                  >
                    <span>{isHtmlArt ? 'Preview Prototype' : 'Inspect File'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Assessment & Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Risk Assessment &amp; Untrusted Data Safety
          </h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {report.riskAssessment.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-mono mt-0.5">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`glass-panel p-6 rounded-2xl space-y-3 transition-all ${
            safeSpeechState.activeId === recRespId
              ? 'border-cyan-400/70 ring-1 ring-cyan-400/40 bg-cyan-950/15'
              : 'border-slate-800'
          }`}
        >
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Recommended Next Steps
          </h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {report.humanRecommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-purple-400 font-mono font-bold mt-0.5">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
          <ResponseActionBar
            responseId={recRespId}
            missionId={mission.id}
            label="Recommended Next Steps"
            textToCopy={report.humanRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
            textToSpeak={`Recommended next steps: ${report.humanRecommendations.join('. ')}`}
            currentRating={mission.responseFeedback?.[recRespId]?.rating}
            onRate={onRateResponse}
            speechState={safeSpeechState}
            onSpeak={onSpeak}
            onPauseSpeech={onPauseSpeech}
            onResumeSpeech={onResumeSpeech}
            onStopSpeech={onStopSpeech}
          />
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-panel rounded-2xl border-purple-500/30">
        <button
          onClick={handleDownloadReport}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-display font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download 10-Point Delivery Report (.md)</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onForkGoal}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
          >
            New Mission in Command Centre
          </button>
          <button
            onClick={onRerun}
            className="px-4 py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rerun Mission</span>
          </button>
        </div>
      </div>
    </div>
  );
};
