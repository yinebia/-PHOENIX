export type TaskStatus =
  | 'pending'
  | 'running'
  | 'retrying'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'skipped';

export type LogLevel =
  | 'INFO'
  | 'REASONING'
  | 'EXEC'
  | 'SUCCESS'
  | 'WARN'
  | 'ARTIFACT'
  | 'RETRY'
  | 'ERROR'
  | 'APPROVAL'
  | 'CLARIFICATION';

export type ToolType = 'REAL' | 'SIMULATED' | 'LLM_REASONING';

export type PhoenixStage =
  | 'UNDERSTAND'
  | 'STRATEGISE'
  | 'EXECUTE'
  | 'COORDINATE'
  | 'VERIFY_RECOVER'
  | 'DELIVER';

export type ApprovalStatus =
  | 'not_required'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type OverallMissionStatus =
  | 'completed'
  | 'partially completed'
  | 'awaiting approval'
  | 'failed';

export interface ActivityLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  title: string;
  message: string;
  stepId?: string;
  stage?: PhoenixStage;
  simulated?: boolean;
  toolType?: ToolType;
  payload?: any;
}

export interface Artifact {
  id: string;
  name: string;
  format: string; // 'json' | 'markdown' | 'html' | 'typescript' | 'yaml' | 'text'
  content: string;
  stepId?: string;
  timestamp: string;
  isRealExecution?: boolean;
  validated?: boolean;
  validationSummary?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface DeadlineAssessment {
  requestedDeadline: string;
  targetMs?: number | null;
  realistic: boolean;
  fastestAchievableMs: number;
  estimatedParallelMs: number;
  estimatedSequentialMs: number;
  explanation: string;
  alternativePlan?: string;
}

export interface DagAnalysisSummary {
  totalWaves: number;
  maxParallelism: number;
  criticalPathIds: string[];
  criticalPathEstimateMs: number;
  estimatedSequentialMs: number;
  estimatedParallelMs: number;
  estimatedTimeSavedMs: number;
  parallelWavesCount: number;
  cycleDetected?: boolean;
}

export interface PerformanceComparison {
  previousCompletedCount: number;
  avgPreviousDurationMs: number;
  fastestPreviousDurationMs: number;
  deltaMs: number;
  deltaPercent: number;
  verdict: 'FASTER' | 'SLOWER' | 'BASELINE' | 'COMPARABLE';
  summary: string;
}

export interface MissionPerformanceMetrics {
  understandMs: number;
  planMs: number;
  executionMs: number;
  verificationMs: number;
  recoveryMs: number;
  totalDurationMs: number;
  sequentialEquivalentMs: number;
  actualWaveWallClockMs: number;
  timeSavedByParallelMs: number;
  parallelWavesExecuted: number;
  maxConcurrencyAchieved: number;
  failedAttempts: number;
  completionRate: number;
  cachedReuses: number;
  bottleneckStepId?: string;
  bottleneckTitle?: string;
  bottleneckDurationMs?: number;
  bottleneckReason: string;
  comparedToPrevious?: PerformanceComparison;
}

export type ChatRolePreset = 'strategist' | 'researcher' | 'architect' | 'custom';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  model?: string;
  latencyMs?: number;
  groundingSources?: GroundingSource[];
  searchGrounded?: boolean;
  searchFallbackNotice?: string;
}

export interface Task {
  id: string;
  title: string;
  phase: string;
  stage: PhoenixStage;
  tool: string;
  simulated: boolean;
  toolType: ToolType;
  description: string;
  expectedArtifact: string;
  estimatedDurationSec: number;
  dependencies: string[];
  status: TaskStatus;
  waveIndex?: number;
  isCriticalPath?: boolean;
  canRunInParallel?: boolean;
  parallelBatchId?: string;
  fastModelHint?: string;
  startedAt?: string;
  completedAt?: string;
  startedOffsetMs?: number;
  finishedOffsetMs?: number;
  reusedCachedResult?: boolean;
  requiresApproval?: boolean;
  approvalReason?: string;
  approvalActionType?: string;
  approvalStatus?: ApprovalStatus;
  toolInput?: any;
  toolOutput?: any;
  executionTimeMs?: number;
  retryCount?: number;
  maxRetries?: number;
  recoveryAttempts?: number;
  recoveryStrategy?: string;
  error?: string;
  reasoning?: string;
  executionBadge?: string;
  logs?: string[];
  outputArtifact?: Artifact;
  verificationPassed?: boolean;
  verificationEvidence?: string;
  groundingSources?: GroundingSource[];
}

export type ResponseFeedbackRating = 'up' | 'down';

export interface ResponseFeedbackEntry {
  responseId: string;
  missionId: string;
  rating: ResponseFeedbackRating;
  label?: string;
  snippet?: string;
  timestamp: string;
}

export type VerificationLayerStatus =
  | 'PASSED'
  | 'FAILED'
  | 'WARNING'
  | 'NOT_RUN'
  | 'LOCAL_PROTOTYPE_ONLY';

export interface VerificationLayerDetail {
  name: string;
  status: VerificationLayerStatus;
  executed: boolean;
  summary: string;
  checks: string[];
  issues: string[];
}

export interface VerificationLayers {
  structuralValidation: VerificationLayerDetail;
  securityTesting: VerificationLayerDetail;
  functionalTesting: VerificationLayerDetail;
  browserTesting: VerificationLayerDetail;
  deploymentVerification: VerificationLayerDetail;
}

export interface ArtifactReconciliationItem {
  name: string;
  format: string;
  exists: boolean;
  structuralPass: boolean;
  securityPass: boolean;
  functionalPass: boolean;
  checks: string[];
  issues: string[];
}

export interface ArtifactReconciliation {
  totalGenerated: number;
  checkedCount: number;
  verifiedCount: number;
  failedCount: number;
  unverifiedCount: number;
  reconciled: boolean;
  artifactDetails: ArtifactReconciliationItem[];
}

export interface MissionUnderstanding {
  isDemoExample?: boolean;
  exampleLabel?: string;
  intendedOutcome: string;
  suppliedInformation?: string[];
  resourceConstraints: string[];
  missingInformation: string[];
  contradictionsDetected?: string[];
  needsClarification?: boolean;
  clarifyingQuestions?: string[];
  strategySummary: string;
  opportunities: string[];
  risks: string[];
  dagAnalysis?: DagAnalysisSummary;
  deadlineAssessment?: DeadlineAssessment;
}

export interface VerificationReport {
  isDemoExample?: boolean;
  exampleLabel?: string;
  verificationStatus: string;
  overallMissionStatus?: OverallMissionStatus;
  satisfactionScore: number;
  scoringBasis?: string;
  executiveSummary: string;
  environmentNote: string;
  userGoal?: string;
  requirementsUnderstood?: {
    outcome: string;
    suppliedInformation?: string[];
    constraints: string[];
    missingInformation: string[];
    contradictionsDetected?: string[];
    userSuppliedDetails?: string[];
  };
  executionPlanSummary?: Array<{
    id: string;
    title: string;
    stage: string;
    tool: string;
    toolType: ToolType;
    status: string;
    waveIndex?: number;
    parallelBatchId?: string;
    executionTimeMs?: number;
  }>;
  toolsActuallyUsed?: {
    realTools: string[];
    aiReasoning: string[];
    simulatedTools: string[];
  };
  verificationLayers?: VerificationLayers;
  artifactReconciliation?: ArtifactReconciliation;
  verificationEvidenceList?: string[];
  failuresOrLimitations?: string[];
  itemsRequiringApproval?: Array<{
    stepTitle: string;
    tool: string;
    reason: string;
    approvalStatus: string;
  }>;
  finalDeliverablesSummary?: Array<{
    name: string;
    format: string;
    status: string;
    validated?: boolean;
  }>;
  metrics: {
    totalSteps: number;
    verifiedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    realToolsExecuted: number;
    llmReasoningSteps: number;
    simulatedToolsRun: number;
    artifactsCount: number;
    executionMode: string;
  };
  performanceMetrics?: MissionPerformanceMetrics;
  deadlineAssessment?: DeadlineAssessment;
  groundingSources?: GroundingSource[];
  verifiedArtifacts: Array<{
    title: string;
    status: string;
    summary: string;
    isReal?: boolean;
  }>;
  completedWorkSummary?: string[];
  unresolvedIssues?: string[];
  riskAssessment: string[];
  edgeCasesIdentified?: string[];
  humanRecommendations: string[];
}

export interface Mission {
  id: string;
  ownerId?: string;
  migratedFromGuest?: boolean;
  title: string;
  goal: string;
  persona: string;
  executionDepth: string;
  targetDeadline: string;
  status:
    | 'idle'
    | 'planning'
    | 'awaiting_clarification'
    | 'executing'
    | 'awaiting_approval'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'failed';
  currentStage?: PhoenixStage;
  progress: number;
  currentStepId?: string;
  activeStepIds?: string[];
  lastCheckpointStepId?: string;
  understanding?: MissionUnderstanding;
  dagAnalysis?: DagAnalysisSummary;
  deadlineAssessment?: DeadlineAssessment;
  performanceMetrics?: MissionPerformanceMetrics;
  groundingSources?: GroundingSource[];
  phaseTimings?: {
    understandMs?: number;
    planMs?: number;
    executionMs?: number;
    verificationMs?: number;
    recoveryMs?: number;
  };
  clarificationAnswers?: Record<string, string>;
  clarificationResolved?: boolean;
  tasks: Task[];
  logs: ActivityLog[];
  artifacts: Artifact[];
  report?: VerificationReport;
  responseFeedback?: Record<string, ResponseFeedbackEntry>;
  startedAt: string;
  endedAt?: string;
  elapsedMs?: number;
  executionSpeed: number; // 1 | 2 | 4
}

export interface PresetMission {
  id: string;
  title: string;
  category: string;
  goal: string;
  persona: string;
  depth: string;
  badge: string;
  estimatedSec: number;
  hasRealTool?: boolean;
  isFlagship?: boolean;
  demoMode?: boolean;
}

export interface GuestTrialInfo {
  isGuest: boolean;
  missionsUsed: number;
  missionsLimit: number;
  missionsRemaining: number;
  stepsUsed: number;
  stepsLimit: number;
  chatUsed?: number;
  chatLimit?: number;
  expiresAt: string;
  continuityNotice: string;
}

export interface PendingGuestMissionSummary {
  id: string;
  title: string;
  goal: string;
  status: string;
  artifactsCount: number;
  startedAt: string;
}

export interface UserPreferences {
  defaultPersona?: string;
  defaultDepth?: string;
  soundEnabled?: boolean;
  advancedMode?: boolean;
  animationsEnabled?: boolean;
  privacyAcceptedAt?: string;
}

export interface WorkspaceSessionState {
  actorType: 'guest' | 'user';
  uid?: string;
  emailVerified?: boolean;
  isAdmin: boolean;
  guestToken?: string;
  guestTrial: GuestTrialInfo | null;
  preferences?: UserPreferences | null;
  pendingGuestMissions: PendingGuestMissionSummary[];
  pendingGuestChatCount?: number;
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

export interface AdminAggregateOverview {
  activeGuestSessions: number;
  registeredWorkspaces: number;
  totalGuestMissions: number;
  totalUserMissions: number;
  statusBreakdown: Record<string, number>;
  fallbackCount: number;
  fallbackEvents: FallbackLogEntry[];
  privacyGuarantee: string;
}


