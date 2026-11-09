import React from 'react';
import { X, HelpCircle, Target, GitBranch, Play, ShieldCheck, Award } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl border-purple-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-950 border border-purple-800 text-purple-300">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider">
                Operator Field Manual // PHOENIX Guide
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Beginner Guide to Autonomous Goal-Driven Execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 font-sans text-xs text-slate-300">
          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-cyan-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              1. Goal Input & Persona Selection
            </h4>
            <p className="leading-relaxed text-slate-400">
              State any technical or business objective in natural language (or click any of our 4 pre-configured missions). Choose an agent persona (e.g. Vanguard Architect for systems, Cyber Sentinel for security).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-purple-300 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              2. AI Task Planner (DAG Deconstruction)
            </h4>
            <p className="leading-relaxed text-slate-400">
              PHOENIX uses Gemini 3.8 Flash to transform your goal into an execution graph with phases (Discovery, Architecture, Execution, Validation, Delivery). Each task has designated tools and expected deliverables.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-indigo-300 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-400" />
              3. Interactive Execution Controls
            </h4>
            <p className="leading-relaxed text-slate-400">
              You are in full control at every moment:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 font-mono text-[11px]">
              <li><strong className="text-amber-300">PAUSE:</strong> Halts the active execution step immediately.</li>
              <li><strong className="text-cyan-300">RESUME:</strong> Continues from the exact frozen state.</li>
              <li><strong className="text-purple-300">STEP NEXT:</strong> Step manually through one task at a time.</li>
              <li><strong className="text-rose-300">CANCEL:</strong> Safely aborts the mission and generates an incident report.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              4. Safe Demo Workflow & Simulated Actions
            </h4>
            <p className="leading-relaxed text-slate-400">
              Real AI reasoning is powered live by Gemini. External tool invocations (such as writing external databases or public web queries) operate in safe isolated demo mode and are clearly labeled <span className="font-mono text-cyan-300">[SIMULATED]</span> to protect your environment.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-yellow-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              5. Verification Reports & Deliverables
            </h4>
            <p className="leading-relaxed text-slate-400">
              Upon task completion, the AI verification engine calculates a Goal Satisfaction Score (0-100%), performs a risk assessment, and bundles verified deliverables (schemas, configs, code) for immediate inspection and export.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold transition-colors"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
