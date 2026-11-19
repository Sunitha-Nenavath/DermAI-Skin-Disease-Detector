import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMlStatus } from '../context/MlStatusContext';
import { useToast } from '../context/ToastContext';
import { mlService } from '../services/mlService';
import { caseService } from '../services/caseService';
import { analysisService } from '../services/analysisService';
import { auditService } from '../services/auditService';
import {
  ShieldAlert,
  Sliders,
  Database,
  Trash2,
  BookOpen,
  Lock,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const SettingsHelpLegalPage: React.FC = () => {
  const { user } = useAuth();
  const { status: mlStatus, refreshStatus } = useMlStatus();
  const { showToast } = useToast();

  // Settings states
  const [mlUrl, setMlUrl] = useState(() => mlService.getMlServiceUrl());
  const [threshold, setThreshold] = useState(() => mlService.getConfidenceThreshold());
  const [consentAccepted, setConsentAccepted] = useState(() => {
    return localStorage.getItem('dermai_clinical_consent') === 'true';
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Data deletion inline confirmation (no window.confirm/alert)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  // Seed demo data
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  const canConfigureThreshold = user?.role === 'admin' || user?.role === 'ml_engineer';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(null);
    try {
      mlService.setMlServiceUrl(mlUrl.trim());
      if (canConfigureThreshold) {
        await mlService.setConfidenceThreshold(threshold);
      }
      localStorage.setItem('dermai_clinical_consent', String(consentAccepted));
      await refreshStatus();

      const msg = 'Configuration saved and live ML endpoint connectivity checked.';
      setSaveSuccess(msg);
      showToast({
        title: 'Settings Updated',
        message: msg,
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Save Error',
        message: err.message || 'Failed to save configuration.',
        level: 'Medium',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmDataDeletion = async () => {
    if (!user) return;
    setDeletionRequested(true);
    setConfirmingDeletion(false);
    await auditService.log({
      action: 'role_change',
      user_id: user.uid,
      user_email: user.email,
      user_role: user.role,
      details: 'User submitted formal Data Erasure & Right to be Forgotten request.',
    });
    showToast({
      title: 'Data Deletion Request Logged',
      message: 'Your erasure request is recorded in the compliance audit log for admin processing.',
      level: 'Informational',
    });
  };

  // Module 16: Seed 2 demo cases using real HAM10000 sample images + historical analyses timeline
  const handleSeedDemoData = async () => {
    if (!user || user.role !== 'admin') return;
    setSeedingDemo(true);
    setSeedSuccess(null);
    try {
      const case1 = await caseService.createCase(
        {
          case_code: 'CASE-HAM-001',
          title: 'Pigmented Macule Follow-Up, Dorsal Forearm',
          body_location: 'upper extremity',
          status: 'quality_passed',
          owner_id: user.uid,
          owner_name: user.displayName || 'Administrator',
          patient: {
            case_code: 'DEMO-PAT-01',
            age: 38,
            gender: 'female',
            medical_history: 'Routine skin screening cohort; low UV history.',
            allergies: 'NKDA',
            clinical_notes: 'Symmetric pigmented lesion monitored for baseline changes.',
          },
          image_url: '/sample_images/nv_sample_1.jpg',
          quality_label: 'Good',
          quality_metrics: {
            passed: true,
            quality_label: 'Good',
            blur_laplacian: 182,
            mean_brightness: 139,
            contrast_std: 46,
            width: 600,
            height: 450,
            center_contrast_ratio: 16.5,
            reasons: ['Optimal focus and illumination'],
          },
          clinical_notes: 'Baseline image captured using HAM10000 public reference sample.',
        },
        user.email,
        user.role
      );

      // Add two longitudinal baseline entries for Module 12 Previous vs New comparison
      await analysisService.recordAnalysis({
        case_id: case1.id,
        owner_id: user.uid,
        image_url: '/sample_images/nv_sample_2.jpg',
        model_version: 'Classical CV Baseline',
        predicted_label: 'demo_baseline',
        predicted_name: 'Classical CV Baseline (No ML Connected)',
        confidence: 0,
        risk_tag: 'Requires Clinical Review',
        is_demo_mode: true,
        latency_ms: 14,
        quality_label: 'Good',
      });

      await analysisService.recordAnalysis({
        case_id: case1.id,
        owner_id: user.uid,
        image_url: '/sample_images/nv_sample_1.jpg',
        model_version: 'Classical CV Baseline',
        predicted_label: 'demo_baseline',
        predicted_name: 'Classical CV Baseline (No ML Connected)',
        confidence: 0,
        risk_tag: 'Requires Clinical Review',
        is_demo_mode: true,
        latency_ms: 12,
        quality_label: 'Good',
      });

      await caseService.createCase(
        {
          case_code: 'CASE-HAM-002',
          title: 'Translucent Pearly Papule, Left Malar Region',
          body_location: 'face',
          status: 'requires_clinical_review',
          owner_id: user.uid,
          owner_name: user.displayName || 'Administrator',
          patient: {
            case_code: 'DEMO-PAT-02',
            age: 62,
            gender: 'male',
            medical_history: 'Chronic outdoor solar exposure; actinic history.',
            allergies: 'Sulfa',
            clinical_notes: 'Elevated pearly border noted for specialist evaluation.',
          },
          image_url: '/sample_images/bcc_sample_1.jpg',
          quality_label: 'Acceptable',
          quality_metrics: {
            passed: true,
            quality_label: 'Acceptable',
            blur_laplacian: 118,
            mean_brightness: 154,
            contrast_std: 38,
            width: 600,
            height: 450,
            center_contrast_ratio: 11.2,
            reasons: ['Acceptable sharpness; mild specular glare'],
          },
          clinical_notes: 'Flagged for dermatology evaluation using public HAM10000 sample image.',
        },
        user.email,
        user.role
      );

      const msg = 'Seeded 2 clinical demo cases with public sample images and longitudinal baseline history.';
      setSeedSuccess(msg);
      showToast({
        title: 'Demo Cases Created',
        message: msg,
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Seed Failed',
        message: err.message || 'Unable to seed demo cases.',
        level: 'Medium',
      });
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
          Settings, User Guide & Clinical Legal Disclaimers
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure remote PyTorch ML endpoints, review screening guidance and limitations, manage consent, and seed demo cases.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {seedSuccess && (
        <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span>{seedSuccess}</span>
        </div>
      )}

      {/* Section 1: ML Service Endpoint & Safeguard Settings */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0E9F8E]" />
            <h2 className="text-sm font-bold text-[#0B1F3A]">
              ML Inference Endpoint & Safeguard Thresholds
            </h2>
          </div>
          <span
            className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
              mlStatus.connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {mlStatus.connected ? 'Live ML Connected' : 'Demo Mode Active'}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">
              Remote ML Service URL (<code className="font-mono text-[#0E9F8E]">ML_SERVICE_URL</code> override)
            </label>
            <p className="text-slate-400 text-[11px] mt-0.5">
              FastAPI PyTorch inference endpoint from <code className="font-mono">ml/serve.py</code>. Leave blank to operate safely in DEMO MODE (real CV quality + classical Otsu segmentation without model predictions).
            </p>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                placeholder="e.g. https://dermai-ml-service-xxxx.run.app"
                value={mlUrl}
                onChange={(e) => setMlUrl(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E]"
              />
              <button
                type="button"
                onClick={refreshStatus}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Probe</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{mlStatus.message}</p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Low-Confidence Review Safeguard Threshold
                {!canConfigureThreshold && ' (Admin / ML Engineer Editable)'}
              </label>
              <span className="font-mono font-bold text-[#0E9F8E]">
                {Math.round(threshold * 100)}%
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Predictions with top-1 probability below this threshold automatically flag the case as "Requires Clinical Review".
            </p>
            <input
              type="range"
              min="0.30"
              max="0.80"
              step="0.05"
              value={threshold}
              disabled={!canConfigureThreshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="mt-2 w-full accent-[#0E9F8E] cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Clinical Consent Checkbox */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#0E9F8E]"
              />
              <span className="text-slate-700">
                <strong>Mandatory Screening & Decision-Support Consent:</strong> I acknowledge that DermAI provides AI-assisted analysis, not a standalone medical diagnosis. In-person clinical evaluation by a licensed dermatologist is required for any concerning lesion.
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-[#0E9F8E] hover:bg-[#0c8274] text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {savingSettings ? 'Saving & Probing...' : 'Save Settings & Probe ML'}
          </button>
        </div>
      </form>

      {/* Section 2: Module 15 User Guide */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <BookOpen className="w-4 h-4 text-[#0E9F8E]" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            User Guide: Mobile Screening & 6-Stage Pipeline
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="font-bold text-[#0B1F3A]">1. Capture & Quality Gate</div>
            <p className="text-[11px] leading-relaxed">
              Use the rear camera guide frame in bright, diffuse indoor lighting without harsh flash glare. Client-side Laplacian focus (&ge;75), brightness, and contrast checks block blurry images automatically.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="font-bold text-[#0B1F3A]">2. Crop, CLAHE & Segmentation</div>
            <p className="text-[11px] leading-relaxed">
              Interactive crop & 90° rotation prepare a 224×224 normalized tensor alongside CLAHE contrast preview and Otsu classical lesion segmentation (ROI & boundary overlay).
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="font-bold text-[#0B1F3A]">3. Review, XAI & Reports</div>
            <p className="text-[11px] leading-relaxed">
              Inspect Grad-CAM heatmaps with the opacity slider, compare follow-up images side by side over time, and download PDF, JSON, or CSV summaries for clinical consultation.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Clinical Limitations, Bias & Legal Disclaimers */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            Model Limitations, Dataset Bias & Privacy Notice
          </h2>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Dermoscopic vs. Consumer Smartphone Photography:</span>
            </div>
            <p className="text-amber-900/90 text-[11px]">
              HAM10000 benchmark weights are trained on polarized contact dermoscopy images. Unpolarized smartphone cameras exhibit perspective distortion, shadows, and ambient color shifts that reduce accuracy outside controlled imaging conditions.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800">Fitzpatrick Skin Phototype & Dataset Bias:</div>
            <p className="text-[11px] text-slate-600">
              Public HAM10000 data predominantly represents Fitzpatrick skin types I–III and contains 67% benign melanocytic nevi. Performance may degrade on darker skin tones (Fitzpatrick IV–VI) and rare non-pigmented lesions.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800">Privacy & De-Identification Policy:</div>
            <p className="text-[11px] text-slate-600">
              Only de-identified case codes and demo/public records should be entered. Do not upload real patient names, government IDs, or unprotected personally identifiable health information.
            </p>
          </div>

          <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1">
            <div className="font-bold text-teal-950">Mandatory Notice:</div>
            <p className="text-[11px] text-teal-900 font-semibold">
              AI-assisted analysis, not a standalone medical diagnosis.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Data Deletion & Privacy Rights */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Lock className="w-4 h-4 text-[#0B1F3A]" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            Privacy Rights & Data Erasure Request
          </h2>
        </div>

        <p className="text-xs text-slate-500">
          You may submit a formal erasure request for all case records, uploaded photographs, and account metadata linked to your UID.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-600">
            Account: <strong>{user?.email}</strong> ({user?.role})
          </span>

          {!confirmingDeletion ? (
            <button
              type="button"
              onClick={() => setConfirmingDeletion(true)}
              disabled={deletionRequested}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deletionRequested ? 'Erasure Request Logged' : 'Request Account Data Deletion'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-700 font-medium">Confirm erasure request?</span>
              <button
                type="button"
                onClick={handleConfirmDataDeletion}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Submit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDeletion(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Module 16 - Seed Demo Data (Admin Only) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#0E9F8E]" />
            <h2 className="text-sm font-bold text-[#0B1F3A]">
              Seed Benchmark & Demo Cohort Cases (Module 16)
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Admin Only</span>
        </div>

        <p className="text-xs text-slate-500">
          Populates two representative clinical cases using verified HAM10000 public sample images (<code className="font-mono">/sample_images/nv_sample_1.jpg</code> and <code className="font-mono">bcc_sample_1.jpg</code>) along with longitudinal baseline history for Module 12 comparison.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-600">
            5 role profiles supported (`patient`, `clinician`, `researcher`, `ml_engineer`, `admin`).
          </div>

          {user?.role === 'admin' ? (
            <button
              type="button"
              onClick={handleSeedDemoData}
              disabled={seedingDemo}
              className="px-5 py-2.5 bg-[#0B1F3A] hover:bg-[#152e52] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>{seedingDemo ? 'Seeding Cases...' : 'Seed 2 Clinical Demo Cases'}</span>
            </button>
          ) : (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 font-medium">
              Switch to Administrator role to seed cases
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
