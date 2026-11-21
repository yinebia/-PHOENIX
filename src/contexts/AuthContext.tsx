import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import type {
  GuestTrialInfo,
  Mission,
  PendingGuestMissionSummary,
  UserPreferences,
} from '../types/agent';
import {
  discardGuestBackend,
  ensureUserProfile,
  fetchSessionState,
  finalizeGuestMigrationBackend,
  migrateGuestBackend,
  resetGuestSession,
  rollbackGuestMigrationBackend,
  saveBackendPreferences,
  saveMissionToFirestore,
  updateUserPreferences,
} from '../services/workspaceService';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  authReady: boolean;
  isAdmin: boolean;
  guestTrial: GuestTrialInfo | null;
  pendingGuestMissions: PendingGuestMissionSummary[];
  pendingGuestChatCount: number;
  userPreferences: UserPreferences | null;
  authError: string | null;
  authModalOpen: boolean;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  authPromptReason: string | null;
  clearAuthError: () => void;
  refreshSession: () => Promise<void>;
  updateTrialInfo: (trial: GuestTrialInfo | null) => void;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  signInWithEmail: (params: { email: string; password: string }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUserStatus: () => Promise<boolean>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  logout: () => Promise<void>;
  confirmGuestMigration: (selectedMissionIds?: string[], includeChat?: boolean) => Promise<Mission[]>;
  declineGuestMigration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Authentication Console for project credible-cable-s01dl. Use "Continue with Google" right now, or enable Email/Password under Firebase Console -> Authentication -> Sign-in method.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Switch to Sign In or reset your password.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Please verify your credentials or use Forgot Password.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in window was closed before completing authentication.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site and retry.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts detected. Please wait a short while before trying again.';
  }
  return err?.message || 'Authentication request failed.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [guestTrial, setGuestTrial] = useState<GuestTrialInfo | null>(null);
  const [pendingGuestMissions, setPendingGuestMissions] = useState<PendingGuestMissionSummary[]>([]);
  const [pendingGuestChatCount, setPendingGuestChatCount] = useState<number>(0);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);

  const syncServerSession = useCallback(async (currentUser: User | null) => {
    try {
      const token = currentUser ? await currentUser.getIdToken() : null;
      setIdToken(token);
      const session = await fetchSessionState(token);
      setIsAdmin(Boolean(session.isAdmin));
      setGuestTrial(session.guestTrial || null);
      setPendingGuestMissions(session.pendingGuestMissions || []);
      setPendingGuestChatCount(Number(session.pendingGuestChatCount) || 0);

      let resolvedPrefs: UserPreferences | null = session.preferences || null;
      if (currentUser && currentUser.emailVerified) {
        try {
          const fsPrefs = await ensureUserProfile(currentUser);
          resolvedPrefs = { ...(resolvedPrefs || {}), ...(fsPrefs || {}) };
        } catch (fsErr) {
          console.warn('Firestore profile bootstrap warning:', fsErr);
        }
      }
      setUserPreferences(currentUser ? resolvedPrefs : null);
    } catch (err) {
      console.warn('Failed to synchronize PHOENIX workspace session:', err);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      void syncServerSession(firebaseUser);
    });
    return () => unsub();
  }, [syncServerSession]);

  const refreshSession = useCallback(async () => {
    await syncServerSession(auth.currentUser);
  }, [syncServerSession]);

  const openAuthModal = useCallback((reason?: string) => {
    setAuthError(null);
    setAuthPromptReason(reason || null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthPromptReason(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const updateTrialInfo = useCallback((trial: GuestTrialInfo | null) => {
    if (trial) setGuestTrial(trial);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncServerSession(result.user);
      setAuthModalOpen(false);
      setAuthPromptReason(null);
    } catch (err: any) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, [syncServerSession]);

  const registerWithEmail = useCallback(
    async ({
      email,
      password,
      displayName,
    }: {
      email: string;
      password: string;
      displayName: string;
    }) => {
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
        }
        await sendEmailVerification(cred.user).catch(() => {});
        await syncServerSession(cred.user);
        setAuthModalOpen(false);
        setAuthPromptReason(null);
      } catch (err: any) {
        const msg = formatFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    [syncServerSession]
  );

  const signInWithEmail = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setAuthError(null);
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncServerSession(cred.user);
        setAuthModalOpen(false);
        setAuthPromptReason(null);
      } catch (err: any) {
        const msg = formatFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    [syncServerSession]
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      const msg = formatFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const refreshUserStatus = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const reloaded = auth.currentUser;
    const token = await reloaded.getIdToken(true);
    setUser(reloaded);
    setIdToken(token);
    await syncServerSession(reloaded);
    return Boolean(reloaded.emailVerified);
  }, [syncServerSession]);

  const savePreferences = useCallback(async (prefs: UserPreferences) => {
    setUserPreferences((prev) => ({ ...(prev || {}), ...prefs }));
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      await saveBackendPreferences(token, prefs);
      if (currentUser.emailVerified) {
        await updateUserPreferences(currentUser.uid, prefs);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
    // Rotate into a clean, empty isolated guest session so signed-out user data is never visible
    const rotated = await resetGuestSession();
    setIdToken(null);
    setIsAdmin(false);
    setUserPreferences(null);
    setPendingGuestMissions([]);
    setPendingGuestChatCount(0);
    setGuestTrial(rotated.guestTrial);
  }, []);

  const confirmGuestMigration = useCallback(
    async (selectedMissionIds?: string[], includeChat = true) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sign in required to transfer guest work.');
      }
      const token = await currentUser.getIdToken();
      const shouldDeferCleanup = Boolean(currentUser.emailVerified);
      const { migratedMissions, migratedChatIds } = await migrateGuestBackend(
        token,
        true,
        selectedMissionIds,
        { includeChat, deferCleanup: shouldDeferCleanup }
      );

      if (shouldDeferCleanup) {
        try {
          for (const m of migratedMissions) {
            await saveMissionToFirestore(currentUser, m);
          }
          await finalizeGuestMigrationBackend(
            token,
            migratedMissions.map((m) => m.id),
            includeChat
          );
        } catch (fsErr: any) {
          // Roll back backend user bucket copy so guest session remains 100% preserved on failure
          await rollbackGuestMigrationBackend(
            token,
            migratedMissions.map((m) => m.id),
            migratedChatIds
          ).catch(() => {});
          throw new Error(
            fsErr?.message
              ? `Workspace sync failed (${fsErr.message}). Your guest session and missions have been preserved safely.`
              : 'Workspace sync failed. Your guest session and missions have been preserved safely.'
          );
        }
      }

      setPendingGuestMissions([]);
      setPendingGuestChatCount(0);
      return migratedMissions;
    },
    []
  );

  const declineGuestMigration = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const token = await currentUser.getIdToken();
    await discardGuestBackend(token);
    setPendingGuestMissions([]);
    setPendingGuestChatCount(0);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        authReady,
        isAdmin,
        guestTrial,
        pendingGuestMissions,
        pendingGuestChatCount,
        userPreferences,
        authError,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
        authPromptReason,
        clearAuthError,
        refreshSession,
        updateTrialInfo,
        signInWithGoogle,
        registerWithEmail,
        signInWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshUserStatus,
        savePreferences,
        logout,
        confirmGuestMigration,
        declineGuestMigration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
