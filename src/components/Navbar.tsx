import React from 'react';
import { Flame, Volume2, VolumeX, History, HelpCircle, Activity, Play, PlusCircle, ShieldAlert } from 'lucide-react';
import { Mission } from '../types/agent';

interface NavbarProps {
  currentMission: Mission | null;
  historyCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHistory: () => void;
  onOpenHelp: () => void;
  onNewMission: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMission,
  historyCount,
  soundEnabled,
  onToggleSound,
  onOpenHistory,
  onOpenHelp,
  onNewMission,
  activeTab,
  setActiveTab,
}) => {
  const getStatusBadge = () => {
    if (!currentMission || currentMission.status === 'idle') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          STANDBY
        </span>
      );
    }
    if (currentMission.status === 'planning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-500/40 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          PLANNING DAG
        </span>
      );
    }
    if (currentMission.status === 'executing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          EXECUTING ({Math.round(currentMission.progress)}%)
        </span>
      );
    }
    if (currentMission.status === 'paused') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/40">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          PAUSED
        </span>
      );
    }
    if (currentMission.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          VERIFIED SATISFIED
        </span>
      );
    }
    if (currentMission.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-500/15 text-rose-300 border border-rose-500/40">
          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          ABORTED
        </span>
      );
    }
    return null;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090A12]/90 backdrop-blur-xl border-b border-purple-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
                <div className="w-full h-full bg-[#0B0D17] rounded-[11px] flex items-center justify-center">
                  <Flame className="w-5 h-5 text-cyan-400 group-hover:text-purple-300 transition-colors animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-lg tracking-wider bg-gradient-to-r from-purple-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                    PHOENIX
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    v3.8
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                  Autonomous Goal-Driven AI Agent
                </p>
              </div>
            </button>

            <div className="hidden md:block ml-4 pl-4 border-l border-slate-800">
              {getStatusBadge()}
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onNewMission}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Launch new goal"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Goal</span>
            </button>

            <button
              onClick={onOpenHistory}
              className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors border border-slate-800"
              title="Project History & Archives"
            >
              <History className="w-4 h-4" />
              {historyCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 font-mono">
                  {historyCount}
                </span>
              )}
            </button>

            <button
              onClick={onToggleSound}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                  : 'text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
              title={soundEnabled ? 'Mute Audio FX' : 'Enable Cyber Audio Cues'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/30 transition-colors border border-slate-800"
              title="Agent Architecture & Beginner Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation for Active Mission */}
        {currentMission && currentMission.status !== 'idle' && (
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/60 no-scrollbar">
            <button
              onClick={() => setActiveTab('planner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'planner'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>01 // Task Planner</span>
              {currentMission.tasks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900/60 text-purple-300">
                  {currentMission.tasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('execution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'execution'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>02 // Execution Monitor</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-400">
                {Math.round(currentMission.progress)}%
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>03 // Activity Logs</span>
              {currentMission.logs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-400">
                  {currentMission.logs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>04 // Verification Report</span>
              {currentMission.report && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-400 font-bold">
                  {currentMission.report.satisfactionScore}%
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
