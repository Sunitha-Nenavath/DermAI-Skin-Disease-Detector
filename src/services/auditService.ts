import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { AuditLogEntry } from '../types';

export const auditService = {
  log: async (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> => {
    try {
      const payload: AuditLogEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
      };
      await addDoc(collection(db, 'audit_logs'), payload);
    } catch (error) {
      console.warn('Audit logging warning:', error);
      // We log but do not block critical client workflows if offline
      try {
        handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
      } catch {
        // Suppress unhandled crash for offline audit buffering
      }
    }
  },
};
