import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import type { PredictionResult, QualityMetrics, ClassicalSegmentationResult, UserRole } from '../types';

export interface StoredAnalysisRecord {
  id: string;
  case_id: string;
  owner_id: string;
  image_url: string;
  model_version: string;
  predicted_label: string;
  predicted_name: string;
  confidence: number;
  risk_tag: string;
  is_demo_mode: boolean;
  latency_ms: number;
  quality_label?: string;
  quality_metrics?: QualityMetrics;
  segmentation?: ClassicalSegmentationResult;
  prediction?: PredictionResult;
  disclaimer: string;
  created_at: string;
}

const LOCAL_ANALYSES_KEY = 'dermai_analyses_history';

function readLocalAnalyses(): StoredAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ANALYSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const analysisService = {
  recordAnalysis: async (
    entry: Omit<StoredAnalysisRecord, 'id' | 'created_at' | 'disclaimer'>
  ): Promise<StoredAnalysisRecord> => {
    const effectiveOwnerId = auth.currentUser ? auth.currentUser.uid : entry.owner_id;
    const payload: Omit<StoredAnalysisRecord, 'id'> = {
      ...entry,
      owner_id: effectiveOwnerId,
      disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
      created_at: new Date().toISOString(),
    };

    if (!auth.currentUser) {
      const saved: StoredAnalysisRecord = { id: `local_an_${Date.now()}`, ...payload };
      const local = readLocalAnalyses();
      localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify([saved, ...local].slice(0, 100)));
      return saved;
    }

    try {
      const ref = await addDoc(collection(db, 'analyses'), payload);
      const saved: StoredAnalysisRecord = { id: ref.id, ...payload };
      const local = readLocalAnalyses();
      localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify([saved, ...local].slice(0, 100)));
      return saved;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'analyses');
    }
  },

  listByCaseId: async (caseId: string): Promise<StoredAnalysisRecord[]> => {
    const localMatches = readLocalAnalyses().filter((a) => a.case_id === caseId);
    if (!auth.currentUser) {
      return localMatches.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    try {
      const q = query(collection(db, 'analyses'), where('case_id', '==', caseId));
      const snap = await getDocs(q);
      const remote = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as StoredAnalysisRecord[];

      const merged = new Map<string, StoredAnalysisRecord>();
      remote.forEach((r) => merged.set(r.id, r));
      localMatches.forEach((l) => {
        if (!merged.has(l.id)) merged.set(l.id, l);
      });

      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'analyses');
    }
  },

  listAllRecent: async (role?: UserRole): Promise<StoredAnalysisRecord[]> => {
    const local = readLocalAnalyses();
    if (!auth.currentUser) {
      return local;
    }

    try {
      const q =
        role === 'patient'
          ? query(collection(db, 'analyses'), where('owner_id', '==', auth.currentUser.uid))
          : query(collection(db, 'analyses'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const remote = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as StoredAnalysisRecord[];
      return remote.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'analyses');
    }
  },
};
