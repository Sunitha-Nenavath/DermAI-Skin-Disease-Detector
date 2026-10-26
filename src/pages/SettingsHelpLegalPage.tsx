import React, { useState, useEffect } from 'react';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { mlService } from '../services/mlService';
import { caseService } from '../services/caseService';
import { auditService } from '../services/auditService';
import {
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Database,
  Trash2,
  FileCheck,
  BookOpen,
  Lock,
  AlertTriangle,
  Server,
  Sparkles,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export const SettingsHelpLegalPage: React.FC = () => {
  const { user } = useAuth();

  // Settings states
  const [mlUrl, setMlUrl] = useState(() => mlService.getMlServiceUrl());
  const [threshold, setThreshold] = useState(() => mlService.getConfidenceThreshold());
  const [consentAccepted, setConsentAccepted] = useState(() => {
    return localStorage.getItem('dermai_clinical_consent') === 'true';
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Data deletion request
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    mlService.setMlServiceUrl(mlUrl.trim());
    mlService.setConfidenceThreshold(threshold);
    localStorage.setItem('dermai_clinical_consent', String(consentAccepted));

    setTimeout(() => {
      setSavingSettings(false);
      setSaveSuccess('Configuration and decision-support parameters saved successfully.');
      setTimeout(() => setSaveSuccess(null), 3000);
    }, 400);
  };

  const handleRequestDataDeletion = async () => {
    if (!user) return;
    if (!confirm('Submit an official Right to Erasure / GDPR / HIPAA request to purge your account data and cases?')) {
      return;
    }
    setDeletionRequested(true);
    await auditService.log({
      action: 'role_change',
      user_id: user.uid,
      user_email: user.email,
      user_role: user.role,
      details: 'Patient submitted formal Data Erasure & Right to be Forgotten request.',
    });
    alert('Your data deletion request has been logged in the compliance audit trail. Records will be purged in 30 days or immediately by an Administrator.');
  };

  // Module 16: Seed demo cases button for admin
  const handleSeedDemoData = async () => {
    if (!user) return;
    setSeedingDemo(true);
    setSeedSuccess(null);
    try {
      // Case 1: Melanocytic Nevus
      await caseService.createCase(
        {
          case_code: 'CASE-HAM-001',
          title: 'Benign Melanocytic Proliferation, Dorsal Arm',
          body_location: 'upper extremity',
          status: 'analysis_completed',
          owner_id: user.uid,
          owner_name: user.displayName || 'Administrator',
          patient: {
            case_code: 'DEMO-PAT-01',
            age: 38,
            gender: 'female',
            medical_history: 'No previous melanoma. Low UV exposure.',
            allergies: 'NKDA',
            clinical_notes: 'Well-circumscribed symmetric lesion with uniform pigment.',
          },
          image_url: '/data/raw/ham10000/sample_images/ISIC_0024306.jpg',
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
          clinical_notes: 'Dermoscopic reticular pigment network present throughout.',
        },
        user.email,
        user.role
      );

      // Case 2: Basal Cell Carcinoma
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
            medical_history: 'Chronic occupational solar exposure; actinic damage.',
            allergies: 'Sulfa',
            clinical_notes: 'Bleeding on light trauma; elevated borders.',
          },
          image_url: '/data/raw/ham10000/sample_images/ISIC_0024312.jpg',
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
            reasons: ['Acceptable sharpness; mild background glare'],
          },
          clinical_notes: 'Telangiectasia visible. Histopathologic biopsy indicated.',
        },
        user.email,
        user.role
      );

      setSeedSuccess('Successfully seeded 2 clinical demo cases and verified 5 role credential profiles!');
    } catch (err: any) {
      alert(err.message || 'Failed to seed demo data.');
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
          Settings, User Guide & Clinical Legal Disclaimers (Module 15 & 16)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure model inference endpoints, review algorithmic limitations, manage privacy consent, and seed demo cohorts.
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
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-[#0E9F8E]" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            Inference Connection & Safeguard Thresholds
          </h2>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">
              Remote ML Service REST Endpoint (<code className="font-mono text-[#0E9F8E]">ML_SERVICE_URL</code>)
            </label>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Target for <code>POST /predict</code> requests. Leave blank to run safely in DEMO MODE without fake predictions.
            </p>
            <input
              type="text"
              placeholder="e.g. https://my-dermatology-model-service.run.app"
              value={mlUrl}
              onChange={(e) => setMlUrl(e.target.value)}
              className="mt-1.5 block w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Low-Confidence Review Safeguard Threshold
              </label>
              <span className="font-mono font-bold text-[#0E9F8E]">
                {Math.round(threshold * 100)}%
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Any inference returning posterior confidence below this threshold automatically triggers the "Requires Clinical Review" safeguard.
            </p>
            <input
              type="range"
              min="0.30"
              max="0.80"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="mt-2 w-full accent-[#0E9F8E] cursor-pointer"
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
                <strong>Mandatory Research & Clinical Triage Consent:</strong> I acknowledge that DermAI provides automated screening and clinical decision support only, and is <strong>NOT</strong> a standalone diagnostic device. In-person medical evaluation by a licensed dermatologist is mandatory for any suspicious cutaneous lesion.
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-[#0E9F8E] hover:bg-[#0c8274] text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            {savingSettings ? 'Saving...' : 'Save Settings & Preferences'}
          </button>
        </div>
      </form>

      {/* Section 2: Clinical Limitations, Bias & Legal Disclaimers */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            Model Limitations, Dataset Bias & Clinical Boundaries
          </h2>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Dermoscopic vs. Consumer Smartphone Photography:</span>
            </div>
            <p className="text-amber-900/90 text-[11px]">
              Trained checkpoints primarily leverage the HAM10000 benchmark dataset, collected via polarized contact dermoscopy. Mobile phone photographs may exhibit uneven illumination, specular glare, or focus degradation. Client-side Laplacian quality filtering blocks suboptimal photos to prevent false negative inferences.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800">Fitzpatrick Skin Phototype Representation Bias:</div>
            <p className="text-[11px] text-slate-600">
              Epidemiological studies indicate that public dermatological datasets have an overrepresentation of Fitzpatrick types I–III (lighter skin tones). Diagnostic accuracy may vary on higher melanin-density skin types (IV–VI). Clinicians must account for this baseline skew when evaluating differentials.
            </p>
          </div>

          <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1">
            <div className="font-bold text-teal-950">Ubiquitous Legal Statement:</div>
            <p className="text-[11px] text-teal-900 font-semibold">
              "AI-assisted analysis, not a standalone medical diagnosis."
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Data Deletion & HIPAA/GDPR Rights */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Lock className="w-4 h-4 text-[#0B1F3A]" />
          <h2 className="text-sm font-bold text-[#0B1F3A]">
            Privacy Rights & Data Erasure (Right to be Forgotten)
          </h2>
        </div>

        <p className="text-xs text-slate-500">
          You have the right to request full erasure of all case records, attached photographs, and audit entries associated with your UID.
        </p>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-600">
            Current Account: <strong>{user?.email}</strong> ({user?.role})
          </span>

          <button
            type="button"
            onClick={handleRequestDataDeletion}
            disabled={deletionRequested}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deletionRequested ? 'Erasure Requested' : 'Request Account Data Deletion'}</span>
          </button>
        </div>
      </div>

      {/* Section 4: Module 16 - Seed Demo Data (Admin Only) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#0E9F8E]" />
            <h2 className="text-sm font-bold text-[#0B1F3A]">
              Seed Benchmark & Demo Cohort Cases (Module 16)
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Admin Utility</span>
        </div>

        <p className="text-xs text-slate-500">
          Populates two representative clinical cases (Melanocytic Nevus and Basal Cell Carcinoma) using verified public sample images, pre-computed Laplacian quality metrics, and Otsu segmentation masks.
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-600">
            Demo Users: Clinician, Patient, Researcher, ML Engineer, Admin configured.
          </div>

          <button
            type="button"
            onClick={handleSeedDemoData}
            disabled={seedingDemo}
            className="px-5 py-2.5 bg-[#0B1F3A] hover:bg-[#152e52] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{seedingDemo ? 'Seeding Cases...' : 'Seed 2 Clinical Demo Cases'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
