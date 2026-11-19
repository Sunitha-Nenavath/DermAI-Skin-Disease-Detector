import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Clock,
  Cpu,
  Activity,
  Sliders,
} from 'lucide-react';
import type { PredictionResult, QualityMetrics } from '../types';
import { DISEASE_CLASSES } from '../types';

interface ClassificationResultViewProps {
  prediction?: PredictionResult | null;
  quality?: QualityMetrics;
  onRunInference?: () => void;
  isRunning?: boolean;
}

export const ClassificationResultView: React.FC<ClassificationResultViewProps> = ({
  prediction,
  quality,
  onRunInference,
  isRunning,
}) => {
  // If no prediction yet or in demo mode without remote model
  const isDemoMode = !prediction || prediction.is_demo_mode;
  const isLowConfidence = Boolean(prediction?.requires_clinical_review);

  const chartData =
    prediction && prediction.top3.length > 0
      ? prediction.top3.map((item) => ({
          name: item.label_name,
          code: item.label,
          probability: Math.round(item.probability * 100),
          meta: DISEASE_CLASSES[item.label],
        }))
      : [];

  const getRiskTagBadge = (tag: string) => {
    switch (tag) {
      case 'High':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              AI-Assisted Classification Result (Module 7)
            </h3>
            {prediction && (
              <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono font-medium">
                {prediction.model_version}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            HAM10000 7-class deep convolutional network inference with calibrated top-3 probability distribution.
          </p>
        </div>

        {onRunInference && (
          <button
            type="button"
            onClick={onRunInference}
            disabled={isRunning}
            className="px-4 py-2 bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isRunning ? 'Running Inference...' : 'Evaluate with Model'}</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* DEMO MODE BANNER (When ML_SERVICE_URL is not connected) */}
        {isDemoMode && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              DEMO MODE: no trained model connected. Output is not a real prediction.
            </div>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              In accordance with clinical safety standards, this application never invents fake probabilities or synthetic disease labels. All client-side validation steps (resolution check, Laplacian blur, CLAHE contrast, color normalization, and classical Otsu lesion segmentation) are actively operating.
            </p>
            <div className="pt-2 text-[11px] text-amber-950 font-mono">
              To connect a trained PyTorch model server, specify the <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">ML_SERVICE_URL</code> environment variable (or test via Settings).
            </div>
          </div>
        )}

        {/* Low Confidence Warning Rule */}
        {prediction && isLowConfidence && !isDemoMode && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-900">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-950 uppercase tracking-wide">
                Requires Clinical Review (Low-Confidence Safeguard)
              </div>
              <p className="mt-0.5 opacity-90">
                Model confidence ({Math.round(prediction.confidence * 100)}%) is below the clinical decision-support threshold (50%). Dermatological evaluation and in-person dermoscopy are recommended.
              </p>
            </div>
          </div>
        )}

        {/* Prediction Metrics Display */}
        {prediction && !isDemoMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Finding */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Predicted Primary Finding
              </div>
              <div className="text-lg font-bold text-[#0B1F3A]">
                {chartData[0]?.name || 'Lesion Detected'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Confidence:</span>
                <span className="font-mono text-sm font-bold text-[#0E9F8E]">
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Risk Category Tag */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Clinical Risk Classification
              </div>
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${getRiskTagBadge(
                    prediction.risk_tag
                  )}`}
                >
                  {prediction.risk_tag}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Derived from HAM10000 histological ground truth
              </div>
            </div>

            {/* Latency & Quality */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Model Latency & Quality
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Inference Time: <strong className="font-mono">{prediction.latency_ms} ms</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Input Quality: <strong>{quality?.quality_label || 'Passed'}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Top-3 Probability Distribution Chart */}
        {chartData.length > 0 && !isDemoMode && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Top-3 Differential Class Probabilities
            </h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Posterior Probability']}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  />
                  <Bar dataKey="probability" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? '#0E9F8E' : index === 1 ? '#0B1F3A' : '#94A3B8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Mandatory Clinical Disclaimer */}
        <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <span className="font-medium">
              Notice: AI-assisted analysis, not a standalone medical diagnosis.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            7-Class ISIC Protocol
          </span>
        </div>
      </div>
    </div>
  );
};
