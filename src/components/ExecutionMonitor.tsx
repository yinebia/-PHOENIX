import React from 'react';
import { 
  Activity, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  Zap, 
  Terminal, 
  ShieldCheck, 
  FileCode,
  Gauge,
  Sparkles,
  ArrowRight,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { Mission, Artifact } from '../types/agent';

interface ExecutionMonitorProps {
  mission: Mission;
  onSelectArtifact?: (artifact: Artifact) => void;
  onViewReport?: () => void;
}

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  mission,
  onSelectArtifact,
  onViewReport,
}) => {
  const completedSteps = mission.tasks.filter((t) => t.status === 'completed').length;
  const totalSteps = mission.tasks.length;
  const currentTask = mission.tasks.find((t) => t.id === mission.currentStepId);
  const isFinished = mission.status === 'completed';
  const isFailed = mission.status === 'failed';
  const realToolsCount = mission.tasks.filter((t) => t.toolType === 'REAL' || t.tool === 'calculator').length;

  // Calculate SVG circular progress
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (mission.progress / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Top Telemetry & Radial Progress Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-purple-500/20 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -mr-28 -mt-28" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -ml-28 -mb-28" />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left: Mission info & Phase progress */}
          <div className="space-y-3 flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>ACTIVE MISSION // {mission.persona.toUpperCase()}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide">
              {mission.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-xl">
              {mission.goal}
            </p>

            {/* Linear Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Execution Milestones: <span className="text-cyan-300 font-bold">{completedSteps}</span> / {totalSteps} Tasks
                </span>
                <span className="text-purple-300 font-bold">{Math.round(mission.progress)}% COMPLETED</span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm ${
                    isFailed 
                      ? 'bg-rose-500 shadow-rose-500/50' 
                      : 'bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 shadow-cyan-400/50'
                  }`}
                  style={{ width: `${mission.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Circular HUD Gauge */}
          <div className="relative flex flex-col items-center justify-center shrink-0">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke="#1E2337"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke={isFailed ? '#F43F5E' : 'url(#phoenixGradient)'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 ease-out"
                />
                <defs>
                  <linearGradient id="phoenixGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black font-display text-white tracking-tight">
                  {Math.round(mission.progress)}%
                </span>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isFailed ? 'text-rose-400 font-bold' : 'text-cyan-400'}`}>
                  {mission.status}
                </span>
              </div>
            </div>

            <div className="mt-2 text-center text-[11px] font-mono text-slate-400">
              {completedSteps === totalSteps 
                ? 'ALL GATES CLEARED' 
                : isFailed 
                ? 'EXECUTION HALTED ON ERROR'
                : `TASK ${Math.min(completedSteps + 1, totalSteps)} OF ${totalSteps}`}
            </div>
          </div>
        </div>

        {/* Live telemetry counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              <Calculator className="w-3 h-3 text-emerald-400" />
              Tool Registry Mode
            </div>
            <div className="text-sm font-mono font-bold text-emerald-300 mt-1">
              {realToolsCount > 0 ? `${realToolsCount} Genuine Tool${realToolsCount > 1 ? 's' : ''}` : 'Safe Demo Sandbox'}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {realToolsCount > 0 ? 'Backend Evaluated' : 'Isolated Containers'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-400" />
              Neural Reasoning
            </div>
            <div className="text-sm font-mono font-bold text-purple-300 mt-1">
              Gemini 3.8 Flash
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Direct Server Proxy
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Verification Gate
            </div>
            <div className="text-sm font-mono font-bold text-cyan-300 mt-1">
              Deterministic
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Zero Fake Executions
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              <FileCode className="w-3 h-3 text-indigo-400" />
              Artifact Vault
            </div>
            <div className="text-sm font-mono font-bold text-indigo-300 mt-1">
              {mission.artifacts.length} Deliverables
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Verifiable Outputs
            </div>
          </div>
        </div>
      </div>

      {/* Active Step Live Execution Card */}
      {currentTask && mission.status === 'executing' && (
        <div className="glass-panel p-5 rounded-2xl border-cyan-500/50 relative overflow-hidden shadow-xl ring-1 ring-cyan-500/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  Currently Executing Step
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {currentTask.phase.toUpperCase()}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-semibold">
                  TOOL: {currentTask.tool}
                </span>
              </div>
              <h3 className="text-lg font-display font-bold text-white pt-1">
                {currentTask.title}
              </h3>
              <p className="text-xs text-slate-300 font-sans">
                {currentTask.description}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className={`text-xs font-mono px-2.5 py-1 rounded border ${
                currentTask.toolType === 'REAL' || currentTask.tool === 'calculator'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold'
                  : currentTask.simulated
                  ? 'bg-slate-900 text-slate-400 border-slate-700'
                  : 'bg-purple-950 text-purple-300 border-purple-800'
              }`}>
                {currentTask.toolType === 'REAL' || currentTask.tool === 'calculator' 
                  ? '[GENUINE REAL TOOL]' 
                  : currentTask.simulated 
                  ? '[SIMULATED DEMO]' 
                  : '[LIVE AI]'}
              </span>
            </div>
          </div>

          {/* Real-time reasoning telemetry */}
          {currentTask.reasoning && (
            <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 font-mono text-xs text-cyan-200 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px] uppercase">
                <Terminal className="w-3.5 h-3.5" />
                Live Agent Cognitive Stream:
              </div>
              <p className="font-sans leading-relaxed text-slate-200">
                {currentTask.reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Failure State Callout */}
      {isFailed && (
        <div className="glass-panel p-6 rounded-2xl border-rose-500/50 bg-rose-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-base text-white">
                Task Execution Halted on Real Error
              </h4>
              <p className="text-xs text-rose-200">
                A tool encountered a fatal execution or verification error. PHOENIX stopped honestly without inventing a successful result.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Finished State Callout */}
      {isFinished && (
        <div className="glass-panel p-6 rounded-2xl border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 to-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-base text-white">
                Mission Execution Successfully Concluded
              </h4>
              <p className="text-xs text-slate-300">
                All scheduled DAG operations and sanity assertions verified with zero fatal anomalies.
              </p>
            </div>
          </div>

          {onViewReport && (
            <button
              onClick={onViewReport}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Inspect Verification Report</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Generated Artifacts Grid */}
      {mission.artifacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-purple-400" />
              Generated Mission Deliverables & Artifacts ({mission.artifacts.length})
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              Click to view code / data
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {mission.artifacts.map((art) => (
              <div
                key={art.id}
                onClick={() => onSelectArtifact && onSelectArtifact(art)}
                className={`glass-panel-interactive p-3.5 rounded-xl cursor-pointer group flex items-center justify-between ${
                  art.isRealExecution ? 'border-emerald-500/40' : 'border-purple-900/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-lg border text-purple-300 group-hover:text-cyan-300 transition-colors ${
                    art.isRealExecution ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300' : 'bg-purple-950/80 border-purple-800/60'
                  }`}>
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                      {art.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">
                      {art.format} • {art.isRealExecution ? 'REAL DATA' : 'SIMULATED'}
                    </div>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-cyan-400 text-xs font-mono transition-colors">
                  &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
