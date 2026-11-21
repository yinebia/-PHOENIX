import React from 'react';
import { X, HelpCircle, Target, GitBranch, Play, ShieldCheck, Award, RefreshCw } from 'lucide-react';

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
                How PHOENIX Works
              </h3>
              <p className="text-[11px] text-slate-400">
                Simple on the surface, six-stage verification underneath
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
              1. Six-Stage Execution Intelligence
            </h4>
            <p className="leading-relaxed text-slate-400">
              PHOENIX turns human intentions into digital outcomes across six structured stages:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 font-mono text-[11px]">
              <li><strong className="text-cyan-300">UNDERSTAND:</strong> Interprets your goal, resource constraints, and missing inputs.</li>
              <li><strong className="text-purple-300">STRATEGISE:</strong> Identifies opportunities/risks and builds a dependency-aware DAG.</li>
              <li><strong className="text-indigo-300">EXECUTE:</strong> Runs real backend tools, AI deliverable synthesis, or labeled demo routines.</li>
              <li><strong className="text-sky-300">COORDINATE:</strong> Passes upstream outputs between dependent tasks and maintains checkpoints.</li>
              <li><strong className="text-amber-300">VERIFY &amp; RECOVER:</strong> Checks outputs deterministically, handles errors, and retries safely.</li>
              <li><strong className="text-emerald-300">DELIVER:</strong> Issues an honest report with completed assets and unresolved issues.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-purple-300 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              2. Strict Tool Classifications
            </h4>
            <p className="leading-relaxed text-slate-400">
              Every step declares whether it executes on a real backend engine, uses Gemini synthesis, or runs in a safe demo container:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 font-mono text-[11px]">
              <li><strong className="text-emerald-300">[REAL TOOL]:</strong> Deterministic backend tools (calculator, artifact_validator, verification_harness).</li>
              <li><strong className="text-purple-300">[AI SYNTHESIS]:</strong> Gemini 4 Flash generating real HTML, Markdown, or JSON deliverables.</li>
              <li><strong className="text-slate-300">[SIMULATED]:</strong> Safe demo containers where live external integrations are not connected.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-amber-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              3. Autonomy with Human Control (Approval Gates)
            </h4>
            <p className="leading-relaxed text-slate-400">
              PHOENIX pauses automatically before steps involving spending money, sending emails, contacting prospective customers, or publishing websites. You decide whether to <strong className="text-emerald-300">Approve &amp; Execute</strong> or <strong className="text-amber-300">Decline &amp; Preserve Draft</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-indigo-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              4. Failure Recovery &amp; Checkpointing
            </h4>
            <p className="leading-relaxed text-slate-400">
              If a tool fails or produces invalid output, PHOENIX records the actual error, runs Stage 5 recovery diagnosis, preserves all completed checkpoint artifacts, and lets you retry or finalize an honest partial report without fabricating success.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-bold text-sm text-emerald-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              5. Controls &amp; Deliverable Vault
            </h4>
            <p className="leading-relaxed text-slate-400">
              Use <span className="font-mono text-amber-300">PAUSE</span>, <span className="font-mono text-cyan-300">RESUME</span>, <span className="font-mono text-purple-300">STEP NEXT</span>, and <span className="font-mono text-rose-300">CANCEL</span> anytime. Inspect or download any generated HTML website, strategy document, or verification certificate directly from the Artifact Vault.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-semibold transition-colors"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
