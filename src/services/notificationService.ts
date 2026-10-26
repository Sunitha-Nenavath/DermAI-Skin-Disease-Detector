import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { InAppNotification } from '../types';

export const notificationService = {
  getNotifications: async (userId: string): Promise<InAppNotification[]> => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as InAppNotification[];
    } catch {
      // Local demo notification fallback for immediate testing
      const saved = localStorage.getItem(`dermai_notifications_${userId}`);
      if (saved) {
        return JSON.parse(saved);
      }
      const initial: InAppNotification[] = [
        {
          id: 'notif-1',
          user_id: userId,
          title: 'AI-Assisted Finding Completed',
          message: 'Screening analysis for CASE-728109 (Upper Extremity) has concluded. Top class: Melanocytic Nevus.',
          level: 'Informational',
          read: false,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'notif-2',
          user_id: userId,
          title: 'Clinical Review Recommended',
          message: 'Model confidence for CASE-319082 is borderline (44%). Clinical review is recommended.',
          level: 'High',
          read: false,
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'notif-3',
          user_id: userId,
          title: 'Follow-Up Screening Reminder',
          message: '30-day temporal dermoscopy checkup scheduled for baseline lesion monitoring.',
          level: 'Medium',
          read: true,
          created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        },
      ];
      localStorage.setItem(`dermai_notifications_${userId}`, JSON.stringify(initial));
      return initial;
    }
  },

  createNotification: async (
    notif: Omit<InAppNotification, 'id' | 'created_at' | 'read'>
  ): Promise<void> => {
    // Prohibit prohibited words
    let safeTitle = notif.title
      .replace(/critical diagnosis/gi, 'AI-assisted finding')
      .replace(/confirmed diagnosis/gi, 'AI-assisted finding');
    let safeMessage = notif.message
      .replace(/critical diagnosis/gi, 'AI-assisted finding')
      .replace(/confirmed/gi, 'observed');

    const payload = {
      ...notif,
      title: safeTitle,
      message: safeMessage,
      read: false,
      created_at: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'notifications'), payload);
    } catch {
      const saved = localStorage.getItem(`dermai_notifications_${notif.user_id}`);
      const list = saved ? JSON.parse(saved) : [];
      list.unshift({ id: `local_${Date.now()}`, ...payload });
      localStorage.setItem(`dermai_notifications_${notif.user_id}`, JSON.stringify(list));
    }
  },

  markAsRead: async (userId: string, notifId: string): Promise<void> => {
    try {
      const docRef = doc(db, 'notifications', notifId);
      await updateDoc(docRef, { read: true });
    } catch {
      const saved = localStorage.getItem(`dermai_notifications_${userId}`);
      if (saved) {
        const list: InAppNotification[] = JSON.parse(saved);
        const updated = list.map((n) => (n.id === notifId ? { ...n, read: true } : n));
        localStorage.setItem(`dermai_notifications_${userId}`, JSON.stringify(updated));
      }
    }
  },
};
