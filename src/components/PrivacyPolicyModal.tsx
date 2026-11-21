import React from 'react';
import { X, ShieldCheck, Lock, Clock, Trash2, Server } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0A0C16] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">
                PHOENIX Privacy, Workspace Isolation &amp; Data Retention Policy
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Customer goals, generated deliverables, and execution logs remain strictly private
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-300 leading-relaxed max-h-[75vh] overflow-y-auto">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-cyan-300 font-semibold">
              <Clock className="w-4 h-4" />
              <span>1. Guest Access &amp; 24-Hour Temporary Isolation</span>
            </div>
            <p>
              Guests are assigned a cryptographically signed, HTTP-only session identifier so their missions, deliverables, and feedback are isolated from all other visitors. Guest trials include up to <strong>5 missions / 40 execution steps</strong> and automatically expire after <strong>24 hours</strong> or if you clear browser data/switch devices.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-purple-300 font-semibold">
              <Lock className="w-4 h-4" />
              <span>2. Registered Account Private Workspaces</span>
            </div>
            <p>
              When you sign in with Google or a verified email account, your missions and deliverables are scoped strictly to your authenticated user ID (<code>/users/&#123;uid&#125;/missions</code> and isolated server workspace). Backend ownership verification and deployed Firestore security rules reject cross-user reads, writes, or ID tampering.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-emerald-300 font-semibold">
              <Server className="w-4 h-4" />
              <span>3. Separation of Administrative Diagnostics</span>
            </div>
            <p>
              Customer conversations, prompts, and generated business prototypes are <strong>never public</strong> and are never exposed inside operator or admin views. Admin endpoints return aggregate counts only (such as active session count or mission totals) behind verified administrator authentication.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-rose-300 font-semibold">
              <Trash2 className="w-4 h-4" />
              <span>4. Control &amp; Deletion</span>
            </div>
            <p>
              You may transfer eligible guest missions into your new account with explicit confirmation, keep them separate, or delete any individual mission or your archive at any time from Mission Archives.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
