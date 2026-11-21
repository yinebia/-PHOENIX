import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy: () => void;
  missionCount: number;
}

type AuthTab = 'signin' | 'register' | 'reset';

export const AuthAccountModal: React.FC<AuthAccountModalProps> = ({
  isOpen,
  onClose,
  onOpenPrivacy,
  missionCount,
}) => {
  const {
    user,
    authError,
    authPromptReason,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshUserStatus,
    userPreferences,
    savePreferences,
    logout,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [prefPersona, setPrefPersona] = useState(userPreferences?.defaultPersona || 'Apex Growth');
  const [prefDepth, setPrefDepth] = useState(userPreferences?.defaultDepth || 'Standard DAG');

  useEffect(() => {
    if (userPreferences?.defaultPersona) setPrefPersona(userPreferences.defaultPersona);
    if (userPreferences?.defaultDepth) setPrefDepth(userPreferences.defaultDepth);
  }, [userPreferences?.defaultPersona, userPreferences?.defaultDepth]);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setBusy(true);
    setStatusNotice(null);
    try {
      await signInWithGoogle();
    } catch {
      // Error surfaced via authError
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusNotice(null);
    clearAuthError();
    try {
      if (tab === 'signin') {
        await signInWithEmail({ email, password });
      } else if (tab === 'register') {
        await registerWithEmail({ email, password, displayName });
        setStatusNotice('Account created. A verification email has been sent to activate Cloud Firestore sync.');
      } else {
        await sendPasswordReset(email);
        setStatusNotice('Password reset instructions sent if an account exists for that address.');
      }
    } catch {
      // Error surfaced via authError
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setBusy(true);
    setStatusNotice(null);
    try {
      await resendVerificationEmail();
      setStatusNotice('Verification email sent. Check your inbox and spam folder, then click "I Verified My Email".');
    } catch {
      // Error surfaced via authError
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerified = async () => {
    setBusy(true);
    setStatusNotice(null);
    try {
      const verified = await refreshUserStatus();
      setStatusNotice(
        verified
          ? 'Email verified! Your private Cloud Firestore workspace sync is now active.'
          : 'Email is not yet verified. Please click the verification link sent to your inbox first.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrefs = async () => {
    setBusy(true);
    setStatusNotice(null);
    try {
      await savePreferences({
        defaultPersona: prefPersona,
        defaultDepth: prefDepth,
      });
      setStatusNotice('Workspace preferences saved to your private profile.');
    } catch (err: any) {
      setStatusNotice(err?.message || 'Unable to update preferences right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0A0C16] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">
                {user ? 'Private Workspace Account' : 'Save Your Work — Free Account'}
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                {user ? 'Isolated multi-device workspace' : 'Zero paid plans · Private workspace sync'}
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

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {authPromptReason && !user && (
            <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-cyan-200 leading-relaxed">
              {authPromptReason}
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {statusNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusNotice}</span>
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-display font-bold text-white truncate">
                    {user.displayName || user.email?.split('@')[0] || 'Operator'}
                  </span>
                  {user.emailVerified ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                      EMAIL VERIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                      VERIFY EMAIL
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-slate-400 truncate">{user.email}</p>
                <p className="text-xs font-mono text-cyan-300">
                  {missionCount} private mission(s) in your workspace
                </p>
              </div>

              {!user.emailVerified && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2.5 text-xs text-amber-200">
                  <p>
                    Your account works with server-isolated storage now. Verify your email address to activate strict Cloud Firestore multi-device sync.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResendVerification}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-mono text-[11px] cursor-pointer"
                    >
                      Resend Verification Email
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRefreshVerified}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>I Verified My Email</span>
                    </button>
                  </div>
                </div>
              )}

              {user && (
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-amber-300 font-semibold">
                    Your Experience Preferences
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 cursor-pointer">
                      <span className="text-slate-200">Show Advanced Technical Mode</span>
                      <input
                        type="checkbox"
                        checked={Boolean(userPreferences?.advancedMode)}
                        onChange={(e) => {
                          void savePreferences({ advancedMode: e.target.checked });
                        }}
                        className="accent-amber-400 w-4 h-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 cursor-pointer">
                      <span className="text-slate-200">Celebration Effects &amp; Glow</span>
                      <input
                        type="checkbox"
                        checked={userPreferences?.animationsEnabled !== false}
                        onChange={(e) => {
                          void savePreferences({ animationsEnabled: e.target.checked });
                        }}
                        className="accent-amber-400 w-4 h-4"
                      />
                    </label>
                    <label className="block text-[11px] font-mono text-slate-400 pt-1">
                      Default Focus Style
                      <select
                        value={prefPersona}
                        onChange={(e) => setPrefPersona(e.target.value)}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                      >
                        <option value="Vanguard Architect">Vanguard (Websites &amp; Products)</option>
                        <option value="Apex Growth">Apex (Business &amp; Research)</option>
                        <option value="Chronos Ops">Chronos (Math &amp; Workflows)</option>
                        <option value="Cyber Sentinel">Sentinel (Safety &amp; Audits)</option>
                      </select>
                    </label>
                    <label className="block text-[11px] font-mono text-slate-400">
                      Default Thoroughness
                      <select
                        value={prefDepth}
                        onChange={(e) => setPrefDepth(e.target.value)}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                      >
                        <option value="Rapid Sprint">Quick &amp; concise</option>
                        <option value="Standard DAG">Balanced (Recommended)</option>
                        <option value="Deep Rigor">Thorough &amp; detailed</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSavePrefs}
                    className="min-h-[42px] w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold cursor-pointer"
                  >
                    Save Preferences
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPrivacy();
                  }}
                  className="text-xs font-mono text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  Privacy &amp; Retention Policy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Continue with Google (Free)</span>
              </button>

              <div className="relative flex items-center justify-center">
                <span className="h-px w-full bg-slate-800" />
                <span className="px-3 bg-[#0A0C16] text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
                  Or Email &amp; Password
                </span>
                <span className="h-px w-full bg-slate-800" />
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg cursor-pointer ${
                    tab === 'signin'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg cursor-pointer ${
                    tab === 'register'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Free
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('reset');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg cursor-pointer ${
                    tab === 'reset'
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Recovery
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {tab === 'register' && (
                  <label className="block space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Display Name</span>
                    </span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      placeholder="Your name or team"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </label>
                )}

                <label className="block space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Email Address</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </label>

                {tab !== 'reset' && (
                  <label className="block space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Password</span>
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-sm font-display font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {tab === 'signin'
                      ? 'Sign In to Workspace'
                      : tab === 'register'
                      ? 'Create Free Account'
                      : 'Send Password Reset Email'}
                  </span>
                </button>
              </form>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Your missions stay strictly private.</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPrivacy();
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
