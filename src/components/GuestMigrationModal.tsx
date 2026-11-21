import React, { useState } from 'react';
import { ArrowRight, CheckSquare, Square, FileCode, AlertTriangle, Sparkles, X, MessageSquare } from 'lucide-react';
import type { PendingGuestMissionSummary } from '../types/agent';

interface GuestMigrationModalProps {
  pendingMissions: PendingGuestMissionSummary[];
  pendingChatCount?: number;
  onConfirm: (selectedIds: string[], includeChat: boolean) => Promise<void>;
  onDecline: () => Promise<void>;
  onKeepLater: () => void;
}

export const GuestMigrationModal: React.FC<GuestMigrationModalProps> = ({
  pendingMissions,
  pendingChatCount = 0,
  onConfirm,
  onDecline,
  onKeepLater,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    pendingMissions.map((m) => m.id)
  );
  const [includeChat, setIncludeChat] = useState<boolean>(pendingChatCount > 0);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (pendingMissions.length === 0 && pendingChatCount === 0) return null;

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0 && !(pendingChatCount > 0 && includeChat)) {
      setErrorMsg('Select at least one mission or chat thread to transfer, or choose "Discard Guest Drafts".');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await onConfirm(selectedIds, includeChat);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Migration could not be completed. Your guest session work was preserved safely.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onDecline();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to clear guest queue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0A0C16] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">
                Transfer Guest Work Into Your Account?
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Explicit confirmation required · Zero duplication guarantee
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onKeepLater}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Decide later (keep guest session untouched)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            You created{' '}
            {pendingMissions.length > 0 && (
              <>
                <strong className="text-cyan-300">{pendingMissions.length}</strong> mission(s)
              </>
            )}
            {pendingMissions.length > 0 && pendingChatCount > 0 && ' and '}
            {pendingChatCount > 0 && (
              <>
                <strong className="text-purple-300">{pendingChatCount}</strong> AI chat message(s)
              </>
            )}{' '}
            as a guest in this browser session. Would you like to import them into your private account workspace?
          </p>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {pendingMissions.length > 0 && (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {pendingMissions.map((m) => {
                const checked = selectedIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleId(m.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                      checked
                        ? 'bg-cyan-950/30 border-cyan-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-xs text-white truncate">
                          {m.title}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300 shrink-0 flex items-center gap-1">
                          <FileCode className="w-3 h-3" />
                          {m.artifactsCount} file(s)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{m.goal}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {pendingChatCount > 0 && (
            <button
              type="button"
              onClick={() => setIncludeChat((prev) => !prev)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                includeChat
                  ? 'bg-purple-950/30 border-purple-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {includeChat ? (
                <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <MessageSquare className="w-4 h-4 text-cyan-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-xs text-white">
                  Include Guest AI Chat Conversation ({pendingChatCount} messages)
                </div>
                <div className="text-[11px] text-slate-400">
                  Preserves full multi-turn Gemini chat context without duplicating messages.
                </div>
              </div>
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={busy}
              onClick={handleDecline}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono cursor-pointer disabled:opacity-50"
            >
              Discard Guest Drafts
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-display font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {busy
                  ? 'Transferring Safely...'
                  : selectedIds.length > 0
                  ? `Transfer ${selectedIds.length} Mission(s) to My Account`
                  : 'Transfer Chat to My Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
