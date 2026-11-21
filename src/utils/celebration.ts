import { Mission, Task, VerificationReport } from '../types/agent';

export const CELEBRATION_HEADLINES = [
  'Amazing! Your project is ready!',
  'Mission accomplished!',
  'Brilliant! We got it done.',
  'Your idea has become reality.',
  'Another achievement unlocked!',
] as const;

export type CelebrationLevel = 0 | 1 | 2 | 3;

export type CelebrationOutcomeKind =
  | 'none'
  | 'failed'
  | 'cancelled'
  | 'partial'
  | 'simulated_only'
  | 'task_done'
  | 'milestone';

export interface CelebrationDecision {
  level: CelebrationLevel;
  allowCelebrate: boolean;
  kind: CelebrationOutcomeKind;
  headline: string;
  message: string;
}

/**
 * Level 1 check: Only show a small gold check highlight when a step actually completed
 * without simulation and passed verification.
 */
export function shouldCelebrateStep(task: Task): boolean {
  if (!task || task.status !== 'completed') return false;
  if (task.verificationPassed === false) return false;
  if (task.toolType === 'SIMULATED' || task.simulated) return false;
  return true;
}

/**
 * Deterministic, strictly truthful celebration evaluator.
 * - NEVER celebrates failed missions/steps.
 * - NEVER celebrates simulated-only sandbox actions as completed real outcomes.
 * - NEVER gives full Level 3 milestone celebration for partial or skipped/unapproved runs.
 */
export function evaluateMissionCelebration(
  mission: Mission,
  reportOverride?: VerificationReport
): CelebrationDecision {
  const report = reportOverride || mission.report;

  if (mission.status === 'failed') {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'failed',
      headline: 'We hit a snag along the way',
      message:
        'A step did not pass verification. Your completed work is safely saved so you can retry or review what happened.',
    };
  }

  if (mission.status === 'cancelled') {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'cancelled',
      headline: 'Work stopped safely',
      message: 'We stopped here as requested and kept any progress already saved.',
    };
  }

  if (mission.status !== 'completed' && !report) {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'none',
      headline: '',
      message: '',
    };
  }

  const failedSteps =
    report?.metrics?.failedSteps ??
    mission.tasks.filter((t) => t.status === 'failed').length;
  const skippedSteps =
    report?.metrics?.skippedSteps ??
    mission.tasks.filter((t) => t.status === 'skipped' || t.status === 'awaiting_approval').length;
  const simulatedToolsRun =
    report?.metrics?.simulatedToolsRun ??
    mission.tasks.filter(
      (t) => t.status === 'completed' && (t.toolType === 'SIMULATED' || t.simulated)
    ).length;
  const verifiedSteps =
    report?.metrics?.verifiedSteps ??
    mission.tasks.filter((t) => t.status === 'completed' && t.verificationPassed !== false).length;
  const realToolsExecuted =
    report?.metrics?.realToolsExecuted ??
    mission.tasks.filter((t) => t.status === 'completed' && t.toolType === 'REAL').length;

  const securityFailed = report?.verificationLayers?.securityTesting?.status === 'FAILED';
  const structuralFailed = report?.verificationLayers?.structuralValidation?.status === 'FAILED';
  const overallStatus = report?.overallMissionStatus;
  const verificationStatus = report?.verificationStatus;

  if (
    failedSteps > 0 ||
    securityFailed ||
    structuralFailed ||
    verificationStatus === 'FAILED_VALIDATION' ||
    verificationStatus === 'PARTIAL_FAILURE' ||
    overallStatus === 'failed'
  ) {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'failed',
      headline: 'Some checks did not pass',
      message:
        'Parts of this run failed verification. Review the details below before using or sharing these results.',
    };
  }

  if (
    skippedSteps > 0 ||
    overallStatus === 'partially completed' ||
    overallStatus === 'awaiting approval' ||
    verificationStatus === 'CONDITIONALLY_VERIFIED'
  ) {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'partial',
      headline: 'Finished with some steps skipped',
      message:
        'Your completed drafts are saved, though one or more approval-gated steps were skipped or left pending.',
    };
  }

  // Strictly refuse to celebrate simulated outcomes as real achievements
  if (simulatedToolsRun > 0) {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'simulated_only',
      headline: 'Drafts & safe preview completed',
      message:
        'Because external services are not connected, some steps ran only as safe drafts/previews without real-world actions.',
    };
  }

  if (verifiedSteps === 0) {
    return {
      level: 0,
      allowCelebrate: false,
      kind: 'partial',
      headline: 'No verified steps completed',
      message: 'No verified results were produced yet.',
    };
  }

  // Genuine, non-simulated, verified completion
  const artifactCount = mission.artifacts?.length || report?.metrics?.artifactsCount || 0;
  const isMajorMilestone =
    verificationStatus === 'VERIFIED_SATISFIED' ||
    (verifiedSteps >= 2 && (artifactCount > 0 || realToolsExecuted > 0)) ||
    (report?.satisfactionScore ?? 0) >= 75;

  const seed = Math.abs(
    mission.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  const headline = isMajorMilestone
    ? CELEBRATION_HEADLINES[seed % CELEBRATION_HEADLINES.length]
    : 'Brilliant! We got it done.';

  return {
    level: isMajorMilestone ? 3 : 2,
    allowCelebrate: true,
    kind: isMajorMilestone ? 'milestone' : 'task_done',
    headline,
    message:
      artifactCount > 0
        ? `All ${verifiedSteps} step${verifiedSteps === 1 ? '' : 's'} checked and ${artifactCount} ready-to-use file${artifactCount === 1 ? '' : 's'} prepared for you.`
        : `All ${verifiedSteps} step${verifiedSteps === 1 ? '' : 's'} completed and verified cleanly.`,
  };
}
