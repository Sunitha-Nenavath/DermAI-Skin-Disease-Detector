import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { modelService } from '../services/modelService';
import type { ModelVersionRecord } from '../types';
import {
  Cpu,
  CheckCircle2,
  RotateCcw,
  Plus,
  Scale,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const ModelManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [models, setModels] = useState<ModelVersionRecord[]>(() => modelService.getModels());
  const [activeVersion, setActiveVersion] = useState<string>(() => modelService.getActiveVersion());

  // Comparison picker
  const [compVersionA, setCompVersionA] = useState<string>(models[0]?.version || '');
  const [compVersionB, setCompVersionB] = useState<string>(models[1]?.version || '');

  // Register new model form modal/state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newName, setNewName] = useState('');
  const [newArch, setNewArch] = useState('Swin Transformer Tiny');
  const [newDataset, setNewDataset] = useState('HAM10000-v2.1-Extended');
  const [newAccuracy, setNewAccuracy] = useState('0.925');
  const [newF1, setNewF1] = useState('0.895');

  const handleSetActive = (version: string) => {
    modelService.setActiveVersion(version);
    setActiveVersion(version);
    setModels(modelService.getModels());
  };

  const handleRollback = (version: string) => {
    if (!confirm(`Are you sure you want to rollback production deployment to ${version}?`)) return;
    modelService.rollbackToVersion(version);
    setActiveVersion(version);
    setModels(modelService.getModels());
  };

  const handleRegisterModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion || !newName) return;

    const acc = parseFloat(newAccuracy) || 0.90;
    const f1 = parseFloat(newF1) || 0.88;

    const record: ModelVersionRecord = {
      version: newVersion,
      name: newName,
      architecture: newArch,
      dataset_version: newDataset,
      metrics: {
        accuracy: acc,
        balanced_accuracy: acc - 0.02,
        macro_precision: acc - 0.03,
        macro_recall: acc - 0.02,
        macro_f1: f1,
        sensitivity: acc - 0.01,
        specificity: acc + 0.03,
        auc_roc: Math.min(0.99, acc + 0.05),
        mcc: acc - 0.09,
      },
      status: 'inactive',
      created_at: new Date().toISOString(),
    };

    modelService.registerNewVersion(record);
    setModels(modelService.getModels());
    setShowAddModal(false);
    setNewVersion('');
    setNewName('');
  };

  const modelA = models.find((m) => m.version === compVersionA) || models[0];
  const modelB = models.find((m) => m.version === compVersionB) || models[1];

  const isAuthorized = user?.role === 'ml_engineer' || user?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
              Deep Learning Model Version Registry (Module 9)
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {models.length} Model Checkpoints
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage production neural network weights, swap inference models, verify rollbacks, and compare ROC-AUC metrics.
          </p>
        </div>

        {isAuthorized && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white shadow-xs transition whitespace-nowrap active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Model</span>
          </button>
        )}
      </div>

      {/* Role Protection Banner if viewed by patient/clinician */}
      {!isAuthorized && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Read-Only Governance Mode:</strong> Model deployment changes and rollback authorizations require an ML Engineer or Administrator role. Switch your active role in the top-right menu to test management actions.
          </div>
        </div>
      )}

      {/* Active Production Model Card */}
      <div className="bg-gradient-to-r from-[#0B1F3A] to-[#0d2a52] text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
              Active Production Model
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight">{activeVersion}</div>
          <p className="text-xs text-slate-300">
            Selected checkpoint sent via <code className="bg-black/40 px-2 py-0.5 rounded font-mono text-[#00F0FF]">X-Model-Version</code> header to REST inference service.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xs px-5 py-3 rounded-xl border border-white/10">
          <div className="text-center">
            <div className="text-[10px] uppercase text-slate-300">Top-1 Accuracy</div>
            <div className="text-xl font-bold font-mono text-emerald-300">
              {Math.round((models.find((m) => m.version === activeVersion)?.metrics.accuracy || 0.912) * 100)}%
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <div className="text-[10px] uppercase text-slate-300">Macro F1</div>
            <div className="text-xl font-bold font-mono text-teal-300">
              {Math.round((models.find((m) => m.version === activeVersion)?.metrics.macro_f1 || 0.881) * 100)}%
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <div className="text-[10px] uppercase text-slate-300">AUC-ROC</div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              {(models.find((m) => m.version === activeVersion)?.metrics.auc_roc || 0.968).toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {/* Model Versions Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0E9F8E]" />
            Registered Architecture Checkpoints
          </h2>
          <span className="text-xs text-slate-400">ISIC 7-Class Evaluated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Version & Name</th>
                <th className="px-4 py-3">Neural Architecture</th>
                <th className="px-4 py-3">Dataset Version</th>
                <th className="px-4 py-3 font-mono">Accuracy</th>
                <th className="px-4 py-3 font-mono">Macro F1</th>
                <th className="px-4 py-3 font-mono">AUC-ROC</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => {
                const isActive = m.version === activeVersion;
                return (
                  <tr key={m.version} className={`hover:bg-slate-50/70 transition ${isActive ? 'bg-teal-50/40' : ''}`}>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#0B1F3A]">{m.version}</div>
                      <div className="text-[11px] text-slate-500">{m.name}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{m.architecture}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">{m.dataset_version}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-[#0B1F3A]">
                      {(m.metrics.accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700">
                      {(m.metrics.macro_f1 * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-emerald-700 font-semibold">
                      {m.metrics.auc_roc.toFixed(3)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : m.status === 'rollback'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isActive ? 'Active Serving' : m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {!isActive && isAuthorized && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSetActive(m.version)}
                            className="px-3 py-1 bg-[#0E9F8E] hover:bg-[#0c8274] text-white rounded-lg text-xs font-semibold shadow-xs transition"
                          >
                            Set Active
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRollback(m.version)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Rollback deployment"
                          >
                            <RotateCcw className="w-3.5 h-3.5 inline" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Model Comparison Tool */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#0E9F8E]" />
            <h2 className="text-sm font-bold text-[#0B1F3A]">
              Bilateral Checkpoint Comparison Tool
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Model A:</span>
              <select
                value={compVersionA}
                onChange={(e) => setCompVersionA(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                {models.map((m) => (
                  <option key={m.version} value={m.version}>
                    {m.version}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-300 font-bold">vs</span>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Model B:</span>
              <select
                value={compVersionB}
                onChange={(e) => setCompVersionB(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                {models.map((m) => (
                  <option key={m.version} value={m.version}>
                    {m.version}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Comparison Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Accuracy', key: 'accuracy', format: (v: number) => `${(v * 100).toFixed(1)}%` },
            { label: 'Macro F1', key: 'macro_f1', format: (v: number) => `${(v * 100).toFixed(1)}%` },
            { label: 'Sensitivity', key: 'sensitivity', format: (v: number) => `${(v * 100).toFixed(1)}%` },
            { label: 'AUC-ROC', key: 'auc_roc', format: (v: number) => v.toFixed(3) },
          ].map((metric) => {
            const valA = (modelA.metrics as any)[metric.key];
            const valB = (modelB.metrics as any)[metric.key];
            const delta = Number((valB - valA).toFixed(3));
            return (
              <div key={metric.key} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{metric.label}</div>
                <div className="flex justify-between items-baseline text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Model A</span>
                    <strong className="font-mono text-sm text-slate-800">{metric.format(valA)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Model B</span>
                    <strong className="font-mono text-sm text-[#0E9F8E]">{metric.format(valB)}</strong>
                  </div>
                </div>
                <div className={`text-[10px] font-semibold text-right ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Δ: {delta >= 0 ? `+${delta}` : delta}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Register Model Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5">
            <h3 className="text-sm font-bold text-[#0B1F3A]">Register New Model Version</h3>
            <form onSubmit={handleRegisterModel} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Model Version String *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v3.1 Swin Transformer"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Checkpoint Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DermAI-Swin-Tiny-224"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Architecture</label>
                  <input
                    type="text"
                    value={newArch}
                    onChange={(e) => setNewArch(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Dataset Version</label>
                  <input
                    type="text"
                    value={newDataset}
                    onChange={(e) => setNewDataset(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Validation Accuracy</label>
                  <input
                    type="text"
                    value={newAccuracy}
                    onChange={(e) => setNewAccuracy(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Macro F1 Score</label>
                  <input
                    type="text"
                    value={newF1}
                    onChange={(e) => setNewF1(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0E9F8E] hover:bg-[#0c8274] text-white rounded-lg font-semibold"
                >
                  Save Model Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Disclaimer */}
      <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-semibold">
            Notice: AI-assisted analysis, not a standalone medical diagnosis.
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Model Deployment Governance</span>
      </div>
    </div>
  );
};
