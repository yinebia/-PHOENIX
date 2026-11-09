import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Cpu, 
  Layers, 
  ShieldAlert, 
  Terminal, 
  FileCode, 
  ArrowRight,
  GitBranch,
  Eye,
  AlertCircle,
  PlayCircle,
  Calculator,
  Check
} from 'lucide-react';
import { Task, Mission, Artifact } from '../types/agent';

interface TaskPlannerViewProps {
  mission: Mission;
  onSelectArtifact?: (artifact: Artifact) => void;
}

export const TaskPlannerView: React.FC<TaskPlannerViewProps> = ({
  mission,
  onSelectArtifact,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'dag'>('cards');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(mission.currentStepId || null);

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
      case 'paused':
        return <Clock className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-slate-600 shrink-0" />;
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'discovery':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40';
      case 'architecture':
        return 'text-purple-400 bg-purple-950/60 border-purple-800/40';
      case 'execution':
        return 'text-indigo-400 bg-indigo-950/60 border-indigo-800/40';
      case 'validation':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
      case 'delivery':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar with summary & view toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-purple-900/30">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display font-bold text-base text-slate-100">
              Autonomous DAG Execution Graph
            </h3>
            <span className="text-xs font-mono text-purple-300 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/40">
              {mission.tasks.length} Deconstructed Steps
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            AI-generated plan strictly distinguishing genuine executable tools from simulated demo containers.
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
          <div className="min-w-[680px] flex items-center justify-between relative py-6">
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-purple-800 via-indigo-700 to-cyan-800 -translate-y-1/2 z-0" />

            {mission.tasks.map((task, idx) => {
              const isCurrent = mission.currentStepId === task.id;
              const isDone = task.status === 'completed';
              const isReal = task.toolType === 'REAL' || task.tool === 'calculator';
              return (
                <div key={task.id} className="relative z-10 flex flex-col items-center group max-w-[150px]">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isDone
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
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
                    ) : (
                      <span className="font-mono text-xs font-bold">0{idx + 1}</span>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${getPhaseColor(task.phase)}`}>
                      {task.phase}
                    </span>
                    <h5 className="font-sans font-medium text-xs text-slate-200 mt-1 line-clamp-2">
                      {task.title}
                    </h5>
                    <span className={`text-[10px] font-mono mt-0.5 block ${isReal ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                      {isReal ? '[REAL TOOL]' : task.simulated ? '[SIMULATED]' : '[LIVE AI]'}
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
          const isReal = task.toolType === 'REAL' || task.tool === 'calculator';

          return (
            <div
              key={task.id}
              className={`glass-panel rounded-xl border transition-all overflow-hidden ${
                isCurrent
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
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getPhaseColor(task.phase)}`}>
                        {task.phase}
                      </span>
                      {isReal ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          GENUINE REAL TOOL (CALLABLE)
                        </span>
                      ) : task.simulated ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                          SIMULATED DEMO (SAFE SANDBOX)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-800/50">
                          LIVE AI REASONING
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
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {task.estimatedDurationSec}s est
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

                  {/* Genuine Tool Execution Card if executed */}
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
                          <span className="text-slate-500 text-[10px] block">Input Expression</span>
                          <span className="text-cyan-300 font-bold">{task.toolInput?.expression || task.toolOutput.inputExpression}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Actual Output</span>
                          <span className="text-emerald-300 font-bold text-sm">{task.toolOutput.result !== undefined ? task.toolOutput.result : JSON.stringify(task.toolOutput)}</span>
                        </div>
                      </div>
                      {task.toolOutput.executionTimeMs && (
                        <div className="text-[10px] text-slate-400">
                          Execution Latency: <span className="text-cyan-300 font-semibold">{task.toolOutput.executionTimeMs}ms</span> (Zero mock evaluation)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Pane if failed */}
                  {task.status === 'failed' && task.error && (
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 font-mono text-xs text-rose-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 uppercase text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        Tool Execution Error Recorded:
                      </div>
                      <p className="font-sans text-rose-200">{task.error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Assigned Tool</span>
                      <span className="text-cyan-300 font-semibold">{task.tool}</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        {isReal ? 'Real callable engine (backend evaluated)' : task.simulated ? 'Safe demo simulation container' : 'Direct neural reasoning'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase block">Expected Deliverable</span>
                      <span className="text-purple-300 font-semibold">{task.expectedArtifact}</span>
                    </div>
                  </div>

                  {/* Real-time reasoning trace */}
                  {task.reasoning && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-cyan-400 uppercase flex items-center gap-1.5 font-semibold">
                        <Terminal className="w-3.5 h-3.5" />
                        Agent Cognitive Reasoning & Execution Trace
                      </span>
                      <p className="text-xs text-slate-200 bg-cyan-950/20 border border-cyan-800/30 p-3 rounded-lg leading-relaxed font-sans">
                        {task.reasoning}
                      </p>
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
                            Format: {task.outputArtifact.format.toUpperCase()} • {task.outputArtifact.isRealExecution ? 'REAL DATA' : 'SIMULATED DATA'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onSelectArtifact(task.outputArtifact!)}
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono flex items-center gap-1 shadow-md transition-colors"
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
