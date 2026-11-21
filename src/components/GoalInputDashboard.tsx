import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  Clock,
  Compass,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldAlert,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
  Play,
} from 'lucide-react';
import { PRESET_MISSIONS, ILLUSTRATIVE_DEMO_PRESET } from '../data/presetMissions';
import { GuestTrialInfo, Mission, PresetMission } from '../types/agent';
import { BRAND_CONFIG, FRIENDLY_SUGGESTIONS } from '../config/brand';
import { PhoenixEmblem } from './PhoenixEmblem';

interface GoalInputDashboardProps {
  onStartMission: (params: {
    goal: string;
    persona: string;
    executionDepth: string;
    targetDeadline: string;
    demoMode?: boolean;
  }) => void;
  isPlanning: boolean;
  missions?: Mission[];
  activeMissionId?: string;
  onSelectMission?: (mission: Mission) => void;
  isGuest?: boolean;
  guestTrial?: GuestTrialInfo | null;
  accountEmail?: string | null;
  onOpenAuthModal?: (reason?: string) => void;
  defaultPersona?: string;
  defaultDepth?: string;
  advancedMode?: boolean;
  onToggleAdvancedMode?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  animationsEnabled?: boolean;
  onToggleAnimations?: () => void;
}

const PERSONAS = [
  {
    id: 'Vanguard Architect',
    name: 'Vanguard',
    role: 'Systems & Web Architect',
    desc: 'Plans digital products, web applications, system contracts, and structured technical deliverables.',
    icon: Layers,
    color: 'from-purple-500 to-indigo-600',
    border: 'border-purple-500/40',
  },
  {
    id: 'Apex Growth',
    name: 'Apex',
    role: 'Business & Market Execution',
    desc: 'Turns business, recruitment, and growth intentions into strategies, catalogues, landing pages, and workflows.',
    icon: BarChart3,
    color: 'from-pink-500 to-rose-600',
    border: 'border-pink-500/40',
  },
  {
    id: 'Chronos Ops',
    name: 'Chronos',
    role: 'Calculation, Data & Ops',
    desc: 'Executes precision math, budget calculations, deterministic verification, and workflow coordination.',
    icon: Cpu,
    color: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-500/40',
  },
  {
    id: 'Cyber Sentinel',
    name: 'Sentinel',
    role: 'Risk & Policy Auditor',
    desc: 'Evaluates operational risks, enforces approval gates, and audits security configurations.',
    icon: ShieldCheck,
    color: 'from-cyan-500 to-blue-600',
    border: 'border-cyan-500/40',
  },
];

const FRIENDLY_PACES = [
  { id: 'Rapid Sprint', label: 'Quick & concise', desc: 'Faster overview with key steps' },
  { id: 'Standard DAG', label: 'Balanced (Recommended)', desc: 'Clear plan, checks & complete files' },
  { id: 'Deep Rigor', label: 'Thorough & detailed', desc: 'Extra depth and careful checking' },
];

const DEPTHS = [
  { id: 'Rapid Sprint', title: 'Rapid Sprint', steps: '3-4 Tasks', time: '~4-8s' },
  { id: 'Standard DAG', title: 'Standard DAG', steps: '4-5 Tasks', time: '~8-14s' },
  { id: 'Deep Rigor', title: 'Deep Rigor', steps: '5-6 Tasks', time: '~14-22s' },
];

const INTELLIGENCE_STAGES = [
  { num: '01', title: 'Understand Intention', desc: 'Clarifies outcome, constraints, and missing inputs' },
  { num: '02', title: 'Research & Strategise', desc: 'Identifies opportunities, risks, and tool fit' },
  { num: '03', title: 'Plan & Dependencies', desc: 'Builds an ordered, dependency-aware task DAG' },
  { num: '04', title: 'Coordinate & Execute', desc: 'Runs real tools, AI synthesis, or labeled sandboxes' },
  { num: '05', title: 'Verify & Recover', desc: 'Checks outputs deterministically & retries safely' },
  { num: '06', title: 'Deliver Real Evidence', desc: 'Packages files, approvals, and honest results' },
];

export const GoalInputDashboard: React.FC<GoalInputDashboardProps> = ({
  onStartMission,
  isPlanning,
  missions = [],
  activeMissionId,
  onSelectMission,
  isGuest = true,
  guestTrial,
  accountEmail,
  onOpenAuthModal,
  defaultPersona,
  defaultDepth,
  advancedMode = false,
  onToggleAdvancedMode,
  soundEnabled = true,
  onToggleSound,
  animationsEnabled = true,
  onToggleAnimations,
}) => {
  const [goal, setGoal] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(defaultPersona || 'Apex Growth');
  const [executionDepth, setExecutionDepth] = useState(defaultDepth || 'Standard DAG');
  const [targetDeadline, setTargetDeadline] = useState('Immediate / Real-time');
  const [customDeadlineSec, setCustomDeadlineSec] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedDemoMode, setSelectedDemoMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (defaultPersona) setSelectedPersona(defaultPersona);
  }, [defaultPersona]);

  useEffect(() => {
    if (defaultDepth) setExecutionDepth(defaultDepth);
  }, [defaultDepth]);

  const completedWithTime = missions.filter(
    (m) => m.status === 'completed' && ((m.performanceMetrics?.totalDurationMs || m.elapsedMs || 0) > 0)
  );
  const avgHistoryMs =
    completedWithTime.length > 0
      ? Math.round(
          completedWithTime.reduce(
            (sum, m) => sum + (m.performanceMetrics?.totalDurationMs || m.elapsedMs || 0),
            0
          ) / completedWithTime.length
        )
      : 0;
  const fastestHistoryMs =
    completedWithTime.length > 0
      ? Math.min(
          ...completedWithTime.map((m) => m.performanceMetrics?.totalDurationMs || m.elapsedMs || Infinity)
        )
      : 0;

  const effectiveDeadline =
    customDeadlineSec.trim() && Number(customDeadlineSec) > 0
      ? `${customDeadlineSec.trim()}s`
      : targetDeadline;

  const inferAutoPersona = (text: string): string => {
    if (advancedMode) return selectedPersona;
    const lower = text.toLowerCase();
    if (/website|site|landing|page|app|portfolio|product|code|html/.test(lower)) {
      return 'Vanguard Architect';
    }
    if (/calc|math|budget|profit|margin|formula|automate|schedule|workflow/.test(lower)) {
      return 'Chronos Ops';
    }
    if (/security|audit|policy|risk|privacy|compliance/.test(lower)) {
      return 'Cyber Sentinel';
    }
    return defaultPersona || 'Apex Growth';
  };

  const handleLaunch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed) {
      setErrorMsg('Please tell PHOENIX what you would like to achieve, or pick one of the ideas below.');
      return;
    }
    setErrorMsg('');
    onStartMission({
      goal: trimmed,
      persona: inferAutoPersona(trimmed),
      executionDepth,
      targetDeadline: effectiveDeadline,
      demoMode: selectedDemoMode,
    });
  };

  const handleLaunchIllustrativeDemo = () => {
    if (isPlanning) return;
    setErrorMsg('');
    onStartMission({
      goal: ILLUSTRATIVE_DEMO_PRESET.goal,
      persona: ILLUSTRATIVE_DEMO_PRESET.persona,
      executionDepth: ILLUSTRATIVE_DEMO_PRESET.depth,
      targetDeadline: 'Immediate / Real-time',
      demoMode: true,
    });
  };

  const handleApplySuggestion = (text: string, persona?: string, depth?: string) => {
    setGoal(text);
    setSelectedDemoMode(false);
    if (persona) setSelectedPersona(persona);
    if (depth) setExecutionDepth(depth);
    setErrorMsg('');
  };

  const handleApplyPreset = (preset: PresetMission) => {
    setGoal(preset.goal);
    setSelectedDemoMode(Boolean(preset.demoMode));
    setSelectedPersona(preset.persona);
    setExecutionDepth(preset.depth);
    setErrorMsg('');
  };

  const getMissionStatusText = (m: Mission) => {
    switch (m.status) {
      case 'completed': {
        const hasIssues =
          m.report &&
          (m.report.metrics.failedSteps > 0 ||
            m.report.metrics.skippedSteps > 0 ||
            (m.report.metrics.simulatedToolsRun ?? 0) > 0);
        return hasIssues
          ? { label: advancedMode ? 'Delivered (Partial)' : 'Draft ready', cls: 'text-amber-300' }
          : { label: advancedMode ? 'Delivered' : 'Ready to view', cls: 'text-amber-300' };
      }
      case 'awaiting_clarification':
        return {
          label: advancedMode ? 'Clarification Needed' : 'Waiting for your answer',
          cls: 'text-cyan-300',
        };
      case 'awaiting_approval':
        return {
          label: advancedMode ? 'Approval Required' : 'Needs your approval',
          cls: 'text-amber-300',
        };
      case 'failed':
        return {
          label: advancedMode ? 'Needs Recovery' : 'Needs attention',
          cls: 'text-rose-400',
        };
      case 'executing':
        return {
          label: `${advancedMode ? 'Executing' : 'Working'} (${Math.round(m.progress)}%)`,
          cls: 'text-cyan-300',
        };
      case 'planning':
        return {
          label: advancedMode ? 'Planning' : 'Planning your steps',
          cls: 'text-purple-300',
        };
      case 'paused':
        return { label: 'Paused', cls: 'text-amber-300' };
      default:
        return { label: m.status, cls: 'text-slate-400' };
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-3 sm:py-6 px-1 sm:px-4">
      {/* Welcoming Golden Phoenix Hero */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3">
          <PhoenixEmblem
            size="hero"
            mood="idle"
            animationsEnabled={animationsEnabled}
          />
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300/90">
            {BRAND_CONFIG.name} · {BRAND_CONFIG.descriptor}
          </div>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-display text-balance">
          Hello! What would you like to achieve?
        </h1>
        <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
          Tell me your idea, problem or goal. We&apos;ll work it out together, one step at a time.
        </p>
      </div>

      {/* Primary Conversation-First Input Card */}
      <div className="glass-panel p-5 sm:p-7 rounded-2xl relative overflow-hidden shadow-2xl border-amber-400/25">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <form onSubmit={handleLaunch} className="relative space-y-4">
          <div className="space-y-2">
            <label htmlFor="phoenix-main-goal-input" className="sr-only">
              Describe your idea, problem or goal
            </label>
            <textarea
              id="phoenix-main-goal-input"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                if (selectedDemoMode) setSelectedDemoMode(false);
                if (errorMsg) setErrorMsg('');
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleLaunch();
                }
              }}
              rows={4}
              placeholder="Write in plain words — for example: 'Help me start a small coffee delivery business', 'Build a clean website for my photography studio', or 'Calculate a realistic budget for 120 customers'..."
              className="w-full bg-[#07080E]/95 border border-slate-700/80 rounded-xl px-4 py-3.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans text-sm sm:text-base resize-y min-h-[112px] shadow-inner"
            />

            {errorMsg && (
              <div className="flex items-center gap-2 text-rose-300 text-xs font-sans bg-rose-950/40 p-3 rounded-lg border border-rose-800/50">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPreferences(!showPreferences)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/90 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
                <span>Your preferences</span>
                {showPreferences ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>You stay in control before anything external happens</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                disabled={isPlanning}
                onClick={handleLaunchIllustrativeDemo}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/45 text-amber-200 font-display font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                title="Runs a pre-built Artisan Coffee Studio launch kit end-to-end in under 60 seconds"
              >
                <Play className="w-3.5 h-3.5 text-amber-300 fill-current shrink-0" />
                <span>Run Illustrative Demo (&lt; 60s)</span>
              </button>

              <button
                type="submit"
                disabled={isPlanning}
                className="min-h-[48px] px-6 py-3 rounded-xl font-display font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer whitespace-nowrap shrink-0"
              >
                {isPlanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Getting started...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>{advancedMode ? 'Submit Mission' : "Let's Get Started"}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Preferences — Simple in Normal Mode, Detailed in Advanced Mode */}
          {showPreferences && (
            <div className="pt-5 mt-2 border-t border-slate-800/80 space-y-5">
              {!advancedMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-200">
                      How thorough should we be?
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {FRIENDLY_PACES.map((pace) => {
                        const selected = executionDepth === pace.id;
                        return (
                          <button
                            key={pace.id}
                            type="button"
                            onClick={() => setExecutionDepth(pace.id)}
                            className={`min-h-[44px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? 'bg-amber-500/15 border-amber-400/60 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-xs font-semibold text-white">{pace.label}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{pace.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {onToggleAnimations && (
                        <button
                          type="button"
                          onClick={onToggleAnimations}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 cursor-pointer ${
                            animationsEnabled
                              ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Celebration effects: {animationsEnabled ? 'On' : 'Off'}</span>
                        </button>
                      )}
                      {onToggleSound && (
                        <button
                          type="button"
                          onClick={onToggleSound}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 cursor-pointer ${
                            soundEnabled
                              ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                          <span>Sound cues: {soundEnabled ? 'On' : 'Off'}</span>
                        </button>
                      )}
                    </div>

                    {onToggleAdvancedMode && (
                      <button
                        type="button"
                        onClick={onToggleAdvancedMode}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-purple-200 font-medium cursor-pointer"
                      >
                        Switch to Advanced Mode
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
                      <Compass className="w-4 h-4 text-purple-400" />
                      Execution Focus Persona
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {PERSONAS.map((persona) => {
                        const Icon = persona.icon;
                        const isSelected = selectedPersona === persona.id;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            onClick={() => setSelectedPersona(persona.id)}
                            className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer ${
                              isSelected
                                ? `bg-slate-900/90 ${persona.border} ring-1 ring-cyan-400/50`
                                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${persona.color} text-white`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-display font-bold text-sm text-white">{persona.name}</div>
                                <div className="text-[11px] font-mono text-cyan-400/90">{persona.role}</div>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                              {persona.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        Task Granularity
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {DEPTHS.map((depth) => {
                          const isSelected = executionDepth === depth.id;
                          return (
                            <button
                              key={depth.id}
                              type="button"
                              onClick={() => setExecutionDepth(depth.id)}
                              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-900/30 border-purple-400 text-purple-200'
                                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-xs font-semibold font-display text-white">{depth.title}</div>
                              <div className="text-[10px] font-mono text-cyan-400">{depth.steps} · {depth.time}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
                        <Clock className="w-4 h-4 text-purple-400" />
                        Target Deadline &amp; Guardrail Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          'Immediate / Real-time',
                          'Under 10s Sprint',
                          'Under 25s Standard',
                          'Approval-Gated Audit',
                        ].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setTargetDeadline(d);
                              setCustomDeadlineSec('');
                            }}
                            className={`p-2 rounded-lg border text-center transition-all text-[11px] font-mono cursor-pointer ${
                              !customDeadlineSec && targetDeadline === d
                                ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200'
                                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={customDeadlineSec}
                          onChange={(e) => setCustomDeadlineSec(e.target.value)}
                          placeholder="Custom deadline (sec), e.g. 8"
                          className="w-full bg-[#07080E] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                        {customDeadlineSec && (
                          <button
                            type="button"
                            onClick={() => setCustomDeadlineSec('')}
                            className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {completedWithTime.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-900/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-cyan-300 flex items-center gap-1.5 font-semibold">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        Workspace Speed Benchmark ({completedWithTime.length} Completed)
                      </span>
                      <span className="text-slate-300 tabular-nums">
                        Avg: <strong className="text-white">{(avgHistoryMs / 1000).toFixed(2)}s</strong> · Fastest:{' '}
                        <strong className="text-emerald-300">{(fastestHistoryMs / 1000).toFixed(2)}s</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Friendly Suggestions Grid (Always clean & welcoming) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Not sure where to start? Try one of these
          </h2>
          <span className="text-xs text-slate-500">
            Click any card to prefill, then adjust in your own words
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FRIENDLY_SUGGESTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleApplySuggestion(item.goal, item.persona, item.depth)}
              className="glass-panel-interactive p-4 rounded-xl text-left cursor-pointer group flex flex-col justify-between gap-2 min-h-[104px]"
            >
              <div className="space-y-1">
                <div className="font-display font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                  {item.title}
                </div>
                <p className="text-xs text-slate-400 leading-snug font-sans">
                  {item.subtitle}
                </p>
              </div>
              <span className="text-[11px] font-medium text-amber-300/90 flex items-center gap-1 pt-1">
                <span>Try this</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Projects / Conversations (Accessible without dominating homepage) */}
      {missions.length > 0 && onSelectMission && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-300" />
              <span>
                {advancedMode ? `Active & Archived Missions (${missions.length})` : `Recent Projects (${missions.length})`}
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              Pick up where you left off
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {missions.slice(0, advancedMode ? 6 : 4).map((m) => {
              const st = getMissionStatusText(m);
              const isActive = m.id === activeMissionId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMission(m)}
                  className={`glass-panel-interactive p-4 rounded-xl text-left cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isActive ? 'border-amber-400/50 bg-slate-900/80' : ''
                  }`}
                >
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">
                        {m.artifacts.length > 0
                          ? `${m.artifacts.length} file${m.artifacts.length === 1 ? '' : 's'} ready`
                          : `${m.tasks.length} step${m.tasks.length === 1 ? '' : 's'}`}
                      </span>
                      <span className={`font-medium shrink-0 flex items-center gap-1 ${st.cls}`}>
                        {m.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : m.status === 'awaiting_approval' ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : m.status === 'failed' ? (
                          <AlertCircle className="w-3.5 h-3.5" />
                        ) : null}
                        {st.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-display font-bold text-white line-clamp-1">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-sans line-clamp-2">
                      {m.goal}
                    </p>
                  </div>

                  <div className="flex items-center justify-between w-full pt-2 border-t border-slate-800/70 text-xs">
                    <span className="text-slate-500">
                      {new Date(m.startedAt).toLocaleDateString()}
                    </span>
                    <span className="text-amber-300 flex items-center gap-1 font-medium">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtle Guest Trial & Account Save Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
        {isGuest ? (
          <>
            <div className="text-slate-300 leading-relaxed">
              <span className="font-semibold text-amber-300">
                Start right away —{' '}
                {guestTrial
                  ? `${guestTrial.missionsRemaining} of ${guestTrial.missionsLimit} free projects remaining`
                  : '5 free projects included'}
                .
              </span>{' '}
              <span className="text-slate-400">
                Your work stays private to this session. Create a free account anytime to save it across devices.
              </span>
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={() =>
                  onOpenAuthModal('Create a free account to keep your projects saved across devices.')
                }
                className="min-h-[40px] shrink-0 px-3.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 font-medium text-xs cursor-pointer"
              >
                Save Work (Free Account)
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Signed in{accountEmail ? ` as ${accountEmail}` : ''} — your projects are saved privately to your account.
              </span>
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={() => onOpenAuthModal()}
                className="min-h-[40px] shrink-0 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs cursor-pointer"
              >
                Account &amp; Preferences
              </button>
            )}
          </>
        )}
      </div>

      {/* Advanced Mode Extras: Six-Stage Architecture + Technical Examples */}
      {advancedMode && (
        <div className="space-y-8 pt-2 border-t border-slate-800/70">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                PHOENIX Intelligence Engine · Six-Stage Mission Lifecycle
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Understand · Strategise · Execute · Coordinate · Verify · Deliver
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {INTELLIGENCE_STAGES.map((stg) => (
                <div
                  key={stg.num}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1"
                >
                  <div className="text-[11px] font-mono text-cyan-400 font-bold tabular-nums">
                    {stg.num}
                  </div>
                  <div className="text-xs font-display font-bold text-slate-100">
                    {stg.title}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-snug">
                    {stg.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Technical Benchmark Scenarios</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRESET_MISSIONS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="glass-panel-interactive p-4 rounded-xl cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="text-purple-300 font-semibold">{preset.category}</span>
                      <span>{preset.badge}</span>
                    </div>
                    <h4 className="text-sm font-display font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {preset.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      {preset.goal}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-[11px] font-mono">
                    <span className="text-slate-400">Focus: {preset.persona}</span>
                    <span className="text-cyan-400 flex items-center gap-1">
                      Load <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
