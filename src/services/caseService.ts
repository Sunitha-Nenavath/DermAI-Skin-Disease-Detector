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
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { auditService } from './auditService';
import type { ClinicalCase, UserRole } from '../types';

export const caseService = {
  // Fetch cases according to user role
  listCases: async (
    role: UserRole,
    userId: string,
    filters?: { status?: string; bodyLocation?: string; dateRange?: 'all' | '7d' | '30d' }
  ): Promise<ClinicalCase[]> => {
    try {
      const casesRef = collection(db, 'cases');
      let q;

      // Patients read only their own cases; Clinicians, Admins, Researchers, ML Engineers read all cases
      if (role === 'patient') {
        q = query(casesRef, where('owner_id', '==', userId), orderBy('created_at', 'desc'));
      } else {
        q = query(casesRef, orderBy('created_at', 'desc'));
      }

      const snapshot = await getDocs(q);
      let cases = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ClinicalCase[];

      // In-memory filter for status, body location, and date range
      if (filters?.status && filters.status !== 'all') {
        cases = cases.filter((c) => c.status === filters.status);
      }
      if (filters?.bodyLocation && filters.bodyLocation !== 'all') {
        cases = cases.filter((c) => c.body_location === filters.bodyLocation);
      }
      if (filters?.dateRange && filters.dateRange !== 'all') {
        const now = new Date().getTime();
        const days = filters.dateRange === '7d' ? 7 : 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        cases = cases.filter((c) => new Date(c.created_at).getTime() >= cutoff);
      }

      // Researchers view only de-identified data (strip owner details)
      if (role === 'researcher') {
        cases = cases.map((c) => ({
          ...c,
          owner_name: 'ANONYMIZED_SUBJECT',
          owner_id: 'ANON',
        }));
      }

      return cases;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    }
  },

  getCaseById: async (id: string, role: UserRole, userId: string): Promise<ClinicalCase | null> => {
    try {
      const docRef = doc(db, 'cases', id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;

      const data = { id: snapshot.id, ...snapshot.data() } as ClinicalCase;

      // Enforce role-based access check
      if (role === 'patient' && data.owner_id !== userId) {
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
    try {
      const now = new Date().toISOString();
      const payload: Omit<ClinicalCase, 'id'> = {
        ...caseData,
        created_at: now,
        updated_at: now,
        medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
      };

      const docRef = await addDoc(collection(db, 'cases'), payload);
      const createdCase: ClinicalCase = { id: docRef.id, ...payload };

      // Record audit log
      await auditService.log({
        action: 'case_create',
        user_id: caseData.owner_id,
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
    try {
      const docRef = doc(db, 'cases', id);
      await updateDoc(docRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      await auditService.log({
        action: 'case_create',
        user_id: updates.owner_id || 'system',
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
    try {
      const docRef = doc(db, 'cases', id);
      const existing = await getDoc(docRef);
      const currentNotes = existing.data()?.clinical_notes || '';
      const timestamp = new Date().toLocaleString();
      const updatedNotes = currentNotes
        ? `${currentNotes}\n\n[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`
        : `[${timestamp} - ${userEmail} (${userRole})]:\n${notes}`;

      await updateDoc(docRef, {
        clinical_notes: updatedNotes,
        updated_at: new Date().toISOString(),
      });

      await auditService.log({
        action: 'case_create',
        user_id: existing.data()?.owner_id || 'system',
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

    try {
      const docRef = doc(db, 'cases', id);
      await deleteDoc(docRef);

      await auditService.log({
        action: 'case_create',
        user_id: userId,
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
