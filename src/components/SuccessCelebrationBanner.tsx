import React from 'react';
import {
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { PhoenixEmblem } from './PhoenixEmblem';
import { CelebrationDecision } from '../utils/celebration';

interface SuccessCelebrationBannerProps {
  decision: CelebrationDecision;
  animationsEnabled?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  artifactCount?: number;
}

export const SuccessCelebrationBanner: React.FC<SuccessCelebrationBannerProps> = ({
  decision,
  animationsEnabled = true,
  primaryActionLabel,
  onPrimaryAction,
  artifactCount = 0,
}) => {
  if (decision.kind === 'none') return null;

  if (decision.kind === 'failed') {
    return (
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border-rose-500/45 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base text-white">
              {decision.headline}
            </h3>
            <p className="text-xs sm:text-sm text-rose-100/90 font-sans leading-relaxed">
              {decision.message}
            </p>
          </div>
        </div>
        {onPrimaryAction && primaryActionLabel && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>{primaryActionLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  if (decision.kind === 'partial' || decision.kind === 'simulated_only') {
    return (
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border-amber-500/45 bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/35 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base text-white">
              {decision.headline}
            </h3>
            <p className="text-xs sm:text-sm text-amber-100/90 font-sans leading-relaxed">
              {decision.message}
            </p>
          </div>
        </div>
        {onPrimaryAction && primaryActionLabel && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/45 text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{primaryActionLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Genuine Level 2 / Level 3 Golden Phoenix Celebration
  const isLevel3 = decision.level === 3;

  return (
    <div
      className={`glass-panel relative overflow-hidden p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
        isLevel3
          ? 'border-amber-400/60 bg-gradient-to-r from-amber-950/30 via-[#12101A]/90 to-slate-900/80 shadow-[0_0_32px_-8px_rgba(245,158,11,0.35)]'
          : 'border-amber-400/40 bg-gradient-to-r from-amber-950/20 to-slate-900/80'
      }`}
    >
      {isLevel3 && animationsEnabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full bg-amber-400/10 blur-3xl"
        />
      )}

      <div className="relative flex items-center gap-4">
        {isLevel3 ? (
          <PhoenixEmblem
            size="lg"
            mood="celebrating"
            animationsEnabled={animationsEnabled}
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{isLevel3 ? 'Verified & Ready' : 'Completed'}</span>
          </div>
          <h3 className="font-display font-bold text-lg sm:text-xl text-white">
            {decision.headline}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
            {decision.message}
          </p>
        </div>
      </div>

      {onPrimaryAction && (
        <button
          type="button"
          onClick={onPrimaryAction}
          className="relative min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
        >
          <span>
            {primaryActionLabel ||
              (artifactCount > 0 ? 'View Your Completed Work' : 'View Results')}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
