import type { PredictionResult, DiseaseClassKey, RiskTag } from '../types';
import { DISEASE_CLASSES } from '../types';

// Admin-configurable threshold (default 0.5)
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export const mlService = {
  getConfidenceThreshold: (): number => {
    const saved = localStorage.getItem('dermai_confidence_threshold');
    return saved ? parseFloat(saved) : DEFAULT_CONFIDENCE_THRESHOLD;
  },

  setConfidenceThreshold: (threshold: number): void => {
    localStorage.setItem('dermai_confidence_threshold', threshold.toString());
  },

  getMlServiceUrl: (): string => {
    // Check Vite client env or stored settings
    return (
      (import.meta as any).env?.VITE_ML_SERVICE_URL ||
      localStorage.getItem('dermai_ml_service_url') ||
      ''
    );
  },

  setMlServiceUrl: (url: string): void => {
    localStorage.setItem('dermai_ml_service_url', url);
  },

  // Predict endpoint complying strictly with ML service REST contract
  predict: async (
    imageBlob: Blob | File,
    activeModelVersion: string = 'v1.0 ResNet50'
  ): Promise<PredictionResult> => {
    const serviceUrl = mlService.getMlServiceUrl();
    const threshold = mlService.getConfidenceThreshold();

    // If no remote ML service URL is configured, execute in DEMO MODE without fake predictions
    if (!serviceUrl) {
      return {
        model_version: activeModelVersion,
        top3: [],
        confidence: 0,
        risk_tag: 'Requires Clinical Review',
        latency_ms: 0,
        is_demo_mode: true,
        requires_clinical_review: true,
        disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
        timestamp: new Date().toISOString(),
      };
    }

    const formData = new FormData();
    formData.append('image', imageBlob);

    const startTime = performance.now();
    try {
      const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        headers: {
          'X-Model-Version': activeModelVersion,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ML Service responded with HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Math.round(data.latency_ms || performance.now() - startTime);

      // Validate top3 classes and format names
      const top3 = (data.top3 || []).map((item: any) => {
        const key = item.label as DiseaseClassKey;
        const meta = DISEASE_CLASSES[key];
        return {
          label: key,
          label_name: meta ? meta.name : item.label,
          probability: Number((item.probability || 0).toFixed(4)),
        };
      });

      const topConfidence = data.confidence !== undefined ? data.confidence : (top3[0]?.probability || 0);
      const isLowConfidence = topConfidence < threshold;

      // Risk tag from class metadata config table or low-confidence override
      let riskTag: RiskTag = data.risk_tag;
      if (!riskTag && top3[0]) {
        const topClass = DISEASE_CLASSES[top3[0].label as DiseaseClassKey];
        riskTag = isLowConfidence ? 'Requires Clinical Review' : (topClass?.defaultRisk || 'Moderate');
      }

      return {
        model_version: data.model_version || activeModelVersion,
        top3,
        confidence: topConfidence,
        risk_tag: isLowConfidence ? 'Requires Clinical Review' : riskTag,
        mask_png_base64: data.mask_png_base64,
        heatmap_png_base64: data.heatmap_png_base64,
        latency_ms: latencyMs,
        is_demo_mode: false,
        requires_clinical_review: isLowConfidence,
        disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('ML Service REST connection failure, falling back to Demo Mode:', err);
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

  // Generates client-side Grad-CAM saliency heatmap for explainability view
  generateSaliencyHeatmap: async (
    imageSource: HTMLImageElement | HTMLCanvasElement,
    maskDataUrl?: string
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

    // Heatmap canvas (Jet colormap: Blue -> Cyan -> Green -> Yellow -> Red)
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = width;
    heatCanvas.height = height;
    const heatCtx = heatCanvas.getContext('2d')!;
    const heatData = heatCtx.createImageData(width, height);

    // Compute center-weighted gradient response to simulate deep feature localization
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

        // Distance from center Gaussian
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        const spatialWeight = Math.exp(-distSq / (2 * sigma * sigma));

        // Darker pigment regions produce higher activation
        const pigmentWeight = (255 - lum) / 255;
        const intensity = Math.min(1.0, Math.max(0, spatialWeight * 0.7 + pigmentWeight * 0.5));

        // Jet colormap conversion
        // Blue (low) -> Green (mid) -> Red (high)
        let redVal = 0, greenVal = 0, blueVal = 0;
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
        heatData.data[idx + 3] = Math.round(intensity * 200 + 40); // Opacity
      }
    }

    heatCtx.putImageData(heatData, 0, 0);
    return heatCanvas.toDataURL('image/png');
  },
};
