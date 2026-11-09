import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Layers, 
  Clock, 
  Target, 
  Compass, 
  Lock, 
  BarChart3, 
  Flame, 
  ArrowRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { PRESET_MISSIONS } from '../data/presetMissions';
import { PresetMission } from '../types/agent';

interface GoalInputDashboardProps {
  onStartMission: (params: {
    goal: string;
    persona: string;
    executionDepth: string;
    targetDeadline: string;
  }) => void;
  isPlanning: boolean;
}

const PERSONAS = [
  {
    id: 'Vanguard Architect',
    name: 'Vanguard',
    role: 'Chief Systems Architect',
    desc: 'Specialized in multi-tier system modeling, microservices contracts, and clean design patterns.',
    icon: Layers,
    color: 'from-purple-500 to-indigo-600',
    border: 'border-purple-500/40',
    tag: 'Architectural DAG'
  },
  {
    id: 'Cyber Sentinel',
    name: 'Sentinel',
    role: 'Threat & Zero-Trust Auditor',
    desc: 'Focuses on security surface reconnaissance, privilege boundaries, and policy compliance.',
    icon: ShieldCheck,
    color: 'from-cyan-500 to-blue-600',
    border: 'border-cyan-500/40',
    tag: 'Defensive Security'
  },
  {
    id: 'Chronos Ops',
    name: 'Chronos',
    role: 'Execution & Reliability Engineer',
    desc: 'Optimizes latency, failover telemetry, containerized workflows, and chaos mitigation.',
    icon: Cpu,
    color: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-500/40',
    tag: 'High Reliability'
  },
  {
    id: 'Apex Growth',
    name: 'Apex',
    role: 'Product Strategy & Intelligence',
    desc: 'Deconstructs user loops, competitive positioning, telemetry metrics, and market launch plans.',
    icon: BarChart3,
    color: 'from-pink-500 to-rose-600',
    border: 'border-pink-500/40',
    tag: 'Growth & Strategy'
  }
];

const DEPTHS = [
  {
    id: 'Rapid Sprint',
    title: 'Rapid Sprint',
    steps: '3-4 Tasks',
    desc: 'Fast prototyping with focused essential verifications.',
    time: '~12-16s'
  },
  {
    id: 'Standard DAG',
    title: 'Standard DAG',
    steps: '4-5 Tasks',
    desc: 'Balanced architectural planning and sandbox telemetry.',
    time: '~18-24s'
  },
  {
    id: 'Deep Rigor',
    title: 'Deep Rigor',
    steps: '5-6 Tasks',
    desc: 'Exhaustive verification, edge cases & artifact synthesis.',
    time: '~24-32s'
  }
];

export const GoalInputDashboard: React.FC<GoalInputDashboardProps> = ({
  onStartMission,
  isPlanning,
}) => {
  const [goal, setGoal] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('Vanguard Architect');
  const [executionDepth, setExecutionDepth] = useState('Standard DAG');
  const [targetDeadline, setTargetDeadline] = useState('Immediate / Real-time');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLaunch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!goal.trim()) {
      setErrorMsg('Please enter a goal or select one of the preset missions below.');
      return;
    }
    setErrorMsg('');
    onStartMission({
      goal: goal.trim(),
      persona: selectedPersona,
      executionDepth,
      targetDeadline,
    });
  };

  const handleApplyPreset = (preset: PresetMission) => {
    setGoal(preset.goal);
    setSelectedPersona(preset.persona);
    setExecutionDepth(preset.depth);
    setErrorMsg('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 px-4">
      {/* Hero Header */}
      <div className="relative text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>PHOENIX NEURAL REASONING ENGINE // v3.8</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white font-display">
          Where would you like to{' '}
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            direct the agent?
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto font-light">
          Input your high-level objective. PHOENIX decomposes the goal into a dependency-aware
          task plan, executes steps with safe demo telemetry, and delivers verifiable proof reports.
        </p>
      </div>

      {/* Main Goal Input Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden shadow-2xl border-purple-500/20">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <form onSubmit={handleLaunch} className="relative space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-purple-300 flex items-center gap-1.5 font-semibold">
                <Target className="w-4 h-4 text-cyan-400" />
                Target Objective & Mission Scope
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                Natural Language Goal
              </span>
            </div>

            <div className="relative">
              <textarea
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                rows={3}
                placeholder="e.g. Build an automated zero-trust security audit for our Kubernetes ingress and generate remediation YAML policies..."
                className="w-full bg-[#07080E]/90 border border-slate-700/80 rounded-xl px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-sans text-sm resize-none shadow-inner"
              />
              <div className="absolute bottom-3 right-3 text-xs font-mono text-slate-500">
                {goal.length} chars
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-mono bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Persona Selection */}
          <div className="space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
              <Compass className="w-4 h-4 text-purple-400" />
              Specialized Agent Persona
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
                    className={`p-3.5 rounded-xl text-left border transition-all relative overflow-hidden ${
                      isSelected
                        ? `bg-slate-900/90 ${persona.border} shadow-lg shadow-purple-500/10 ring-1 ring-cyan-400/50`
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${persona.color} text-white shadow-sm`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {persona.tag}
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-white">
                      {persona.name}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400/90 mb-1">
                      {persona.role}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                      {persona.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Execution Depth & Deadline Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Execution Rigor & Task Granularity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DEPTHS.map((depth) => {
                  const isSelected = executionDepth === depth.id;
                  return (
                    <button
                      key={depth.id}
                      type="button"
                      onClick={() => setExecutionDepth(depth.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-purple-900/30 border-purple-400 text-purple-200'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold font-display text-white">{depth.title}</div>
                      <div className="text-[10px] font-mono text-cyan-400">{depth.steps}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{depth.time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-semibold">
                <Clock className="w-4 h-4 text-purple-400" />
                Target Milestone Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Immediate / Real-time', 'Production Audit Cycle'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTargetDeadline(d)}
                    className={`p-2.5 rounded-lg border text-center transition-all text-xs font-mono ${
                      targetDeadline === d
                        ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ignition Action Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safe sandbox workflow enabled. Zero external destruction risk.</span>
            </div>

            <button
              type="submit"
              disabled={isPlanning}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-display font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 shadow-xl shadow-purple-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isPlanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>GENERATING DAG PLAN...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                  <span>IGNITE AUTONOMOUS MISSION</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Preset Missions for 1-Click Launch */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Recommended Preset Missions (1-Click Demonstration)
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Pre-configured & verified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESET_MISSIONS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className="glass-panel-interactive p-4 rounded-xl cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                    {preset.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {preset.estimatedSec}s est
                  </span>
                </div>
                <h4 className="text-sm font-display font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {preset.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {preset.goal}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-[11px] font-mono">
                <span className="text-purple-300">Agent: {preset.persona}</span>
                <span className="text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Load & Ignite &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
