import React from 'react';
import {
  X,
  History,
  CheckCircle2,
  Clock,
  ChevronRight,
  Trash2,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { Mission } from '../types/agent';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  onSelectMission: (mission: Mission) => void;
  onDeleteMission?: (missionId: string) => void;
  onClearHistory: () => void;
  isGuest?: boolean;
  onOpenAuthModal?: (reason?: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  missions,
  onSelectMission,
  onDeleteMission,
  onClearHistory,
  isGuest = true,
  onOpenAuthModal,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0A0C16] border-l border-purple-500/20 h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider">
                Your Projects
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                {missions.length} {isGuest ? 'Guest Session Projects' : 'Private Account Projects'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {missions.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Delete all saved projects in current workspace"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Notice Banner */}
        <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-[11px] flex items-center justify-between gap-2">
          {isGuest ? (
            <>
              <span className="text-slate-400">
                Guest session storage (isolated 24h)
              </span>
              {onOpenAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal('Create a free account to keep your projects permanently across sessions.');
                  }}
                  className="text-amber-300 hover:underline font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Save to Account</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-emerald-300 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Private Account Workspace Active</span>
            </span>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {missions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <History className="w-10 h-10 opacity-30" />
              <p className="text-xs font-sans">
                No projects yet. Tell PHOENIX what you&apos;d like to achieve from the Home screen to begin.
              </p>
            </div>
          ) : (
            missions.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  onSelectMission(m);
                  onClose();
                }}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-900 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                  <span className="text-purple-300 font-semibold">{m.persona}</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(m.startedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {onDeleteMission && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMission(m.id);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                        title="Delete this mission"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h4 className="font-display font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {m.title}
                </h4>
                <p className="text-xs text-slate-400 font-sans line-clamp-2 mt-1">
                  {m.goal}
                </p>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    {m.status === 'completed' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {m.report ? `${m.report.satisfactionScore}% Score` : 'Completed'}
                      </span>
                    ) : (
                      <span className="text-cyan-400">
                        {Math.round(m.progress)}% · {m.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <span className="text-slate-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                    <span>{m.status === 'paused' ? 'Open & Resume' : 'Inspect'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

