import React from 'react';
import { 
  X, 
  History, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Trash2, 
  RotateCcw,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { Mission } from '../types/agent';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  onSelectMission: (mission: Mission) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  missions,
  onSelectMission,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
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
                Mission Archives
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                {missions.length} Persisted Projects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {missions.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                title="Wipe archived missions"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {missions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <History className="w-10 h-10 opacity-30" />
              <p className="text-xs font-mono">No past missions in history archive.</p>
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
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(m.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
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
                        {Math.round(m.progress)}% Progress
                      </span>
                    )}
                  </div>

                  <span className="text-slate-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                    <span>Inspect</span>
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
