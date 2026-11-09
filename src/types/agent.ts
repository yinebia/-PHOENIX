export type TaskStatus = 'pending' | 'running' | 'retrying' | 'completed' | 'failed' | 'paused' | 'skipped';

export type LogLevel = 'INFO' | 'REASONING' | 'EXEC' | 'SUCCESS' | 'WARN' | 'ARTIFACT' | 'RETRY' | 'ERROR';

export type ToolType = 'REAL' | 'SIMULATED' | 'LLM_REASONING';

export interface ActivityLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  title: string;
  message: string;
  stepId?: string;
  simulated?: boolean;
  toolType?: ToolType;
  payload?: any;
}

export interface Artifact {
  id: string;
  name: string;
  format: string; // 'json' | 'markdown' | 'typescript' | 'yaml' | 'text'
  content: string;
  stepId?: string;
  timestamp: string;
  isRealExecution?: boolean;
}

export interface Task {
  id: string;
  title: string;
  phase: string;
  tool: string;
  simulated: boolean;
  toolType: ToolType;
  description: string;
  expectedArtifact: string;
  estimatedDurationSec: number;
  dependencies: string[];
  status: TaskStatus;
  toolInput?: any;
  toolOutput?: any;
  executionTimeMs?: number;
  retryCount?: number;
  maxRetries?: number;
  error?: string;
  reasoning?: string;
  executionBadge?: string;
  logs?: string[];
  outputArtifact?: Artifact;
  verificationPassed?: boolean;
}

export interface VerificationReport {
  verificationStatus: string;
  satisfactionScore: number;
  executiveSummary: string;
  environmentNote: string;
  metrics: {
    totalSteps: number;
    verifiedSteps: number;
    realToolsExecuted: number;
    simulatedToolsRun: number;
    artifactsCount: number;
    executionMode: string;
  };
  verifiedArtifacts: Array<{
    title: string;
    status: string;
    summary: string;
    isReal?: boolean;
  }>;
  riskAssessment: string[];
  edgeCasesIdentified?: string[];
  humanRecommendations: string[];
}

export interface Mission {
  id: string;
  title: string;
  goal: string;
  persona: string;
  executionDepth: string;
  targetDeadline: string;
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'cancelled' | 'failed';
  progress: number;
  currentStepId?: string;
  tasks: Task[];
  logs: ActivityLog[];
  artifacts: Artifact[];
  report?: VerificationReport;
  startedAt: string;
  endedAt?: string;
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
}
