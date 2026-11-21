import React from 'react';
import {
  Volume2,
  VolumeX,
  History,
  HelpCircle,
  Activity,
  Compass,
  UserCheck,
  LogIn,
  ShieldAlert,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Mission } from '../types/agent';
import { BRAND_CONFIG } from '../config/brand';
import { PhoenixEmblem, EmblemMood } from './PhoenixEmblem';

interface NavbarProps {
  currentMission: Mission | null;
  historyCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  animationsEnabled: boolean;
  onToggleAnimations: () => void;
  advancedMode: boolean;
  onToggleAdvancedMode: () => void;
  onOpenHistory: () => void;
  onOpenHelp: () => void;
  onNewMission: () => void;
  onOpenChat: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accountEmail?: string | null;
  accountName?: string | null;
  isVerifiedAccount?: boolean;
  isAdmin?: boolean;
  onOpenAccount: () => void;
  onOpenAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMission,
  historyCount,
  soundEnabled,
  onToggleSound,
  animationsEnabled,
  onToggleAnimations,
  advancedMode,
  onToggleAdvancedMode,
  onOpenHistory,
  onOpenHelp,
  onOpenChat,
  activeTab,
  setActiveTab,
  accountEmail,
  accountName,
  isVerifiedAccount,
  isAdmin,
  onOpenAccount,
  onOpenAdmin,
}) => {
  const emblemMood: EmblemMood = !currentMission
    ? 'idle'
    : currentMission.status === 'failed'
    ? 'error'
    : currentMission.status === 'completed'
    ? currentMission.report?.metrics?.failedSteps || currentMission.report?.metrics?.skippedSteps
      ? 'partial'
      : 'celebrating'
    : currentMission.status === 'executing' || currentMission.status === 'planning'
    ? 'active'
    : 'idle';

  const getStatusLabel = () => {
    if (!currentMission || currentMission.status === 'idle') return null;
    if (currentMission.status === 'planning') {
      return {
        text: advancedMode ? 'Planning' : 'Understanding your goal',
        cls: 'text-purple-200 border-purple-500/40 bg-purple-950/50',
      };
    }
    if (currentMission.status === 'awaiting_clarification') {
      return {
        text: advancedMode ? 'Clarification Needed' : 'Quick question for you',
        cls: 'text-cyan-200 border-cyan-500/50 bg-cyan-950/50',
      };
    }
    if (currentMission.status === 'awaiting_approval') {
      return {
        text: advancedMode ? 'Approval Required' : 'Needs your approval',
        cls: 'text-amber-200 border-amber-500/50 bg-amber-950/50',
      };
    }
    if (currentMission.status === 'executing') {
      return {
        text: advancedMode
          ? `Executing (${Math.round(currentMission.progress)}%)`
          : `Working (${Math.round(currentMission.progress)}%)`,
        cls: 'text-cyan-200 border-cyan-500/40 bg-cyan-950/50',
      };
    }
    if (currentMission.status === 'paused') {
      return {
        text: 'Paused',
        cls: 'text-amber-200 border-amber-500/40 bg-amber-950/40',
      };
    }
    if (currentMission.status === 'failed') {
      return {
        text: advancedMode ? 'Recovery Needed' : 'Needs attention',
        cls: 'text-rose-200 border-rose-500/50 bg-rose-950/50',
      };
    }
    if (currentMission.status === 'completed') {
      const hasIssues =
        currentMission.report &&
        (currentMission.report.metrics.failedSteps > 0 ||
          currentMission.report.metrics.skippedSteps > 0 ||
          (currentMission.report.metrics.simulatedToolsRun ?? 0) > 0);
      return hasIssues
        ? {
            text: advancedMode ? 'Partial / Draft Ready' : 'Draft ready',
            cls: 'text-amber-200 border-amber-500/40 bg-amber-950/40',
          }
        : {
            text: advancedMode ? 'Verified & Ready' : 'Ready for you',
            cls: 'text-amber-200 border-amber-400/50 bg-amber-950/35',
          };
    }
    if (currentMission.status === 'cancelled') {
      return {
        text: 'Stopped',
        cls: 'text-slate-300 border-slate-700 bg-slate-900/70',
      };
    }
    return null;
  };

  const statusBadge = getStatusLabel();
  const hasActiveProject = Boolean(currentMission && currentMission.status !== 'idle');

  return (
    <header className="sticky top-0 z-40 bg-[#090A12]/92 backdrop-blur-xl border-b border-amber-500/15">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Left: Golden Phoenix Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl cursor-pointer shrink-0 min-h-[44px]"
            >
              <PhoenixEmblem
                size="sm"
                mood={emblemMood}
                animationsEnabled={animationsEnabled}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-base sm:text-lg tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 bg-clip-text text-transparent whitespace-nowrap">
                    {BRAND_CONFIG.name}
                  </span>
                </div>
                <p className="text-[10px] font-mono tracking-[0.16em] text-amber-300/80 hidden sm:block whitespace-nowrap">
                  {BRAND_CONFIG.descriptor}
                </p>
              </div>
            </button>

            {statusBadge && (
              <div className="hidden lg:flex items-center pl-3 ml-1 border-l border-slate-800">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono border ${statusBadge.cls}`}
                >
                  {statusBadge.text}
                </span>
              </div>
            )}
          </div>

          {/* Right: Clean Everyday Navigation & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenChat}
              className="min-h-[44px] px-2.5 sm:px-3 rounded-lg text-xs font-medium text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/35 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              title="Talk with PHOENIX"
            >
              <MessageSquare className="w-4 h-4 text-cyan-300" />
              <span className="hidden sm:inline">Chat</span>
            </button>

            <button
              type="button"
              onClick={onOpenHistory}
              className="min-h-[44px] px-2.5 sm:px-3 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors border border-slate-800 flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title={advancedMode ? 'Missions Archive' : 'Your saved projects'}
            >
              <History className="w-4 h-4 text-amber-300" />
              <span className="hidden md:inline">
                {advancedMode ? 'Missions' : 'Projects'}
              </span>
              {historyCount > 0 && (
                <span className="text-[11px] font-mono text-amber-300 font-semibold tabular-nums">
                  ({historyCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleAdvancedMode}
              className={`min-h-[44px] px-2.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                advancedMode
                  ? 'bg-purple-600/25 border-purple-400/60 text-purple-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={
                advancedMode
                  ? 'Switch back to simple everyday mode'
                  : 'Turn on Advanced Mode for technical tools, DAG & logs'
              }
              aria-pressed={advancedMode}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {advancedMode ? 'Advanced On' : 'Advanced'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAccount}
              className={`min-h-[44px] px-2.5 sm:px-3 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                accountEmail
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/20'
                  : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:border-amber-400/50 hover:text-amber-200'
              }`}
              title={
                accountEmail
                  ? `Signed in as ${accountEmail}`
                  : 'Sign in or create a free account to save your work'
              }
            >
              {accountEmail ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="hidden lg:inline max-w-[110px] truncate">
                    {accountName || accountEmail.split('@')[0]}
                  </span>
                  {!isVerifiedAccount && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-400"
                      title="Email verification pending"
                    />
                  )}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">Sign In</span>
                </>
              )}
            </button>

            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center justify-center"
                title="Admin Overview"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onToggleAnimations}
              className={`hidden sm:flex min-h-[44px] min-w-[44px] p-2 rounded-lg border transition-colors cursor-pointer items-center justify-center ${
                animationsEnabled
                  ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                  : 'text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title={
                animationsEnabled
                  ? 'Celebration effects ON (click to disable)'
                  : 'Celebration effects OFF (click to enable)'
              }
              aria-pressed={animationsEnabled}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              className={`min-h-[44px] min-w-[44px] p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                soundEnabled
                  ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
                  : 'text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'Mute sound cues' : 'Enable sound cues'}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              className="hidden sm:flex min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-400 hover:text-amber-200 hover:bg-slate-800/60 transition-colors border border-slate-800 cursor-pointer items-center justify-center"
              title="How PHOENIX works"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Navigation Strip — shown cleanly when a project is active */}
        {hasActiveProject && currentMission && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 border-t border-slate-800/70 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-400/45 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-300" />
              <span>{advancedMode ? 'Command Centre' : 'Home'}</span>
            </button>

            <span className="text-slate-700 px-0.5 select-none">|</span>

            {advancedMode && (
              <button
                type="button"
                onClick={() => setActiveTab('planner')}
                className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'planner'
                    ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>Plan &amp; DAG</span>
                {currentMission.tasks.length > 0 && (
                  <span className="text-[10px] text-purple-300 tabular-nums">
                    ({currentMission.tasks.length})
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('execution')}
              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'execution'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <span>{advancedMode ? 'Execution Monitor' : 'Working on it'}</span>
              <span className="text-[11px] font-mono text-cyan-300 tabular-nums">
                {Math.round(currentMission.progress)}%
              </span>
            </button>

            {advancedMode && (
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Logs</span>
                {currentMission.logs.length > 0 && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    ({currentMission.logs.length})
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'report'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <span>{advancedMode ? 'Mission Delivery' : 'Your results'}</span>
              {currentMission.report && (
                <span className="text-[11px] font-mono text-amber-300 font-bold tabular-nums">
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
