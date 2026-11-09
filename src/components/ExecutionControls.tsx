import React from 'react';
import { 
  Pause, 
  Play, 
  Square, 
  FastForward, 
  StepForward, 
  RotateCcw,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { Mission } from '../types/agent';

interface ExecutionControlsProps {
  mission: Mission;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onStepNext: () => void;
  onSetSpeed: (speed: number) => void;
  onRestart: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  mission,
  onPause,
  onResume,
  onCancel,
  onStepNext,
  onSetSpeed,
  onRestart,
}) => {
  const isExecuting = mission.status === 'executing';
  const isPaused = mission.status === 'paused';
  const isFinished = mission.status === 'completed' || mission.status === 'cancelled';

  return (
    <div className="glass-panel px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-4 border-purple-500/30 shadow-xl">
      {/* Left: Mission status & active task info */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-700">
          <Activity className={`w-4 h-4 ${isExecuting ? 'text-cyan-400 animate-pulse' : isPaused ? 'text-amber-400' : 'text-slate-400'}`} />
          {isExecuting && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          )}
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Execution Controls</span>
            <span className="text-slate-600">|</span>
            <span className={isExecuting ? 'text-cyan-400' : isPaused ? 'text-amber-400' : 'text-slate-300'}>
              {mission.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-200 truncate max-w-[200px] sm:max-w-xs font-sans">
            {mission.title}
          </p>
        </div>
      </div>

      {/* Center: Reactive Action Buttons */}
      <div className="flex items-center gap-2">
        {isExecuting && (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10 transition-all active:scale-95 cursor-pointer"
            title="Pause active execution pipeline"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>PAUSE</span>
          </button>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer animate-pulse"
              title="Resume execution"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RESUME</span>
            </button>

            <button
              onClick={onStepNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-all active:scale-95 cursor-pointer"
              title="Execute next single step manually"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>STEP NEXT</span>
            </button>
          </>
        )}

        {(isExecuting || isPaused) && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all active:scale-95 cursor-pointer"
            title="Safely cancel and abort mission"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>CANCEL</span>
          </button>
        )}

        {isFinished && (
          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition-all active:scale-95 cursor-pointer"
            title="Rerun this mission"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RERUN</span>
          </button>
        )}
      </div>

      {/* Right: Simulation Speed Multipliers */}
      <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
        <span className="text-[11px] font-mono text-slate-400 hidden md:inline">Speed:</span>
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          {[1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                mission.executionSpeed === spd
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
