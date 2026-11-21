import React from 'react';
import {
  Pause,
  Play,
  Square,
  StepForward,
  RotateCcw,
  ShieldAlert,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Mission } from '../types/agent';

interface ExecutionControlsProps {
  mission: Mission;
  isLoopRunning?: boolean;
  advancedMode?: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onStepNext: () => void;
  onSetSpeed: (speed: number) => void;
  onRestart: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  mission,
  isLoopRunning = true,
  advancedMode = false,
  onPause,
  onResume,
  onCancel,
  onStepNext,
  onSetSpeed,
  onRestart,
}) => {
  const isExecuting = mission.status === 'executing' && isLoopRunning;
  const canResumeCheckpoint =
    mission.status === 'paused' || (mission.status === 'executing' && !isLoopRunning);
  const isAwaitingClarification = mission.status === 'awaiting_clarification';
  const isAwaitingApproval = mission.status === 'awaiting_approval';
  const isFailed = mission.status === 'failed';
  const isFinished =
    mission.status === 'completed' ||
    mission.status === 'cancelled' ||
    mission.status === 'failed';

  const friendlyStatus =
    isExecuting
      ? 'Working on your goal'
      : isAwaitingClarification
      ? 'Quick question below'
      : isAwaitingApproval
      ? 'Waiting for your approval'
      : canResumeCheckpoint
      ? 'Paused safely'
      : isFailed
      ? 'Needs your attention'
      : mission.status === 'completed'
      ? 'Finished'
      : mission.status === 'cancelled'
      ? 'Stopped'
      : 'Getting ready';

  return (
    <div className="glass-panel px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 border-amber-400/20 shadow-xl">
      {/* Left: Project status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 shrink-0">
          {isAwaitingApproval ? (
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          ) : isFailed ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <Activity
              className={`w-4 h-4 ${
                isExecuting || isAwaitingClarification
                  ? 'text-cyan-400'
                  : canResumeCheckpoint
                  ? 'text-amber-400'
                  : 'text-amber-300'
              }`}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
            {advancedMode && (
              <>
                <span className="font-mono uppercase tracking-wider">Controls</span>
                <span className="text-slate-600">·</span>
              </>
            )}
            <span
              className={`font-medium ${
                isExecuting || isAwaitingClarification
                  ? 'text-cyan-300'
                  : isAwaitingApproval || canResumeCheckpoint
                  ? 'text-amber-300'
                  : isFailed
                  ? 'text-rose-400'
                  : 'text-amber-200'
              }`}
            >
              {advancedMode ? mission.status.replace('_', ' ').toUpperCase() : friendlyStatus}
            </span>
            {advancedMode && mission.currentStage && (
              <>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-purple-300 font-mono hidden sm:inline">
                  {mission.currentStage}
                </span>
              </>
            )}
          </div>
          <p className="text-xs font-medium text-slate-100 truncate max-w-[200px] sm:max-w-sm font-sans">
            {mission.title}
          </p>
        </div>
      </div>

      {/* Center: Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {isExecuting && (
          <button
            type="button"
            onClick={onPause}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-all cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        )}

        {canResumeCheckpoint && (
          <>
            <button
              type="button"
              onClick={onResume}
              className="min-h-[40px] flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </button>

            {advancedMode && mission.status === 'paused' && isLoopRunning && (
              <button
                type="button"
                onClick={onStepNext}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition-all cursor-pointer"
              >
                <StepForward className="w-3.5 h-3.5" />
                <span>Step Next</span>
              </button>
            )}
          </>
        )}

        {(isExecuting || canResumeCheckpoint || isAwaitingApproval || isAwaitingClarification) && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/35 transition-all cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>{advancedMode ? 'Cancel' : 'Stop'}</span>
          </button>
        )}

        {isFinished && (
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{advancedMode ? 'Rerun' : 'Run Again'}</span>
          </button>
        )}
      </div>

      {/* Right: Speed Multipliers (Advanced Mode only) */}
      {advancedMode && (
        <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">Speed:</span>
          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSetSpeed(spd)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
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
      )}
    </div>
  );
};
