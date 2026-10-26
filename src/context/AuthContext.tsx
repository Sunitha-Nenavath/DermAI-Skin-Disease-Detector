import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../firebase/config';
import { auditService } from '../services/auditService';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string, role: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  updateRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; pass: string; name: string }> = {
  clinician: { email: 'dr.chen@dermai.hospital', pass: 'ClinicianDoctor123!', name: 'Dr. Sarah Chen, MD' },
  patient: { email: 'patient.case01@dermai.patient', pass: 'PatientSecure123!', name: 'John Doe (De-identified)' },
  admin: { email: 'admin@dermai.hospital', pass: 'AdminSuperUser123!', name: 'System Security Admin' },
  researcher: { email: 'prof.rostova@dermai.edu', pass: 'ResearchScience123!', name: 'Prof. Elena Rostova, PhD' },
  ml_engineer: { email: 'marcus.ai@dermai.lab', pass: 'MLEngineerModel123!', name: 'Marcus Aurelius (Lead ML)' },
};

export const DEMO_USERS: Record<UserRole, { email: string; name: string; role: UserRole }> = {
  clinician: { email: 'dr.chen@dermai.hospital', name: 'Dr. Sarah Chen, MD', role: 'clinician' },
  patient: { email: 'patient.case01@dermai.patient', name: 'John Doe (De-identified)', role: 'patient' },
  admin: { email: 'admin@dermai.hospital', name: 'System Security Admin', role: 'admin' },
  researcher: { email: 'prof.rostova@dermai.edu', name: 'Prof. Elena Rostova, PhD', role: 'researcher' },
  ml_engineer: { email: 'marcus.ai@dermai.lab', name: 'Marcus Aurelius (Lead ML)', role: 'ml_engineer' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    // Fast local restore for instant UI responsiveness
    const saved = localStorage.getItem('dermai_active_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync user profile from Firestore or mock demo profile
  const syncUserProfile = async (fbUser: FirebaseUser, fallbackRole: UserRole = 'clinician') => {
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
        localStorage.setItem('dermai_active_profile', JSON.stringify(profile));
        return profile;
      } else {
        // Create initial user document in Firestore
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Clinical User',
          role: fallbackRole,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUser(newProfile);
        localStorage.setItem('dermai_active_profile', JSON.stringify(newProfile));
        return newProfile;
      }
    } catch (err) {
      console.warn('Could not read user profile from Firestore, using session fallback:', err);
      const sessionProfile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Clinical User',
        role: fallbackRole,
        createdAt: new Date().toISOString(),
      };
      setUser(sessionProfile);
      localStorage.setItem('dermai_active_profile', JSON.stringify(sessionProfile));
      return sessionProfile;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserProfile(fbUser);
      } else {
        // Check if demo user is active
        const saved = localStorage.getItem('dermai_active_profile');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            setUser(null);
          }
        } else {
          // Default to clinician demo on first load so user can immediately evaluate the app
          const defaultDemo = DEMO_USERS.clinician;
          const initialProfile: UserProfile = {
            uid: `demo_${defaultDemo.role}_001`,
            email: defaultDemo.email,
            displayName: defaultDemo.name,
            role: defaultDemo.role,
            createdAt: new Date().toISOString(),
          };
          setUser(initialProfile);
          localStorage.setItem('dermai_active_profile', JSON.stringify(initialProfile));
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await syncUserProfile(cred.user);
      await auditService.log({
        action: 'login',
        user_id: cred.user.uid,
        user_email: email,
        user_role: profile.role,
        details: 'User authenticated via Email & Password',
      });
    } catch (error: any) {
      // If Firebase Auth fails because user does not exist, check if it's a demo credential
      const foundDemo = Object.values(DEMO_USERS).find((d) => d.email.toLowerCase() === email.toLowerCase());
      if (foundDemo) {
        await switchDemoRole(foundDemo.role);
        return;
      }
      throw error;
    }
  };

  const register = async (email: string, pass: string, displayName: string, role: UserRole) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const userRef = doc(db, 'users', cred.user.uid);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, newProfile);
    setUser(newProfile);
    localStorage.setItem('dermai_active_profile', JSON.stringify(newProfile));

    await auditService.log({
      action: 'login',
      user_id: cred.user.uid,
      user_email: email,
      user_role: role,
      details: `New account registered with role: ${role}`,
    });
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
    localStorage.removeItem('dermai_active_profile');
    setUser(null);
    setFirebaseUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const switchDemoRole = async (role: UserRole) => {
    const demo = DEMO_USERS[role];
    const demoProfile: UserProfile = {
      uid: `demo_${role}_001`,
      email: demo.email,
      displayName: demo.name,
      role: demo.role,
      createdAt: new Date().toISOString(),
    };
    setUser(demoProfile);
    localStorage.setItem('dermai_active_profile', JSON.stringify(demoProfile));

    await auditService.log({
      action: 'role_change',
      user_id: demoProfile.uid,
      user_email: demoProfile.email,
      user_role: demoProfile.role,
      details: `Switched active role perspective to ${role.toUpperCase()}`,
    });
  };

  const updateRole = async (newRole: UserRole) => {
    if (!user) return;
    const oldRole = user.role;
    const updated: UserProfile = { ...user, role: newRole, updatedAt: new Date().toISOString() };
    setUser(updated);
    localStorage.setItem('dermai_active_profile', JSON.stringify(updated));

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), { role: newRole }, { merge: true });
      } catch (err) {
        console.warn('Role update in Firestore warning:', err);
      }
    }

    await auditService.log({
      action: 'role_change',
      user_id: user.uid,
      user_email: user.email,
      user_role: newRole,
      details: `Role updated from ${oldRole} to ${newRole}`,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
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
