import React from 'react';
import { Database, ShieldAlert, AlertTriangle, Layers, BarChart2 } from 'lucide-react';

export const EdaViewerPage: React.FC = () => {
  const classes = [
    { code: 'nv', name: 'Melanocytic Nevus', type: 'Benign Mole', count: 6705, pct: 66.95, weight: 0.2134, color: 'bg-blue-500' },
    { code: 'mel', name: 'Melanoma', type: 'Malignant Melanocytic Cancer', count: 1113, pct: 11.11, weight: 1.2855, color: 'bg-rose-600' },
    { code: 'bkl', name: 'Benign Keratosis-like Lesions', type: 'Benign (Solar Lentigo/Seborrheic)', count: 1099, pct: 10.97, weight: 1.3019, color: 'bg-emerald-600' },
    { code: 'bcc', name: 'Basal Cell Carcinoma', type: 'Malignant Epithelial Cancer', count: 514, pct: 5.13, weight: 2.7836, color: 'bg-amber-600' },
    { code: 'akiec', name: 'Actinic Keratosis / Bowen', type: 'Pre-Cancerous / Intraepithelial', count: 327, pct: 3.27, weight: 4.3754, color: 'bg-purple-600' },
    { code: 'vasc', name: 'Vascular Lesions', type: 'Benign Vascular (Angiomas)', count: 142, pct: 1.42, weight: 10.0757, color: 'bg-pink-600' },
    { code: 'df', name: 'Dermatofibroma', type: 'Benign Dermal Nodule', count: 115, pct: 1.15, weight: 12.4413, color: 'bg-teal-600' },
  ];

  const splits = [
    { name: 'Train Set', images: 7014, lesions: 5230, pct: '70.03%', role: 'Model parameter optimization & augmentation' },
    { name: 'Validation Set', images: 1499, lesions: 1120, pct: '14.97%', role: 'Hyperparameter tuning & early stopping checkpointing' },
    { name: 'Test Set', images: 1502, lesions: 1120, pct: '15.00%', role: 'Final uncorrupted benchmark evaluation (Zero Leakage)' },
  ];

  const localizations = [
    { site: 'Back', pct: 21.9 },
    { site: 'Lower Extremity', pct: 20.7 },
    { site: 'Trunk', pct: 14.0 },
    { site: 'Upper Extremity', pct: 11.2 },
    { site: 'Abdomen', pct: 10.2 },
    { site: 'Face', pct: 7.4 },
    { site: 'Chest', pct: 4.1 },
    { site: 'Foot / Hand / Neck / Scalp', pct: 10.5 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
          Dataset Diagnostics · Milestone 1
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
          HAM10000 Dataset & Splitting Diagnostics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Systematic Exploratory Data Analysis of 10,015 clinical dermatoscopy records across 7 diagnostic categories.
        </p>
      </div>

      {/* Critical Leakage Warning Box */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Architectural Safeguard: Lesion ID Leakage Prevention</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          The 10,015 images represent <strong>7,470 unique lesions</strong>. Multiple images exist per lesion (up to 6 photos across different angles and dates). Random train/test splitting leaks identical lesions into test sets, resulting in inflated academic scores. DermAI enforces <strong>Grouped Stratification by lesion_id</strong> (<code>scripts/make_splits.py</code>), mathematically guaranteeing 0 common lesions between train, validation, and test splits.
        </p>
      </div>

      {/* 3-Way Split Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {splits.map((s) => (
          <div key={s.name} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">{s.name}</span>
              <span className="text-xs font-mono font-bold text-teal-700">{s.pct}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#0B1F3A]">{s.images.toLocaleString()} images</div>
            <div className="text-xs font-mono text-slate-500">{s.lesions.toLocaleString()} unique lesions</div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">{s.role}</div>
          </div>
        ))}
      </div>

      {/* Class Distribution Breakdown */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-600" />
              <span>Target Disease Class Distribution & Computed Weights</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Balanced loss weights (w_c) computed to compensate for severe 67% nevus class imbalance
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">10,015 Total Records</span>
        </div>

        <div className="space-y-4">
          {classes.map((c) => (
            <div key={c.code} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 w-12">{c.code}</span>
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="text-slate-400 text-[11px]">({c.type})</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-slate-600">{c.count.toLocaleString()} imgs ({c.pct}%)</span>
                  <span className="text-teal-700 font-semibold w-24 text-right">w = {c.weight.toFixed(4)}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anatomical Locations & Demographics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#0B1F3A]">Lesion Anatomical Site Distribution</h3>
          <div className="space-y-2.5 text-xs">
            {localizations.map((loc) => (
              <div key={loc.site} className="flex items-center justify-between">
                <span className="text-slate-700">{loc.site}</span>
                <span className="font-mono text-slate-600">{loc.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#0B1F3A]">Clinical Demographics</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Biological Sex</span>
              <span className="font-semibold text-slate-800">54.0% Male · 45.5% Female · 0.5% Unknown</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Patient Age Range</span>
              <span className="font-semibold text-slate-800">Mean 51.9 yrs (Min: 0, Max: 85, SD: 17.0)</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Ground Truth Verification</span>
              <span className="font-semibold text-slate-800">53.3% Histopathology (Biopsy)</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Benchmark Dimensions</span>
              <span className="font-mono text-slate-800">600 x 450 px (24-bit sRGB)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
