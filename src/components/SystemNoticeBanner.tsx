import React from 'react';
import { ShieldCheck, Sparkles, Lock } from 'lucide-react';

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
            PHOENIX Hybrid Execution Core
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="text-slate-400">
            Real backend tools &amp; <span className="text-purple-300 font-medium">Gemini 4 Flash</span> synthesis active. External publishing/outreach actions require explicit approval.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Honest Verification</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Human Approval Gates</span>
          </div>
        </div>
      </div>
    </div>
  );
};
