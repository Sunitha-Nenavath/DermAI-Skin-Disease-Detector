import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Upload,
  BarChart2,
  Table as TableIcon,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { modelService, ColabEvaluationPayload } from '../services/modelService';
import { DISEASE_CLASSES, DiseaseClassKey } from '../types';

export const EvaluationPage: React.FC = () => {
  const [stats, setStats] = useState<ColabEvaluationPayload>(() =>
    modelService.getColabEvaluationStats()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.accuracy || !parsed.per_class_metrics || !parsed.confusion_matrix) {
          throw new Error('JSON missing mandatory evaluation keys: accuracy, per_class_metrics, or confusion_matrix');
        }
        modelService.saveColabEvaluation(parsed);
        setStats(parsed);
        setUploadSuccess(`Successfully ingested Colab evaluation benchmark for ${parsed.model_name || 'custom model'}!`);
      } catch (err: any) {
        setUploadError(err.message || 'Invalid JSON metrics format.');
      }
    };
    reader.readAsText(file);
  };

  const classLabels: DiseaseClassKey[] = ['mel', 'nv', 'bcc', 'akiec', 'bkl', 'df', 'vasc'];

  // Quality gate distribution data
  const qStats = stats.quality_gate_stats || {
    total_screened: 1420,
    passed_good: 1065,
    passed_acceptable: 241,
    rejected_poor: 114,
    rejection_rate: 8.0,
  };

  const qualityPieData = [
    { name: 'Good Quality (Auto-Passed)', value: qStats.passed_good, color: '#0E9F8E' },
    { name: 'Acceptable (Warning Logged)', value: qStats.passed_acceptable, color: '#F59E0B' },
    { name: 'Poor (Blocked Retake Required)', value: qStats.rejected_poor, color: '#F43F5E' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
              Model Evaluation & Colab Benchmarks (Module 10)
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0E9F8E] border border-teal-200">
              HAM10000 Test Split (15%)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quantitative multi-class dermatological diagnostic metrics: macro-averaged precision, recall, F1, MCC, and confusion matrix.
          </p>
        </div>

        {/* Upload Colab Metrics JSON Button */}
        <div>
          <input
            type="file"
            id="colab-json-upload"
            accept=".json"
            className="hidden"
            onChange={handleJsonUpload}
          />
          <label
            htmlFor="colab-json-upload"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B1F3A] hover:bg-[#152e52] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Colab Metrics JSON</span>
          </label>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {uploadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Top Level Metric Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Overall Accuracy', value: `${(stats.accuracy * 100).toFixed(1)}%`, color: 'text-[#0B1F3A]' },
          { label: 'Balanced Accuracy', value: `${(stats.balanced_accuracy * 100).toFixed(1)}%`, color: 'text-[#0E9F8E]' },
          { label: 'Macro F1-Score', value: `${(stats.macro_f1 * 100).toFixed(1)}%`, color: 'text-indigo-600' },
          { label: 'Sensitivity / Recall', value: `${(stats.sensitivity * 100).toFixed(1)}%`, color: 'text-emerald-700' },
          { label: 'Specificity', value: `${(stats.specificity * 100).toFixed(1)}%`, color: 'text-blue-700' },
          { label: 'AUC-ROC (Multi-Class)', value: stats.auc_roc.toFixed(3), color: 'text-cyan-700' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {item.label}
            </div>
            <div className={`text-xl font-bold font-mono ${item.color}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-Class Performance Bar Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#0E9F8E]" />
            Per-Class Diagnostic Precision, Recall & F1-Score
          </h2>
          <span className="text-xs text-slate-400">Class-Weighted Metrics</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.per_class_metrics} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${(Number(v) * 100).toFixed(1)}%`]} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="precision" name="Precision" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recall" name="Recall (Sensitivity)" fill="#0E9F8E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="f1" name="F1-Score" fill="#38BDF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Confusion Matrix Heatmap */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-[#0E9F8E]" />
              7×7 Multi-Class Confusion Matrix Heatmap
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Horizontal: Predicted Class · Vertical: Ground Truth (Histopathology Ground Truth)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-3 h-3 bg-teal-100 rounded" /> Low
            <span className="w-3 h-3 bg-[#0E9F8E] rounded" /> High Agreement
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-2.5 text-left">Ground Truth \ Pred</th>
                {classLabels.map((c) => (
                  <th key={c} className="p-2.5 font-mono uppercase">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.confusion_matrix.map((row, rIdx) => {
                const label = classLabels[rIdx];
                const meta = DISEASE_CLASSES[label];
                return (
                  <tr key={label} className="border-b border-slate-100">
                    <td className="p-2.5 text-left font-bold text-slate-700 bg-slate-50/50">
                      <span className="font-mono text-slate-400 mr-1.5 uppercase">{label}</span>
                      {meta?.name || label}
                    </td>
                    {row.map((val, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const intensity = Math.min(1, val / 150);
                      const bg = isDiagonal
                        ? `rgba(14, 159, 142, ${Math.max(0.2, intensity)})`
                        : val > 0
                        ? `rgba(244, 63, 94, ${Math.min(0.3, val * 0.05)})`
                        : '#ffffff';
                      return (
                        <td
                          key={cIdx}
                          style={{ backgroundColor: bg }}
                          className={`p-2.5 font-mono font-bold transition ${
                            isDiagonal ? 'text-teal-950 font-extrabold' : val > 0 ? 'text-rose-900' : 'text-slate-300'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Quality Gate Metrics (Rejection Rate, Good, Acceptable, Poor) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0E9F8E]" />
          Pre-Inference Mobile Image Quality Gate Statistics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={qualityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={4}
                >
                  {qualityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 col-span-2">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200">
                <div className="text-[11px] text-teal-800 font-semibold">Good Quality</div>
                <div className="text-lg font-bold font-mono text-teal-900 mt-1">
                  {qStats.passed_good} ({Math.round((qStats.passed_good / qStats.total_screened) * 100)}%)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] text-amber-800 font-semibold">Acceptable (Soft)</div>
                <div className="text-lg font-bold font-mono text-amber-900 mt-1">
                  {qStats.passed_acceptable} ({Math.round((qStats.passed_acceptable / qStats.total_screened) * 100)}%)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-[11px] text-rose-800 font-semibold">Poor (Blocked)</div>
                <div className="text-lg font-bold font-mono text-rose-900 mt-1">
                  {qStats.rejected_poor} ({qStats.rejection_rate}%)
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <strong>Quality Rejection Policy:</strong> Client-side variance of Laplacian (&lt;75), severe underexposure (&lt;45) or overexposure (&gt;225) triggers automated retake blocking. Rejection rate is maintained below 10% to balance safety with user friction.
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-semibold">
            Notice: AI-assisted analysis, not a standalone medical diagnosis.
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Clinical Evaluation Protocol</span>
      </div>
    </div>
  );
};
