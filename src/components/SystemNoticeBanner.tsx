import React from 'react';
import { ShieldCheck, Info, Sparkles, Terminal } from 'lucide-react';

export const SystemNoticeBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-cyan-950/60 border-y border-purple-500/20 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="font-mono text-cyan-300 font-semibold uppercase tracking-wider">
            Safe Demo Workflow
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="text-slate-400">
            Real AI reasoning active via <span className="text-purple-300 font-medium">Gemini 3.8 Flash</span>. External execution tools operate in safe isolated simulation.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero Unsafe Mutations</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Strict Verification Audit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
