import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { InAppNotification } from '../types';

export const notificationService = {
  getNotifications: async (userId: string): Promise<InAppNotification[]> => {
    if (!auth.currentUser) {
      const saved = localStorage.getItem(`dermai_notifications_${userId}`);
      if (saved) {
        return JSON.parse(saved);
      }
      const initial: InAppNotification[] = [
        {
          id: 'notif-1',
          user_id: userId,
          title: 'Demo Sandbox Initialized',
          message: 'Client-side quality screening, CLAHE preprocessing, and Otsu lesion segmentation are ready.',
          level: 'Informational',
          read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'notif-2',
          user_id: userId,
          title: 'Follow-Up Screening Reminder',
          message: 'Remember to document lesion evolution with side-by-side longitudinal capture.',
          level: 'Low',
          read: true,
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
      ];
      localStorage.setItem(`dermai_notifications_${userId}`, JSON.stringify(initial));
      return initial;
    }

    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as InAppNotification[];

      return list
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  },

  createNotification: async (
    notif: Omit<InAppNotification, 'id' | 'created_at' | 'read'>
  ): Promise<void> => {
    const safeTitle = notif.title
      .replace(/critical diagnosis/gi, 'AI-assisted finding')
      .replace(/confirmed diagnosis/gi, 'AI-assisted finding');
    const safeMessage = notif.message
      .replace(/critical diagnosis/gi, 'AI-assisted finding')
      .replace(/\bconfirmed\b/gi, 'observed');

    const effectiveUserId = auth.currentUser ? auth.currentUser.uid : notif.user_id;
    const payload = {
      ...notif,
      user_id: effectiveUserId,
      title: safeTitle,
      message: safeMessage,
      read: false,
      created_at: new Date().toISOString(),
    };

    if (!auth.currentUser) {
      const saved = localStorage.getItem(`dermai_notifications_${effectiveUserId}`);
      const list = saved ? JSON.parse(saved) : [];
      list.unshift({ id: `local_${Date.now()}`, ...payload });
      localStorage.setItem(`dermai_notifications_${effectiveUserId}`, JSON.stringify(list));
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  },

  markAsRead: async (userId: string, notifId: string): Promise<void> => {
    if (!auth.currentUser) {
      const saved = localStorage.getItem(`dermai_notifications_${userId}`);
      if (saved) {
        const list: InAppNotification[] = JSON.parse(saved);
        const updated = list.map((n) => (n.id === notifId ? { ...n, read: true } : n));
        localStorage.setItem(`dermai_notifications_${userId}`, JSON.stringify(updated));
      }
      return;
    }

    try {
      const docRef = doc(db, 'notifications', notifId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
    }
  },
};
