import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, BarChart3, RefreshCw, Lock, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAdminOverview } from '../services/workspaceService';
import type { AdminAggregateOverview } from '../types/agent';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({ isOpen, onClose }) => {
  const { idToken, isAdmin } = useAuth();
  const [overview, setOverview] = useState<AdminAggregateOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOverview = async () => {
    if (!idToken || !isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAdminOverview(idToken);
      setOverview(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load aggregate system overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin && idToken) {
      void loadOverview();
    }
  }, [isOpen, isAdmin, idToken]);

  if (!isOpen || !isAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0A0C16] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">
                System Operator Telemetry (Admin Only)
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Aggregate platform metrics &amp; fallback log · Never shown to customers
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

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs font-mono text-slate-400">
              Loading verified aggregate telemetry...
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">Active Guest Sessions</div>
                  <div className="text-2xl font-display font-black text-cyan-300 mt-1 tabular-nums">
                    {overview.activeGuestSessions}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">Registered Workspaces</div>
                  <div className="text-2xl font-display font-black text-purple-300 mt-1 tabular-nums">
                    {overview.registeredWorkspaces}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">Guest Missions</div>
                  <div className="text-2xl font-display font-black text-slate-100 mt-1 tabular-nums">
                    {overview.totalGuestMissions}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">Account Missions</div>
                  <div className="text-2xl font-display font-black text-emerald-300 mt-1 tabular-nums">
                    {overview.totalUserMissions}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 col-span-2 sm:col-span-2">
                  <div className="text-[11px] font-mono text-amber-300">Fallback Events Logged</div>
                  <div className="text-2xl font-display font-black text-amber-300 mt-1 tabular-nums">
                    {overview.fallbackCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Aggregate Mission Status Counts</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(overview.statusBreakdown).length === 0 ? (
                    <span className="text-xs font-mono text-slate-500">No active records yet.</span>
                  ) : (
                    Object.entries(overview.statusBreakdown).map(([st, count]) => (
                      <span
                        key={st}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300"
                      >
                        {st}: <strong className="text-cyan-300 tabular-nums">{count}</strong>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Admin-Only Fallback Telemetry & Exact Reasons */}
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Fallback Telemetry &amp; Reasons (Admin Only)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                    Showing latest {(overview.fallbackEvents || []).length}
                  </span>
                </div>

                {!overview.fallbackEvents || overview.fallbackEvents.length === 0 ? (
                  <div className="text-xs font-mono text-slate-500 py-2">
                    No fallbacks triggered yet — all external calls succeeded cleanly.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {overview.fallbackEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 rounded-xl bg-[#07080E] border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-200 text-[10px] font-semibold">
                              {evt.category}
                            </span>
                            <span className="text-slate-200 font-semibold">{evt.operation}</span>
                            {evt.tool && (
                              <span className="text-cyan-300 text-[11px]">({evt.tool})</span>
                            )}
                            {evt.demoMode && (
                              <span className="text-[10px] text-amber-300">[DEMO]</span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-sans">
                          <span className="text-slate-500 font-mono">Reason:</span> {evt.reason}
                        </div>
                        <div className="text-[11px] text-emerald-300/90 font-mono">
                          Fallback Used: {evt.fallbackUsed}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{overview.privacyGuarantee}</span>
              </div>
            </>
          ) : null}

          <div className="flex justify-between pt-2 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
