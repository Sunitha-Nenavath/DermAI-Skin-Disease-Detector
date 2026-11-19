import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { auditService } from './auditService';
import type { ClinicalCase, UserRole } from '../types';

const LOCAL_CASES_KEY = 'dermai_local_cases';

function readLocalCases(): ClinicalCase[] {
  try {
    const raw = localStorage.getItem(LOCAL_CASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalCases(cases: ClinicalCase[]): void {
  try {
    localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(cases));
  } catch {
    // Quota fallback ignored
  }
}

function applyCaseFilters(
  cases: ClinicalCase[],
  role: UserRole,
  filters?: { status?: string; bodyLocation?: string; dateRange?: 'all' | '7d' | '30d' }
): ClinicalCase[] {
  let result = [...cases].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (filters?.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status);
  }
  if (filters?.bodyLocation && filters.bodyLocation !== 'all') {
    result = result.filter((c) => c.body_location === filters.bodyLocation);
  }
  if (filters?.dateRange && filters.dateRange !== 'all') {
    const now = Date.now();
    const days = filters.dateRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    result = result.filter((c) => new Date(c.created_at).getTime() >= cutoff);
  }

  if (role === 'researcher') {
    result = result.map((c) => ({
      ...c,
      owner_name: 'ANONYMIZED_SUBJECT',
      owner_id: 'ANON',
    }));
  }

  return result;
}

export const caseService = {
  // Fetch cases according to user role
  listCases: async (
    role: UserRole,
    userId: string,
    filters?: { status?: string; bodyLocation?: string; dateRange?: 'all' | '7d' | '30d' }
  ): Promise<ClinicalCase[]> => {
    const serverToken = localStorage.getItem('dermai_server_token');
    if (serverToken) {
      try {
        const url = new URL('/api/cases', window.location.origin);
        if (filters?.status && filters.status !== 'all') url.searchParams.set('status', filters.status);
        if (filters?.bodyLocation && filters.bodyLocation !== 'all') url.searchParams.set('body_location', filters.bodyLocation);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${serverToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((item: any) => ({
            id: String(item.id),
            case_code: item.case_code,
            title: item.title,
            body_location: item.body_location,
            status: item.status,
            owner_id: String(item.owner_id),
            owner_name: item.owner_name,
            patient: item.patient,
            image_url: item.images && item.images.length > 0 ? item.images[0].file_url : undefined,
            quality_label: item.images && item.images.length > 0 ? item.images[0].quality_label : undefined,
            quality_metrics: item.images && item.images.length > 0 ? item.images[0].quality_metrics : undefined,
            created_at: item.created_at,
            updated_at: item.created_at,
            medical_disclaimer: item.medical_disclaimer,
          }));
          return applyCaseFilters(mapped, role, filters);
        }
      } catch (e) {
        console.warn('Backend cases fetch failed, using local fallback:', e);
      }
    }

    // Local Demo Sandbox when Firebase Auth session is not active
    if (!auth.currentUser) {
      let local = readLocalCases();
      if (role === 'patient' || role === 'ml_engineer') {
        local = local.filter((c) => c.owner_id === userId);
      }
      return applyCaseFilters(local, role, filters);
    }

    try {
      const casesRef = collection(db, 'cases');
      let q;

      // Patients and ML Engineers query strictly by their authenticated UID (avoids composite index + matches rules)
      if (role === 'patient' || role === 'ml_engineer') {
        q = query(casesRef, where('owner_id', '==', auth.currentUser.uid));
      } else {
        q = query(casesRef, orderBy('created_at', 'desc'));
      }

      const snapshot = await getDocs(q);
      const cases = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ClinicalCase[];

      return applyCaseFilters(cases, role, filters);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    }
  },

  getCaseById: async (id: string, role: UserRole, userId: string): Promise<ClinicalCase | null> => {
    const serverToken = localStorage.getItem('dermai_server_token');
    if (serverToken && !id.startsWith('local_') && !id.startsWith('case_demo_')) {
      try {
        const res = await fetch(`/api/cases/${id}`, {
          headers: { Authorization: `Bearer ${serverToken}` },
        });
        if (res.ok) {
          const item = await res.json();
          return {
            id: String(item.id),
            case_code: item.case_code,
            title: item.title,
            body_location: item.body_location,
            status: item.status,
            owner_id: String(item.owner_id),
            owner_name: item.owner_name,
            patient: item.patient,
            image_url: item.images && item.images.length > 0 ? item.images[0].file_url : undefined,
            quality_label: item.images && item.images.length > 0 ? item.images[0].quality_label : undefined,
            quality_metrics: item.images && item.images.length > 0 ? item.images[0].quality_metrics : undefined,
            created_at: item.created_at,
            updated_at: item.created_at,
            medical_disclaimer: item.medical_disclaimer,
          };
        }
      } catch (e) {
        console.warn('Backend getCaseById fallback:', e);
      }
    }

    if (!auth.currentUser) {
      const found = readLocalCases().find((c) => c.id === id) || null;
      if (!found) return null;
      if (role === 'patient' && found.owner_id !== userId) {
        throw new Error('Access denied: You can only view your own cases.');
      }
      if (role === 'researcher') {
        return { ...found, owner_name: 'ANONYMIZED_SUBJECT', owner_id: 'ANON' };
      }
      return found;
    }

    try {
      const docRef = doc(db, 'cases', id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;

      const data = { id: snapshot.id, ...snapshot.data() } as ClinicalCase;

      if (role === 'patient' && data.owner_id !== auth.currentUser.uid) {
        throw new Error('Access denied: You can only view your own cases.');
      }

      if (role === 'researcher') {
        return {
          ...data,
          owner_name: 'ANONYMIZED_SUBJECT',
          owner_id: 'ANON',
        };
      }

      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cases/${id}`);
    }
  },

  createCase: async (
    caseData: Omit<ClinicalCase, 'id' | 'created_at' | 'updated_at' | 'medical_disclaimer'>,
    creatorEmail: string,
    creatorRole: string
  ): Promise<ClinicalCase> => {
    const serverToken = localStorage.getItem('dermai_server_token');
    if (serverToken) {
      try {
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverToken}`,
          },
          body: JSON.stringify({
            title: caseData.title,
            body_location: caseData.body_location,
            patient_age: caseData.patient?.age,
            patient_gender: caseData.patient?.gender,
            medical_history: caseData.patient?.medical_history,
            allergies: caseData.patient?.allergies,
            clinical_notes: caseData.clinical_notes || caseData.patient?.clinical_notes,
          }),
        });
        if (res.ok) {
          const item = await res.json();
          return {
            id: String(item.id),
            case_code: item.case_code,
            title: item.title,
            body_location: item.body_location,
            status: item.status,
            owner_id: String(item.owner_id),
            owner_name: item.owner_name,
            patient: item.patient,
            created_at: item.created_at,
            updated_at: item.created_at,
            medical_disclaimer: item.medical_disclaimer,
          };
        }
      } catch (e) {
        console.warn('Backend createCase fallback:', e);
      }
    }

    const now = new Date().toISOString();
    const effectiveOwnerId = auth.currentUser ? auth.currentUser.uid : caseData.owner_id;
    const payload: Omit<ClinicalCase, 'id'> = {
      ...caseData,
      owner_id: effectiveOwnerId,
      created_at: now,
      updated_at: now,
      medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
    };

    if (!auth.currentUser) {
      const createdCase: ClinicalCase = { id: `local_case_${Date.now()}`, ...payload };
      const local = readLocalCases();
      writeLocalCases([createdCase, ...local]);
      await auditService.log({
        action: 'case_create',
        user_id: effectiveOwnerId,
        user_email: creatorEmail,
        user_role: creatorRole,
        target_id: createdCase.id,
        details: `Created de-identified case ${caseData.case_code} (${caseData.body_location})`,
      });
      return createdCase;
    }

    try {
      const docRef = await addDoc(collection(db, 'cases'), payload);
      const createdCase: ClinicalCase = { id: docRef.id, ...payload };

      await auditService.log({
        action: 'case_create',
        user_id: effectiveOwnerId,
        user_email: creatorEmail,
        user_role: creatorRole,
        target_id: docRef.id,
        details: `Created de-identified case ${caseData.case_code} (${caseData.body_location})`,
      });

      return createdCase;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cases');
    }
  },

  updateCase: async (
    id: string,
    updates: Partial<ClinicalCase>,
    userEmail: string,
    userRole: string
  ): Promise<void> => {
    if (!auth.currentUser) {
      const local = readLocalCases();
      const updated = local.map((c) =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      );
      writeLocalCases(updated);
      await auditService.log({
        action: 'case_create',
        user_id: updates.owner_id || 'demo_user',
        user_email: userEmail,
        user_role: userRole,
        target_id: id,
        details: `Updated case fields: ${Object.keys(updates).join(', ')}`,
      });
      return;
    }

    try {
      const docRef = doc(db, 'cases', id);
      const safeUpdates = { ...updates };
      delete safeUpdates.owner_id;
      await updateDoc(docRef, {
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      });

      await auditService.log({
        action: 'case_create',
        user_id: auth.currentUser.uid,
        user_email: userEmail,
        user_role: userRole,
        target_id: id,
        details: `Updated case fields: ${Object.keys(updates).join(', ')}`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cases/${id}`);
    }
  },

  addClinicalNotes: async (
    id: string,
    notes: string,
    userEmail: string,
    userRole: string
  ): Promise<void> => {
    const timestamp = new Date().toLocaleString();

    const serverToken = localStorage.getItem('dermai_server_token');
    if (serverToken && !id.startsWith('local_') && !id.startsWith('case_demo_')) {
      try {
        await fetch(`/api/cases/${id}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverToken}`,
          },
          body: JSON.stringify({ content: notes }),
        });
        return;
      } catch (e) {
        console.warn('Backend addClinicalNotes fallback:', e);
      }
    }

    if (!auth.currentUser) {
      const local = readLocalCases();
      const updated = local.map((c) => {
        if (c.id !== id) return c;
        const currentNotes = c.clinical_notes || '';
        const updatedNotes = currentNotes
          ? `${currentNotes}\n\n[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`
          : `[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`;
        return { ...c, clinical_notes: updatedNotes, updated_at: new Date().toISOString() };
      });
      writeLocalCases(updated);
      return;
    }

    try {
      const docRef = doc(db, 'cases', id);
      const existing = await getDoc(docRef);
      const currentNotes = existing.data()?.clinical_notes || '';
      const updatedNotes = currentNotes
        ? `${currentNotes}\n\n[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`
        : `[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`;

      await updateDoc(docRef, {
        clinical_notes: updatedNotes,
        updated_at: new Date().toISOString(),
      });

      await auditService.log({
        action: 'case_create',
        user_id: auth.currentUser.uid,
        user_email: userEmail,
        user_role: userRole,
        target_id: id,
        details: `Appended clinical decision-support note to case ${id}`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cases/${id}`);
    }
  },

  deleteCase: async (
    id: string,
    userRole: UserRole,
    userEmail: string,
    userId: string
  ): Promise<void> => {
    if (userRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to purge clinical case records.');
    }

    if (!auth.currentUser) {
      const local = readLocalCases().filter((c) => c.id !== id);
      writeLocalCases(local);
      await auditService.log({
        action: 'case_create',
        user_id: userId,
        user_email: userEmail,
        user_role: userRole,
        target_id: id,
        details: `Purged case record ${id} under administrative privilege`,
      });
      return;
    }

    try {
      const docRef = doc(db, 'cases', id);
      await deleteDoc(docRef);

      await auditService.log({
        action: 'case_create',
        user_id: auth.currentUser.uid,
        user_email: userEmail,
        user_role: userRole,
        target_id: id,
        details: `Purged case record ${id} under administrative privilege`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `cases/${id}`);
    }
  },
};
