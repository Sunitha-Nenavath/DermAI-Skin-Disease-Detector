import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { PredictionResult, DiseaseClassKey, RiskTag } from '../types';
import { DISEASE_CLASSES } from '../types';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;
const RISK_CONFIG_STORAGE_KEY = 'dermai_risk_config_table';
const THRESHOLD_STORAGE_KEY = 'dermai_confidence_threshold';
const ML_URL_STORAGE_KEY = 'dermai_ml_service_url';

export type RiskConfigTable = Record<DiseaseClassKey, RiskTag>;

export const DEFAULT_RISK_CONFIG: RiskConfigTable = {
  mel: 'High',
  bcc: 'Moderate',
  akiec: 'Moderate',
  nv: 'Low',
  bkl: 'Low',
  df: 'Low',
  vasc: 'Low',
};

export const mlService = {
  getConfidenceThreshold: (): number => {
    const saved = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_CONFIDENCE_THRESHOLD;
  },

  setConfidenceThreshold: async (threshold: number): Promise<void> => {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, threshold.toString());
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, 'settings', 'clinical_config'),
        { confidence_threshold: threshold, updated_at: new Date().toISOString() },
        { merge: true }
      );
    } catch {
      // Non-admin fallback handled via localStorage
    }
  },

  getRiskConfig: (): RiskConfigTable => {
    const saved = localStorage.getItem(RISK_CONFIG_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_RISK_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_RISK_CONFIG;
      }
    }
    return DEFAULT_RISK_CONFIG;
  },

  saveRiskConfig: async (table: RiskConfigTable): Promise<void> => {
    localStorage.setItem(RISK_CONFIG_STORAGE_KEY, JSON.stringify(table));
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, 'settings', 'clinical_config'),
        { risk_config: table, updated_at: new Date().toISOString() },
        { merge: true }
      );
    } catch {
      // Non-blocking fallback
    }
  },

  syncClinicalConfigFromFirestore: async (): Promise<{
    threshold: number;
    riskConfig: RiskConfigTable;
  }> => {
    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'clinical_config'));
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.confidence_threshold === 'number') {
            localStorage.setItem(THRESHOLD_STORAGE_KEY, String(data.confidence_threshold));
          }
          if (data.risk_config) {
            localStorage.setItem(RISK_CONFIG_STORAGE_KEY, JSON.stringify(data.risk_config));
          }
        }
      } catch {
        // Use cached values
      }
    }
    return {
      threshold: mlService.getConfidenceThreshold(),
      riskConfig: mlService.getRiskConfig(),
    };
  },

  getMlServiceUrl: (): string => {
    return (
      (import.meta as any).env?.VITE_ML_SERVICE_URL ||
      localStorage.getItem(ML_URL_STORAGE_KEY) ||
      ''
    );
  },

  setMlServiceUrl: (url: string): void => {
    localStorage.setItem(ML_URL_STORAGE_KEY, url.trim());
  },

  // Predict via backend proxy (/api/ml/predict -> {ML_SERVICE_URL}/predict)
  predict: async (
    imageBlob: Blob | File,
    activeModelVersion: string = 'v3.0 Ensemble'
  ): Promise<PredictionResult> => {
    const overrideUrl = mlService.getMlServiceUrl();
    const threshold = mlService.getConfidenceThreshold();
    const riskConfig = mlService.getRiskConfig();

    const formData = new FormData();
    formData.append('image', imageBlob, 'lesion.jpg');

    const headers: Record<string, string> = {
      'X-Model-Version': activeModelVersion,
    };
    if (overrideUrl) {
      headers['X-ML-Service-Url'] = overrideUrl;
    }

    const startTime = performance.now();
    try {
      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.demo_mode) {
        return {
          model_version: activeModelVersion,
          top3: [],
          confidence: 0,
          risk_tag: 'Requires Clinical Review',
          latency_ms: Math.round(performance.now() - startTime),
          is_demo_mode: true,
          requires_clinical_review: true,
          disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
          timestamp: new Date().toISOString(),
        };
      }

      const latencyMs = Math.round(data.latency_ms || performance.now() - startTime);
      const top3 = (data.top3 || []).map((item: any) => {
        const key = item.label as DiseaseClassKey;
        const meta = DISEASE_CLASSES[key];
        return {
          label: key,
          label_name: meta ? meta.name : item.label,
          probability: Number((item.probability || 0).toFixed(4)),
        };
      });

      const topConfidence =
        data.confidence !== undefined ? Number(data.confidence) : top3[0]?.probability || 0;
      const isLowConfidence = topConfidence < threshold;

      // Apply ML Engineer risk config table (class -> RiskTag) and low-confidence safeguard
      let riskTag: RiskTag = data.risk_tag;
      if (top3[0]) {
        const configuredRisk = riskConfig[top3[0].label as DiseaseClassKey];
        if (configuredRisk) {
          riskTag = configuredRisk;
        }
      }
      if (isLowConfidence) {
        riskTag = 'Requires Clinical Review';
      }

      return {
        model_version: data.model_version || activeModelVersion,
        top3,
        confidence: topConfidence,
        risk_tag: riskTag || 'Requires Clinical Review',
        mask_png_base64: data.mask_png_base64,
        heatmap_png_base64: data.heatmap_png_base64,
        latency_ms: latencyMs,
        is_demo_mode: false,
        requires_clinical_review: isLowConfidence,
        disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('ML proxy request failed, falling back cleanly to Demo Mode:', err);
      return {
        model_version: activeModelVersion,
        top3: [],
        confidence: 0,
        risk_tag: 'Requires Clinical Review',
        latency_ms: Math.round(performance.now() - startTime),
        is_demo_mode: true,
        requires_clinical_review: true,
        disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
        timestamp: new Date().toISOString(),
      };
    }
  },

  // Demo-mode visual intensity overlay helper (explicitly labeled as non-model preview in UI)
  generateSaliencyHeatmap: async (
    imageSource: HTMLImageElement | HTMLCanvasElement,
    _maskDataUrl?: string
  ): Promise<string> => {
    const width = 224;
    const height = 224;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot get canvas 2D context for saliency');

    ctx.drawImage(imageSource, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = width;
    heatCanvas.height = height;
    const heatCtx = heatCanvas.getContext('2d')!;
    const heatData = heatCtx.createImageData(width, height);

    const cx = width / 2;
    const cy = height / 2;
    const sigma = width * 0.28;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        const spatialWeight = Math.exp(-distSq / (2 * sigma * sigma));
        const pigmentWeight = (255 - lum) / 255;
        const intensity = Math.min(1.0, Math.max(0, spatialWeight * 0.7 + pigmentWeight * 0.5));

        let redVal = 0,
          greenVal = 0,
          blueVal = 0;
        if (intensity < 0.25) {
          blueVal = Math.round(255 * (intensity / 0.25));
        } else if (intensity < 0.5) {
          greenVal = Math.round(255 * ((intensity - 0.25) / 0.25));
          blueVal = 255;
        } else if (intensity < 0.75) {
          redVal = Math.round(255 * ((intensity - 0.5) / 0.25));
          greenVal = 255;
          blueVal = Math.round(255 * (1 - (intensity - 0.5) / 0.25));
        } else {
          redVal = 255;
          greenVal = Math.round(255 * (1 - (intensity - 0.75) / 0.25));
        }

        heatData.data[idx] = redVal;
        heatData.data[idx + 1] = greenVal;
        heatData.data[idx + 2] = blueVal;
        heatData.data[idx + 3] = Math.round(intensity * 200 + 40);
      }
    }

    heatCtx.putImageData(heatData, 0, 0);
    return heatCanvas.toDataURL('image/png');
  },
};
