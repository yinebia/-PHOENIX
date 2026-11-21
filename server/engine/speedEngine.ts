/**
 * PHOENIX Speed, Time Intelligence, DAG Critical-Path & Deadline Engine
 * Analyzes task dependencies, schedules genuine parallel execution waves,
 * validates deadline feasibility honestly, and tracks true phase timings.
 */

export interface DagTaskInput {
  id: string;
  title: string;
  stage?: string;
  tool: string;
  toolType?: string;
  estimatedDurationSec?: number;
  dependencies?: string[];
  requiresApproval?: boolean;
  status?: string;
  executionTimeMs?: number;
  retryCount?: number;
  recoveryAttempts?: number;
  parallelBatchId?: string;
  waveIndex?: number;
  reusedCachedResult?: boolean;
}

export interface DagAnalysisResult {
  tasksWithDagMetadata: any[];
  dagSummary: {
    totalWaves: number;
    maxParallelism: number;
    criticalPathIds: string[];
    criticalPathEstimateMs: number;
    estimatedSequentialMs: number;
    estimatedParallelMs: number;
    estimatedTimeSavedMs: number;
    parallelWavesCount: number;
    cycleDetected: boolean;
  };
}

export interface DeadlineAssessmentResult {
  requestedDeadline: string;
  targetMs: number | null;
  realistic: boolean;
  fastestAchievableMs: number;
  estimatedParallelMs: number;
  estimatedSequentialMs: number;
  explanation: string;
  alternativePlan?: string;
}

function estimateRealisticStepMs(task: DagTaskInput): number {
  const tool = (task.tool || '').toLowerCase();
  if (tool === 'calculator' || tool === 'artifact_validator' || tool === 'verification_harness') {
    return 45; // Deterministic sub-50ms backend execution
  }
  if (tool === 'web_search') {
    return 2600; // Live Google Search Grounding HTTP roundtrip
  }
  if (tool === 'llm_reasoning') {
    const est = Number(task.estimatedDurationSec) || 3;
    return Math.max(1200, Math.min(est * 1000, 7000));
  }
  return 180; // Safe sandbox simulated routine
}

/**
 * Selects fastest safe Gemini model tier for a task without sacrificing output accuracy.
 */
export function selectFastModelForTask(
  task: DagTaskInput,
  executionDepth?: string,
  _targetDeadline?: string
): string {
  const tool = (task.tool || '').toLowerCase();
  if (tool === 'calculator' || tool === 'artifact_validator' || tool === 'verification_harness') {
    return 'deterministic-backend';
  }
  if (tool === 'web_search') {
    return 'gemini-4-hydrogen'; // Required for Google Search Grounding
  }
  const artifact = String((task as any).expectedArtifact || '').toLowerCase();
  const isHtml = artifact.endsWith('.html');
  if (executionDepth === 'Deep Rigor' && isHtml) {
    return 'gemini-4-hydrogen';
  }
  return 'gemini-3.1-flash-lite';
}

/**
 * Parses user deadline strings into target milliseconds if bounded (null = unbounded / immediate).
 */
export function parseRequestedDeadlineMs(targetDeadline: string): number | null {
  const raw = String(targetDeadline || '').trim().toLowerCase();
  if (!raw || raw.includes('immediate') || raw.includes('approval-gated')) {
    return null;
  }

  const msMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ms|millisecond)/i);
  if (msMatch) {
    return Math.max(100, Math.round(parseFloat(msMatch[1])));
  }

  const secMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)/i);
  if (secMatch) {
    return Math.max(100, Math.round(parseFloat(secMatch[1]) * 1000));
  }

  const minMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute|minutes)/i);
  if (minMatch) {
    return Math.max(1000, Math.round(parseFloat(minMatch[1]) * 60_000));
  }

  return null;
}

/**
 * Computes topological execution waves, identifies parallelizable sibling tasks,
 * breaks any cycles safely, and extracts the longest weighted critical path.
 */
export function analyzeExecutionDag(
  tasks: any[],
  executionDepth?: string,
  targetDeadline?: string
): DagAnalysisResult {
  const safeTasks = Array.isArray(tasks) ? tasks.map((t) => ({ ...t })) : [];
  if (safeTasks.length === 0) {
    return {
      tasksWithDagMetadata: [],
      dagSummary: {
        totalWaves: 0,
        maxParallelism: 0,
        criticalPathIds: [],
        criticalPathEstimateMs: 0,
        estimatedSequentialMs: 0,
        estimatedParallelMs: 0,
        estimatedTimeSavedMs: 0,
        parallelWavesCount: 0,
        cycleDetected: false,
      },
    };
  }

  const taskMap = new Map<string, any>();
  for (const t of safeTasks) {
    taskMap.set(t.id, t);
  }

  // Normalize dependencies to existing task IDs (drop unknown/self dependencies)
  for (const t of safeTasks) {
    const rawDeps = Array.isArray(t.dependencies) ? t.dependencies : [];
    t.dependencies = Array.from(
      new Set(rawDeps.filter((dep: string) => dep !== t.id && taskMap.has(dep)))
    );
  }

  // Topological wave assignment (Kahn's level-by-level)
  const completed = new Set<string>();
  const waveByTaskId = new Map<string, number>();
  const waves: any[][] = [];
  let remaining = [...safeTasks];
  let waveIndex = 0;
  let cycleDetected = false;

  while (remaining.length > 0) {
    const ready = remaining.filter((t) =>
      (t.dependencies || []).every((d: string) => completed.has(d))
    );

    if (ready.length === 0) {
      // Break cycle cleanly by forcing earliest remaining node in wave
      cycleDetected = true;
      const forced = remaining[0];
      forced.dependencies = (forced.dependencies || []).filter((d: string) => completed.has(d));
      waves.push([forced]);
      waveByTaskId.set(forced.id, waveIndex);
      completed.add(forced.id);
      remaining = remaining.slice(1);
      waveIndex += 1;
      continue;
    }

    waves.push(ready);
    for (const r of ready) {
      waveByTaskId.set(r.id, waveIndex);
      completed.add(r.id);
    }
    remaining = remaining.filter((t) => !ready.some((r) => r.id === t.id));
    waveIndex += 1;
  }

  // Longest-path calculation through the DAG for critical path identification
  const distMs = new Map<string, number>();
  const predecessor = new Map<string, string | null>();
  const ordered = waves.flat();

  for (const t of ordered) {
    const ownCost = estimateRealisticStepMs(t);
    let bestDepCost = 0;
    let bestPred: string | null = null;

    for (const depId of t.dependencies || []) {
      const depTotal = distMs.get(depId) || 0;
      if (depTotal > bestDepCost) {
        bestDepCost = depTotal;
        bestPred = depId;
      }
    }

    distMs.set(t.id, bestDepCost + ownCost);
    predecessor.set(t.id, bestPred);
  }

  let terminalId: string | null = null;
  let criticalPathEstimateMs = 0;
  for (const [id, cost] of distMs.entries()) {
    if (cost >= criticalPathEstimateMs) {
      criticalPathEstimateMs = cost;
      terminalId = id;
    }
  }

  const criticalSet = new Set<string>();
  let cursor = terminalId;
  while (cursor) {
    criticalSet.add(cursor);
    cursor = predecessor.get(cursor) || null;
  }

  let estimatedSequentialMs = 0;
  let estimatedParallelMs = 0;
  let maxParallelism = 1;
  let parallelWavesCount = 0;

  for (let wIdx = 0; wIdx < waves.length; wIdx++) {
    const wave = waves[wIdx];
    const autoRunnableCount = wave.filter((t) => !t.requiresApproval).length;
    if (autoRunnableCount > maxParallelism) {
      maxParallelism = autoRunnableCount;
    }
    if (autoRunnableCount >= 2) {
      parallelWavesCount += 1;
    }
    let waveMaxMs = 0;
    for (const t of wave) {
      const stepMs = estimateRealisticStepMs(t);
      estimatedSequentialMs += stepMs;
      if (stepMs > waveMaxMs) waveMaxMs = stepMs;
    }
    estimatedParallelMs += waveMaxMs;
  }

  const tasksWithDagMetadata = safeTasks.map((t) => {
    const wIdx = waveByTaskId.get(t.id) ?? 0;
    const waveSize = (waves[wIdx] || []).filter((wt) => !wt.requiresApproval).length;
    return {
      ...t,
      waveIndex: wIdx,
      isCriticalPath: criticalSet.has(t.id),
      canRunInParallel: !t.requiresApproval && waveSize >= 2,
      fastModelHint: selectFastModelForTask(t, executionDepth, targetDeadline),
    };
  });

  return {
    tasksWithDagMetadata,
    dagSummary: {
      totalWaves: waves.length,
      maxParallelism,
      criticalPathIds: Array.from(criticalSet),
      criticalPathEstimateMs,
      estimatedSequentialMs,
      estimatedParallelMs,
      estimatedTimeSavedMs: Math.max(0, estimatedSequentialMs - estimatedParallelMs),
      parallelWavesCount,
      cycleDetected,
    },
  };
}

/**
 * Evaluates whether a target deadline can be met without sacrificing verification, security, or approval gates.
 */
export function assessDeadlineFeasibility(
  targetDeadline: string,
  dagSummary: DagAnalysisResult['dagSummary'],
  tasks: any[]
): DeadlineAssessmentResult {
  const targetMs = parseRequestedDeadlineMs(targetDeadline);
  const hasApprovalGate = tasks.some((t) => t.requiresApproval);
  const llmCount = tasks.filter((t) => t.toolType === 'LLM_REASONING').length;
  const searchCount = tasks.filter((t) => (t.tool || '').toLowerCase() === 'web_search').length;

  // Include ~800ms planning/network baseline on top of parallel wave execution
  const baselineOverheadMs = llmCount > 0 || searchCount > 0 ? 1200 : 120;
  const fastestAchievableMs = dagSummary.estimatedParallelMs + baselineOverheadMs;

  if (targetMs === null) {
    return {
      requestedDeadline: targetDeadline || 'Immediate / Real-time',
      targetMs: null,
      realistic: true,
      fastestAchievableMs,
      estimatedParallelMs: dagSummary.estimatedParallelMs,
      estimatedSequentialMs: dagSummary.estimatedSequentialMs,
      explanation: hasApprovalGate
        ? `Wave-parallel execution minimizes automated latency (~${(fastestAchievableMs / 1000).toFixed(1)}s), while pausing cleanly at human approval gates without skipping checks.`
        : `Wave-parallel scheduling executes ${tasks.length} step(s) across ${dagSummary.totalWaves} wave(s) (~${(fastestAchievableMs / 1000).toFixed(1)}s estimated wall-clock vs ${(dagSummary.estimatedSequentialMs / 1000).toFixed(1)}s sequential).`,
    };
  }

  if (hasApprovalGate && targetMs <= 30_000) {
    return {
      requestedDeadline: targetDeadline,
      targetMs,
      realistic: false,
      fastestAchievableMs,
      estimatedParallelMs: dagSummary.estimatedParallelMs,
      estimatedSequentialMs: dagSummary.estimatedSequentialMs,
      explanation: `The ${Math.round(targetMs / 1000)}s deadline cannot be guaranteed automatically because this plan includes mandatory human approval gates before external actions. PHOENIX will never bypass safety approvals for speed.`,
      alternativePlan: `Run all automated synthesis & deterministic verification waves concurrently in ~${(fastestAchievableMs / 1000).toFixed(1)}s, then pause cleanly for your approval decision.`,
    };
  }

  if (targetMs < fastestAchievableMs) {
    const gapSec = ((fastestAchievableMs - targetMs) / 1000).toFixed(1);
    return {
      requestedDeadline: targetDeadline,
      targetMs,
      realistic: false,
      fastestAchievableMs,
      estimatedParallelMs: dagSummary.estimatedParallelMs,
      estimatedSequentialMs: dagSummary.estimatedSequentialMs,
      explanation: `Requested deadline (${(targetMs / 1000).toFixed(1)}s) is ${gapSec}s faster than realistic API & deterministic verification latency (~${(fastestAchievableMs / 1000).toFixed(1)}s minimum) without skipping quality or security checks.`,
      alternativePlan: `Execute ${dagSummary.totalWaves} parallel wave(s) using gemini-3.1-flash-lite + deterministic tools (~${(fastestAchievableMs / 1000).toFixed(1)}s total) while keeping full artifact validation intact.`,
    };
  }

  return {
    requestedDeadline: targetDeadline,
    targetMs,
    realistic: true,
    fastestAchievableMs,
    estimatedParallelMs: dagSummary.estimatedParallelMs,
    estimatedSequentialMs: dagSummary.estimatedSequentialMs,
    explanation: `Target deadline (${(targetMs / 1000).toFixed(1)}s) is realistic using ${dagSummary.totalWaves} wave-parallel schedule (~${(fastestAchievableMs / 1000).toFixed(1)}s expected).`,
  };
}

/**
 * Computes factual mission performance telemetry and compares against historical workspace runs.
 */
export function computeMissionPerformanceMetrics({
  tasks,
  phaseTimings,
  totalDurationMs,
  historicalMissions = [],
}: {
  tasks: any[];
  phaseTimings?: {
    understandMs?: number;
    planMs?: number;
    executionMs?: number;
    verificationMs?: number;
    recoveryMs?: number;
  };
  totalDurationMs: number;
  historicalMissions?: any[];
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const understandMs = Math.max(0, Math.round(phaseTimings?.understandMs || 0));
  const planMs = Math.max(0, Math.round(phaseTimings?.planMs || 0));
  const executionMs = Math.max(0, Math.round(phaseTimings?.executionMs || 0));
  const verificationMs = Math.max(0, Math.round(phaseTimings?.verificationMs || 0));
  const recoveryMs = Math.max(0, Math.round(phaseTimings?.recoveryMs || 0));

  const sequentialEquivalentMs = safeTasks.reduce(
    (sum, t) => sum + (typeof t.executionTimeMs === 'number' ? t.executionTimeMs : 0),
    0
  );

  // Measure actual concurrency across completed parallel batches (waves with >= 2 tasks sharing parallelBatchId)
  const batchGroups = new Map<string, any[]>();
  for (const t of safeTasks) {
    if (t.parallelBatchId && t.status === 'completed') {
      const group = batchGroups.get(t.parallelBatchId) || [];
      group.push(t);
      batchGroups.set(t.parallelBatchId, group);
    }
  }

  let parallelWavesExecuted = 0;
  let maxConcurrencyAchieved = 1;
  let timeSavedByParallelMs = 0;
  let actualWaveWallClockMs = executionMs;

  for (const group of batchGroups.values()) {
    if (group.length >= 2) {
      parallelWavesExecuted += 1;
      if (group.length > maxConcurrencyAchieved) {
        maxConcurrencyAchieved = group.length;
      }
      const sumStepsMs = group.reduce((s, t) => s + (t.executionTimeMs || 0), 0);
      const maxStepMs = group.reduce((m, t) => Math.max(m, t.executionTimeMs || 0), 0);
      timeSavedByParallelMs += Math.max(0, sumStepsMs - maxStepMs);
    }
  }

  if (parallelWavesExecuted > 0 && executionMs > 0) {
    actualWaveWallClockMs = executionMs;
  } else {
    actualWaveWallClockMs = sequentialEquivalentMs || executionMs;
  }

  const failedAttempts = safeTasks.reduce(
    (sum, t) =>
      sum +
      (Number(t.retryCount) || 0) +
      (Number(t.recoveryAttempts) || 0) +
      (t.status === 'failed' ? 1 : 0),
    0
  );

  const completedCount = safeTasks.filter((t) => t.status === 'completed').length;
  const completionRate = safeTasks.length > 0 ? Math.round((completedCount / safeTasks.length) * 100) : 0;
  const cachedReuses = safeTasks.filter((t) => Boolean(t.reusedCachedResult)).length;

  // Bottleneck identification from actual recorded durations
  let slowestTask: any = null;
  for (const t of safeTasks) {
    if (typeof t.executionTimeMs === 'number') {
      if (!slowestTask || t.executionTimeMs > (slowestTask.executionTimeMs || 0)) {
        slowestTask = t;
      }
    }
  }

  let bottleneckReason = 'Execution balanced within expected tool latencies.';
  if (recoveryMs > Math.max(executionMs * 0.35, 1000)) {
    bottleneckReason = `Recovery retries added ${Math.round(recoveryMs)}ms overhead during failed step diagnosis.`;
  } else if (planMs > executionMs && planMs > 1500) {
    bottleneckReason = `Initial planning & intention analysis took ${planMs}ms (${Math.round((planMs / Math.max(1, totalDurationMs)) * 100)}% of total duration).`;
  } else if (slowestTask) {
    bottleneckReason = `Step "${slowestTask.title}" (${slowestTask.tool}) accounted for ${Math.round(slowestTask.executionTimeMs)}ms on the execution path.`;
  }

  // Historical workspace performance comparison
  const comparableHistory = (historicalMissions || [])
    .map((m) => {
      if (!m) return null;
      if (m.status && m.status !== 'completed') return null;
      const ms = Number(
        m.performanceMetrics?.totalDurationMs || m.totalDurationMs || m.elapsedMs || 0
      );
      return ms > 0 ? { ...m, _durationMs: ms } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  let comparedToPrevious: any = undefined;
  if (comparableHistory.length > 0 && totalDurationMs > 0) {
    const avgPreviousDurationMs = Math.round(
      comparableHistory.reduce((s, m) => s + m._durationMs, 0) / comparableHistory.length
    );
    const fastestPreviousDurationMs = Math.min(...comparableHistory.map((m) => m._durationMs));
    const deltaMs = Math.round(totalDurationMs - avgPreviousDurationMs);
    const deltaPercent = Math.round((deltaMs / Math.max(1, avgPreviousDurationMs)) * 100);
    const verdict =
      deltaPercent <= -10
        ? 'FASTER'
        : deltaPercent >= 10
        ? 'SLOWER'
        : 'COMPARABLE';
    const summary =
      verdict === 'FASTER'
        ? `${Math.abs(deltaPercent)}% faster (${Math.abs(deltaMs)}ms saved) vs prior ${comparableHistory.length} completed run(s).`
        : verdict === 'SLOWER'
        ? `${deltaPercent}% slower (+${deltaMs}ms) than prior ${comparableHistory.length} completed run(s).`
        : `Within 10% of prior ${comparableHistory.length}-mission baseline (${avgPreviousDurationMs}ms avg).`;

    comparedToPrevious = {
      previousCompletedCount: comparableHistory.length,
      avgPreviousDurationMs,
      fastestPreviousDurationMs,
      deltaMs,
      deltaPercent,
      verdict,
      summary,
    };
  }

  return {
    understandMs,
    planMs,
    executionMs,
    verificationMs,
    recoveryMs,
    totalDurationMs: Math.max(totalDurationMs, understandMs + planMs + executionMs + verificationMs),
    sequentialEquivalentMs: Math.round(sequentialEquivalentMs),
    actualWaveWallClockMs: Math.round(actualWaveWallClockMs),
    timeSavedByParallelMs: Math.round(timeSavedByParallelMs),
    parallelWavesExecuted,
    maxConcurrencyAchieved,
    failedAttempts,
    completionRate,
    cachedReuses,
    bottleneckStepId: slowestTask?.id,
    bottleneckTitle: slowestTask?.title,
    bottleneckDurationMs: slowestTask ? Math.round(slowestTask.executionTimeMs) : undefined,
    bottleneckReason,
    comparedToPrevious,
  };
}
