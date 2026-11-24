import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../firebase/config';
import { auditService } from '../services/auditService';
import type { UserProfile, UserRole } from '../types';

export type AuthProviderType = 'firebase' | 'server' | 'demo' | null;

export function formatFirebaseAuthError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please switch to Sign In.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please create a password with at least 8 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. If you are new, switch to Create Account to register.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In popup was closed before completing sign-in.';
    default:
      return error?.message || 'Authentication failed. Please check your email and password.';
  }
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  authProviderType: AuthProviderType;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string, role: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  updateRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const env = (import.meta as any).env || {};

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; pass: string; name: string }> = {
  clinician: { email: 'clinician@dermai.local', pass: env.VITE_DEMO_CLINICIAN_PASSWORD || 'ClinicianDoctor123!', name: 'Dr. Sarah Chen, MD' },
  patient: { email: 'patient@dermai.local', pass: env.VITE_DEMO_PATIENT_PASSWORD || 'PatientSecure123!', name: 'John Doe (Patient)' },
  admin: { email: 'admin@dermai.local', pass: env.VITE_DEMO_ADMIN_PASSWORD || 'AdminSuperUser123!', name: 'System Administrator' },
  researcher: { email: 'researcher@dermai.local', pass: env.VITE_DEMO_RESEARCHER_PASSWORD || 'ResearchScience123!', name: 'Prof. Elena Rostova' },
  ml_engineer: { email: 'ml_engineer@dermai.local', pass: env.VITE_DEMO_ML_PASSWORD || 'MLEngineerModel123!', name: 'Marcus Aurelius (Lead ML)' },
};

export const DEMO_USERS: Record<UserRole, { email: string; name: string; role: UserRole }> = {
  clinician: { email: 'clinician@dermai.local', name: 'Dr. Sarah Chen, MD', role: 'clinician' },
  patient: { email: 'patient@dermai.local', name: 'John Doe (Patient)', role: 'patient' },
  admin: { email: 'admin@dermai.local', name: 'System Administrator', role: 'admin' },
  researcher: { email: 'researcher@dermai.local', name: 'Prof. Elena Rostova', role: 'researcher' },
  ml_engineer: { email: 'ml_engineer@dermai.local', name: 'Marcus Aurelius (Lead ML)', role: 'ml_engineer' },
};

const ACTIVE_PROFILE_KEY = 'dermai_active_profile';
const SERVER_TOKEN_KEY = 'dermai_server_token';
const ADMIN_EMAIL = 'sunithanenavath566@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authProviderType, setAuthProviderType] = useState<AuthProviderType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncUserProfile = async (fbUser: FirebaseUser, defaultRole: UserRole = 'clinician') => {
    const fallbackRole: UserRole =
      fbUser.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : defaultRole;

    try {
      const userRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const profile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || data.email,
          displayName: fbUser.displayName || data.displayName || 'Clinical User',
          role: data.role || fallbackRole,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
        };
        setUser(profile);
        setAuthProviderType('firebase');
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
        localStorage.removeItem(SERVER_TOKEN_KEY);
        return profile;
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Clinical User',
          role: fallbackRole,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUser(newProfile);
        setAuthProviderType('firebase');
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(newProfile));
        localStorage.removeItem(SERVER_TOKEN_KEY);
        return newProfile;
      }
    } catch (err) {
      console.warn('Could not read user profile from Firestore, using authenticated session fallback:', err);
      const sessionProfile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Clinical User',
        role: fallbackRole,
        createdAt: new Date().toISOString(),
      };
      setUser(sessionProfile);
      setAuthProviderType('firebase');
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(sessionProfile));
      localStorage.removeItem(SERVER_TOKEN_KEY);
      return sessionProfile;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserProfile(fbUser);
        setIsLoading(false);
        return;
      }

      // 1. Restore server-authenticated Email/Password session if a valid token exists
      const serverToken = localStorage.getItem(SERVER_TOKEN_KEY);
      if (serverToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${serverToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            const usr = data?.user || (data?.email ? data : null);
            if (usr) {
              const restored: UserProfile = {
                uid: String(usr.uid || usr.user_id || 'srv_user'),
                email: usr.email,
                displayName: usr.displayName || usr.full_name || usr.email.split('@')[0],
                role: usr.role || 'clinician',
                createdAt: usr.createdAt || new Date().toISOString(),
              };
              setUser(restored);
              setAuthProviderType('server');
              localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(restored));
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Fall through to clean state if server token could not be verified
        }
        localStorage.removeItem(SERVER_TOKEN_KEY);
      }

      // 2. Restore explicit Offline Demo Sandbox session if previously chosen
      const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as UserProfile;
          if (parsed.uid?.startsWith('demo_')) {
            setUser(parsed);
            setAuthProviderType('demo');
            setIsLoading(false);
            return;
          }
        } catch {
          // Ignore malformed local profile
        }
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }

      setUser(null);
      setAuthProviderType(null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const serverLogin = async (email: string, pass: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.detail || data.error || 'Incorrect email or password.');
      err.code = data.code || 'auth/invalid-credential';
      throw err;
    }
    const userObj = data.user || {};
    const profile: UserProfile = {
      uid: String(data.user_id || userObj.uid || 'usr_' + Date.now()),
      email: data.email || userObj.email || email,
      displayName: data.full_name || userObj.displayName || (data.email || userObj.email || email).split('@')[0],
      role: (data.role || userObj.role || 'clinician') as UserRole,
      createdAt: userObj.createdAt || new Date().toISOString(),
    };
    const token = data.access_token || data.token;
    if (token) {
      localStorage.setItem(SERVER_TOKEN_KEY, token);
    }
    if (data.refresh_token) {
      localStorage.setItem('dermai_refresh_token', data.refresh_token);
    }
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    setUser(profile);
    setAuthProviderType('server');
    return profile;
  };

  const serverRegister = async (
    email: string,
    pass: string,
    displayName: string,
    role: UserRole
  ): Promise<UserProfile> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, full_name: displayName, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.detail || data.error || 'Unable to create account.');
      err.code = data.code || 'auth/register-failed';
      throw err;
    }
    const userObj = data.user || {};
    const profile: UserProfile = {
      uid: String(data.user_id || userObj.uid || 'usr_' + Date.now()),
      email: data.email || userObj.email || email,
      displayName: data.full_name || userObj.displayName || displayName,
      role: (data.role || userObj.role || role) as UserRole,
      createdAt: userObj.createdAt || new Date().toISOString(),
    };
    const token = data.access_token || data.token;
    if (token) {
      localStorage.setItem(SERVER_TOKEN_KEY, token);
    }
    if (data.refresh_token) {
      localStorage.setItem('dermai_refresh_token', data.refresh_token);
    }
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    setUser(profile);
    setAuthProviderType('server');
    return profile;
  };

  const login = async (email: string, pass: string) => {
    const normalizedEmail = email.trim();
    try {
      const profile = await serverLogin(normalizedEmail, pass);
      await auditService.log({
        action: 'login',
        user_id: profile.uid,
        user_email: profile.email,
        user_role: profile.role,
        details: 'User authenticated via FastAPI REST Authentication',
      });
      return;
    } catch (serverErr: any) {
      try {
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
        const profile = await syncUserProfile(cred.user);
        await auditService.log({
          action: 'login',
          user_id: cred.user.uid,
          user_email: normalizedEmail,
          user_role: profile.role,
          details: 'User authenticated via Firebase Auth',
        });
        return;
      } catch {
        throw serverErr;
      }
    }
  };

  const register = async (email: string, pass: string, displayName: string, role: UserRole) => {
    const normalizedEmail = email.trim();
    const cleanName = displayName.trim();
    const assignedRole: UserRole =
      normalizedEmail.toLowerCase() === ADMIN_EMAIL ? 'admin' : role;

    try {
      const profile = await serverRegister(normalizedEmail, pass, cleanName, assignedRole);
      await auditService.log({
        action: 'login',
        user_id: profile.uid,
        user_email: profile.email,
        user_role: profile.role,
        details: `New account registered with role: ${profile.role}`,
      });
      return;
    } catch (serverErr) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
        }

        const userRef = doc(db, 'users', cred.user.uid);
        const newProfile: UserProfile = {
          uid: cred.user.uid,
          email: normalizedEmail,
          displayName: cleanName || normalizedEmail.split('@')[0],
          role: assignedRole,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUser(newProfile);
        setAuthProviderType('firebase');
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(newProfile));
        localStorage.removeItem(SERVER_TOKEN_KEY);

        await auditService.log({
          action: 'login',
          user_id: cred.user.uid,
          user_email: normalizedEmail,
          user_role: assignedRole,
          details: `New account registered with role: ${assignedRole}`,
        });
      } catch {
        throw serverErr;
      }
    }
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const profile = await syncUserProfile(cred.user, 'clinician');
    await auditService.log({
      action: 'login',
      user_id: cred.user.uid,
      user_email: cred.user.email || '',
      user_role: profile.role,
      details: 'User authenticated via Google Sign-In Popup',
    });
  };

  const logout = async () => {
    if (user) {
      await auditService.log({
        action: 'login',
        user_id: user.uid,
        user_email: user.email,
        user_role: user.role,
        details: 'User session logged out',
      });
    }
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out caught:', e);
    }
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    localStorage.removeItem(SERVER_TOKEN_KEY);
    setUser(null);
    setFirebaseUser(null);
    setAuthProviderType(null);
  };

  const resetPassword = async (email: string): Promise<string | void> => {
    const normalizedEmail = email.trim();
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
    } catch (fbErr: any) {
      if (fbErr?.code !== 'auth/operation-not-allowed') {
        throw fbErr;
      }
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not process password reset request.');
      }
      return data.message;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = localStorage.getItem(SERVER_TOKEN_KEY);
    if (!token) {
      throw new Error('Use Send Password Reset for Google or Firebase accounts.');
    }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update password.');
    }
  };

  const updateDisplayName = async (displayName: string) => {
    if (!user) return;
    const clean = displayName.trim();
    if (!clean) return;
    const updatedAt = new Date().toISOString();

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: clean }).catch(() => {});
      await setDoc(doc(db, 'users', auth.currentUser.uid), { displayName: clean, updatedAt }, { merge: true });
      const next = { ...user, displayName: clean, updatedAt };
      setUser(next);
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(next));
      return;
    }

    const token = localStorage.getItem(SERVER_TOKEN_KEY);
    if (token) {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(data.user));
        return;
      }
    }

    const next = { ...user, displayName: clean, updatedAt };
    setUser(next);
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(next));
  };

  const switchDemoRole = async (role: UserRole) => {
    const cred = DEMO_CREDENTIALS[role];
    try {
      await serverLogin(cred.email, cred.pass);
      return;
    } catch (e) {
      console.warn('Backend login fallback for role sandbox:', e);
    }

    const demo = DEMO_USERS[role];
    const demoProfile: UserProfile = {
      uid: `demo_${role}_001`,
      email: demo.email,
      displayName: demo.name,
      role: demo.role,
      createdAt: new Date().toISOString(),
    };
    localStorage.removeItem(SERVER_TOKEN_KEY);
    setUser(demoProfile);
    setAuthProviderType('demo');
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(demoProfile));

    await auditService.log({
      action: 'role_change',
      user_id: demoProfile.uid,
      user_email: demoProfile.email,
      user_role: demoProfile.role,
      details: `Switched local Demo Sandbox role perspective to ${role.toUpperCase()}`,
    });
  };

  const updateRole = async (newRole: UserRole) => {
    if (!user) return;
    await switchDemoRole(newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        authProviderType,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        changePassword,
        updateDisplayName,
        switchDemoRole,
        updateRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
