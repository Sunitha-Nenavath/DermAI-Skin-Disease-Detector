import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { AuditLogEntry } from '../types';

const LOCAL_AUDIT_LOGS_KEY = 'dermai_local_audit_logs';

export function readLocalAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const auditService = {
  log: async (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> => {
    const payload: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    // Only write to Cloud Firestore when an authenticated Firebase user is active
    if (!auth.currentUser) {
      const existing = readLocalAuditLogs();
      const localEntry: AuditLogEntry = {
        id: `local_audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...payload,
      };
      try {
        localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify([localEntry, ...existing].slice(0, 150)));
      } catch {
        // Ignore storage quota errors
      }
      return;
    }

    try {
      await addDoc(collection(db, 'audit_logs'), {
        ...payload,
        user_id: auth.currentUser.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
    }
  },
};
