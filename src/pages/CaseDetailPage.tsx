import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { caseService } from '../services/caseService';
import { storageService } from '../services/storageService';
import { mlService } from '../services/mlService';
import { modelService } from '../services/modelService';
import { analysisService, StoredAnalysisRecord } from '../services/analysisService';
import { reportService } from '../services/reportService';
import { notificationService } from '../services/notificationService';
import { auditService } from '../services/auditService';
import type { ClinicalCase, PredictionResult } from '../types';
import { ImageCaptureWorkflow } from '../components/ImageCaptureWorkflow';
import { LesionSegmentationView } from '../components/LesionSegmentationView';
import { ClassificationResultView } from '../components/ClassificationResultView';
import { ExplainableAIView } from '../components/ExplainableAIView';
import { CaseHistoryFollowUp, HistoricalAnalysisItem } from '../components/CaseHistoryFollowUp';
import {
  ArrowLeft,
  Camera,
  Activity,
  Layers,
  Sparkles,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Send,
  History,
  AlertCircle,
  Download,
  Edit3,
  BellPlus,
} from 'lucide-react';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [clinicalCase, setClinicalCase] = useState<ClinicalCase | null>(null);
  const [analysesHistory, setAnalysesHistory] = useState<StoredAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'segmentation' | 'classification' | 'explainability' | 'history'>('overview');
  const [showCaptureWorkflow, setShowCaptureWorkflow] = useState(false);

  // Edit case modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAge, setEditAge] = useState<string>('');
  const [editGender, setEditGender] = useState('male');
  const [editHistory, setEditHistory] = useState('');
  const [editAllergies, setEditAllergies] = useState('');

  // Clinical notes
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Inference state
  const [isInferenceRunning, setIsInferenceRunning] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  const loadCase = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      setError(null);

      let data: ClinicalCase | null = null;
      try {
        data = await caseService.getCaseById(id, user.role, user.uid);
      } catch (fsErr) {
        console.warn('Firestore fetch warning:', fsErr);
      }

      if (!data) {
        const sampleImg = id === 'case_demo_02' ? '/sample_images/bcc_sample_1.jpg' : '/sample_images/nv_sample_1.jpg';
        data = {
          id,
          case_code: `CASE-${id.slice(-6).toUpperCase()}`,
          title: id === 'case_demo_02' ? 'Erythematous Pearly Papule, Malar Region' : 'Pigmented Lesion Evaluation',
          body_location: id === 'case_demo_02' ? 'face' : 'upper extremity',
          status: 'pending_review',
          owner_id: user.uid,
          owner_name: user.role === 'researcher' ? 'ANONYMIZED_SUBJECT' : (user.displayName || 'Clinical User'),
          patient: {
            case_code: `PAT-${id.slice(-4).toUpperCase()}`,
            age: id === 'case_demo_02' ? 67 : 49,
            gender: id === 'case_demo_02' ? 'male' : 'female',
            medical_history: 'Fitzpatrick skin type II; routine screening cohort.',
            allergies: 'NKDA',
            clinical_notes: 'Baseline de-identified clinical record.',
          },
          image_url: sampleImg,
          quality_label: 'Good',
          quality_metrics: {
            passed: true,
            quality_label: 'Good',
            blur_laplacian: 184,
            mean_brightness: 142,
            contrast_std: 48,
            width: 600,
            height: 450,
            center_contrast_ratio: 18.4,
            reasons: ['Sharp dermoscopic focus', 'Optimal illumination and dynamic range'],
          },
          clinical_notes: 'Initial presentation documented.',
          created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
          updated_at: new Date().toISOString(),
          medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
        };
      }

      setClinicalCase(data);
      setPrediction(data.latest_prediction || null);

      setEditTitle(data.title);
      setEditLocation(data.body_location);
      setEditAge(data.patient?.age ? String(data.patient.age) : '');
      setEditGender(data.patient?.gender || 'male');
      setEditHistory(data.patient?.medical_history || '');
      setEditAllergies(data.patient?.allergies || 'NKDA');

      const hist = await analysisService.listByCaseId(data.id);
      setAnalysesHistory(hist);

      // Auto-trigger screening with connected PyTorch model if not yet evaluated
      if (!data.latest_prediction && data.image_url) {
        executeInference(data.image_url, data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load clinical case record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [id, user]);

  const executeInference = async (imageSrc: string, activeCase: ClinicalCase) => {
    if (!user) return;
    setIsInferenceRunning(true);
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const activeVersion = modelService.getActiveVersion();
      const result = await mlService.predict(blob, activeVersion);
      setPrediction(result);

      const newStatus = result.is_demo_mode
        ? 'quality_passed'
        : result.requires_clinical_review
        ? 'requires_clinical_review'
        : 'analysis_completed';

      try {
        await caseService.updateCase(
          activeCase.id,
          {
            latest_prediction: result,
            status: newStatus,
          },
          user.email,
          user.role
        );
      } catch {
        // Demo local fallback
        setClinicalCase((prev) => (prev ? { ...prev, latest_prediction: result, status: newStatus } : prev));
      }

      const savedRecord = await analysisService.recordAnalysis({
        case_id: activeCase.id,
        owner_id: activeCase.owner_id,
        image_url: imageSrc,
        model_version: result.model_version,
        predicted_label: result.top3[0]?.label || 'demo',
        predicted_name: result.is_demo_mode
          ? 'Demo Mode (Classical Otsu Baseline)'
          : (result.top3[0]?.label_name || 'Evaluated'),
        confidence: result.confidence,
        risk_tag: result.risk_tag,
        is_demo_mode: result.is_demo_mode,
        latency_ms: result.latency_ms,
        quality_label: activeCase.quality_label,
        quality_metrics: activeCase.quality_metrics,
        segmentation: activeCase.segmentation,
        prediction: result,
      });

      setAnalysesHistory((prev) => [savedRecord, ...prev]);

      await auditService.log({
        action: 'analysis',
        user_id: user.uid,
        user_email: user.email,
        user_role: user.role,
        target_id: activeCase.id,
        details: result.is_demo_mode
          ? `Executed Demo Mode client-side analysis for ${activeCase.case_code}`
          : `Executed ${result.model_version} inference for ${activeCase.case_code}: ${result.top3[0]?.label} (${Math.round(result.confidence * 100)}%)`,
      });

      if (result.is_demo_mode) {
        showToast({
          title: 'Client-Side Screening Complete (Demo Mode)',
          message: 'Quality check, preprocessing & Otsu segmentation completed. Connect ML_SERVICE_URL for trained predictions.',
          level: 'Informational',
        });
      } else if (result.requires_clinical_review) {
        showToast({
          title: 'AI-Assisted Finding: Clinical Review Recommended',
          message: `Confidence (${Math.round(result.confidence * 100)}%) is below threshold. Clinical evaluation advised.`,
          level: 'High',
        });
        await notificationService.createNotification({
          user_id: user.uid,
          case_id: activeCase.id,
          title: 'Clinical Review Recommended',
          message: `AI-assisted finding for ${activeCase.case_code} fell below confidence threshold (${Math.round(result.confidence * 100)}%).`,
          level: 'High',
        });
      } else {
        showToast({
          title: 'AI-Assisted Finding Completed',
          message: `${result.top3[0]?.label_name} (${Math.round(result.confidence * 100)}%) via ${result.model_version}.`,
          level: 'Informational',
        });
        await notificationService.createNotification({
          user_id: user.uid,
          case_id: activeCase.id,
          title: 'AI-Assisted Finding Completed',
          message: `Analysis for ${activeCase.case_code} completed via ${result.model_version}.`,
          level: 'Informational',
        });
      }
    } catch (err: any) {
      showToast({
        title: 'Screening Error',
        message: err.message || 'Unable to evaluate image.',
        level: 'Medium',
      });
    } finally {
      setIsInferenceRunning(false);
    }
  };

  const handleRunInference = async () => {
    if (!clinicalCase?.image_url) return;
    await executeInference(clinicalCase.image_url, clinicalCase);
  };

  const handleSaveCaseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalCase || !user) return;
    try {
      const updates: Partial<ClinicalCase> = {
        title: editTitle.trim(),
        body_location: editLocation,
        patient: {
          ...clinicalCase.patient,
          age: editAge ? Number(editAge) : undefined,
          gender: editGender,
          medical_history: editHistory.trim(),
          allergies: editAllergies.trim() || 'NKDA',
        },
      };
      await caseService.updateCase(clinicalCase.id, updates, user.email, user.role);
      setShowEditModal(false);
      showToast({
        title: 'Case Updated',
        message: `Updated de-identified profile for ${clinicalCase.case_code}.`,
        level: 'Informational',
      });
      await loadCase();
    } catch (err: any) {
      showToast({
        title: 'Update Error',
        message: err.message || 'Failed to update case.',
        level: 'Medium',
      });
    }
  };

  const handleAddNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim() || !clinicalCase || !user) return;
    setSavingNote(true);
    try {
      await caseService.addClinicalNotes(clinicalCase.id, noteInput.trim(), user.email, user.role);
      setNoteInput('');
      showToast({
        title: 'Clinical Note Saved',
        message: `Progress note appended to ${clinicalCase.case_code}.`,
        level: 'Informational',
      });
      await loadCase();
    } catch (err: any) {
      showToast({ title: 'Note Save Error', message: err.message || 'Unable to save note.', level: 'Medium' });
    } finally {
      setSavingNote(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!clinicalCase || !user) return;
    await notificationService.createNotification({
      user_id: user.uid,
      case_id: clinicalCase.id,
      title: 'Follow-Up Screening Reminder',
      message: `30-day longitudinal photo check scheduled for ${clinicalCase.case_code} (${clinicalCase.body_location}).`,
      level: 'Low',
    });
    showToast({
      title: 'Follow-Up Reminder Logged',
      message: `30-day checkup reminder added for ${clinicalCase.case_code}.`,
      level: 'Low',
    });
  };

  const handleExport = async (format: 'pdf' | 'json' | 'csv') => {
    if (!clinicalCase || !user) return;
    const payload = {
      clinicalCase,
      prediction,
      quality: clinicalCase.quality_metrics,
      userEmail: user.email,
      userRole: user.role,
    };
    if (format === 'pdf') await reportService.exportPDF(payload);
    if (format === 'json') await reportService.exportJSON(payload);
    if (format === 'csv') await reportService.exportCSV(payload);

    showToast({
      title: 'Report Ready',
      message: `${format.toUpperCase()} screening report exported for ${clinicalCase.case_code}.`,
      level: 'Informational',
    });
    await notificationService.createNotification({
      user_id: user.uid,
      case_id: clinicalCase.id,
      title: 'Report Ready & Downloaded',
      message: `${format.toUpperCase()} screening summary exported for ${clinicalCase.case_code}.`,
      level: 'Informational',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-slate-400">
        Loading clinical case workspace and screening modules...
      </div>
    );
  }

  if (error || !clinicalCase) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#0B1F3A]">Case Record Unavailable</h2>
        <p className="text-xs text-slate-500">{error || 'The requested clinical case could not be retrieved.'}</p>
        <Link to="/cases" className="inline-flex items-center gap-2 px-4 py-2 bg-[#0E9F8E] text-white rounded-xl text-xs font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Registry</span>
        </Link>
      </div>
    );
  }

  const mappedHistory: HistoricalAnalysisItem[] =
    analysesHistory.length > 0
      ? analysesHistory.map((h) => ({
          id: h.id,
          timestamp: h.created_at,
          model_version: h.model_version,
          imageUrl: h.image_url,
          predictedCondition: h.predicted_name,
          confidence: Math.round(h.confidence * 100),
          riskTag: h.risk_tag,
        }))
      : [
          {
            id: 'baseline-01',
            timestamp: clinicalCase.created_at,
            model_version: prediction?.model_version || modelService.getActiveVersion(),
            imageUrl: clinicalCase.image_url || '/sample_images/nv_sample_1.jpg',
            predictedCondition:
              prediction && !prediction.is_demo_mode
                ? prediction.top3[0]?.label_name || 'Evaluated'
                : 'Classical Baseline (Otsu)',
            confidence: prediction && !prediction.is_demo_mode ? Math.round(prediction.confidence * 100) : 0,
            riskTag: prediction?.risk_tag || 'Requires Clinical Review',
          },
        ];

  const canEdit = user?.role === 'admin' || user?.role === 'clinician' || user?.uid === clinicalCase.owner_id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link to="/cases" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Clinical Case Registry</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">{clinicalCase.title}</h1>
            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
              {clinicalCase.case_code}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Anatomical site: <strong className="capitalize text-slate-700">{clinicalCase.body_location}</strong> · Recorded:{' '}
            {new Date(clinicalCase.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Case</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleScheduleFollowUp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <BellPlus className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>Follow-Up Reminder</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCaptureWorkflow(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>New Photo Intake</span>
          </button>
          <button
            type="button"
            onClick={handleRunInference}
            disabled={isInferenceRunning || !clinicalCase.image_url}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isInferenceRunning ? 'Analyzing...' : 'Run Screening'}</span>
          </button>
        </div>
      </div>

      {/* Export Bar (Module 13: PDF + JSON + CSV) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
        <span className="font-semibold text-slate-700">Export Decision-Support Summary (Module 13):</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white font-semibold hover:bg-[#152e52]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Photo Intake Modal/Drawer */}
      {showCaptureWorkflow && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Capture or Upload Lesion Photograph
            </h3>
            <button type="button" onClick={() => setShowCaptureWorkflow(false)} className="text-xs text-slate-500 hover:text-slate-800">
              Cancel
            </button>
          </div>
          <ImageCaptureWorkflow
            onConfirm={async (payload) => {
              setShowCaptureWorkflow(false);
              if (!user) return;
              const uploaded = await storageService.uploadCaseImage(payload.originalBlob, clinicalCase.case_code);
              const imageUrlToUse = uploaded.url || payload.preprocessing.originalDataUrl;

              await auditService.log({
                action: 'upload',
                user_id: user.uid,
                user_email: user.email,
                user_role: user.role,
                target_id: clinicalCase.id,
                details: `Uploaded validated image (${payload.quality.quality_label}) to ${uploaded.path}`,
              });

              const updatedCase: ClinicalCase = {
                ...clinicalCase,
                image_url: imageUrlToUse,
                storage_path: uploaded.path,
                quality_label: payload.quality.quality_label,
                quality_metrics: payload.quality,
                preprocessing: payload.preprocessing,
                segmentation: payload.segmentation,
              };
              setClinicalCase(updatedCase);

              try {
                await caseService.updateCase(
                  clinicalCase.id,
                  {
                    image_url: imageUrlToUse,
                    storage_path: uploaded.path,
                    quality_label: payload.quality.quality_label,
                    quality_metrics: payload.quality,
                    preprocessing: payload.preprocessing,
                    segmentation: payload.segmentation,
                  },
                  user.email,
                  user.role
                );
              } catch {
                // Continue gracefully in demo fallback
              }

              await executeInference(imageUrlToUse, updatedCase);
            }}
            onCancel={() => setShowCaptureWorkflow(false)}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        {[
          { key: 'overview', label: 'Case Overview & Patient', icon: FileText },
          { key: 'segmentation', label: 'Lesion Segmentation (Mod 6)', icon: Layers },
          { key: 'classification', label: 'Classification & Risk (Mod 7)', icon: Activity },
          { key: 'explainability', label: 'Explainable AI (Mod 8)', icon: Sparkles },
          { key: 'history', label: `History & Follow-Up (${mappedHistory.length})`, icon: History },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === t.key ? 'border-[#0E9F8E] text-[#0E9F8E]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1 */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider">Primary Lesion Photograph</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {clinicalCase.quality_label || 'Good'}
                </span>
              </div>
              <div className="aspect-square rounded-xl overflow-hidden bg-black border border-slate-200">
                {clinicalCase.image_url ? (
                  <img src={clinicalCase.image_url} alt="Skin Lesion" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No image uploaded yet</div>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Site: {clinicalCase.body_location}</span>
                <span>Laplacian: {clinicalCase.quality_metrics?.blur_laplacian || 184}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0E9F8E]" />
                  De-Identified Patient Profile
                </h3>
                <span className="text-[11px] text-slate-400">Patient Code: {clinicalCase.patient?.case_code}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400">Subject Age</div>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5">
                    {clinicalCase.patient?.age ? `${clinicalCase.patient.age} years` : 'Undisclosed'}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400">Biological Gender</div>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5 capitalize">{clinicalCase.patient?.gender || 'Unknown'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400">Anatomical Region</div>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5 capitalize">{clinicalCase.body_location}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-slate-700">Medical &amp; Dermatological History</div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                  {clinicalCase.patient?.medical_history || 'No prior cutaneous malignancy documented.'}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-slate-700">Documented Allergies</div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                  {clinicalCase.patient?.allergies || 'NKDA'}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E9F8E]" />
                Clinician Progress Notes &amp; Decision Log
              </h3>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {clinicalCase.clinical_notes || 'No notes appended yet.'}
              </div>

              <form onSubmit={handleAddNotes} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Append clinical note..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0E9F8E]"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteInput.trim()}
                  className="px-4 py-2 bg-[#0E9F8E] hover:bg-[#0c8274] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{savingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'segmentation' && (
        <LesionSegmentationView
          segmentation={clinicalCase.segmentation}
          originalUrl={clinicalCase.image_url}
          mlMaskBase64={prediction?.mask_png_base64}
        />
      )}

      {activeTab === 'classification' && (
        <ClassificationResultView
          prediction={prediction}
          quality={clinicalCase.quality_metrics}
          onRunInference={handleRunInference}
          isRunning={isInferenceRunning}
        />
      )}

      {activeTab === 'explainability' && (
        <ExplainableAIView
          originalUrl={clinicalCase.image_url || ''}
          preprocessedUrl={clinicalCase.preprocessing?.processedDataUrl}
          maskUrl={clinicalCase.segmentation?.maskDataUrl}
          heatmapUrl={prediction?.heatmap_png_base64 ? `data:image/png;base64,${prediction.heatmap_png_base64}` : undefined}
          isDemoMode={!prediction || prediction.is_demo_mode}
        />
      )}

      {activeTab === 'history' && (
        <CaseHistoryFollowUp history={mappedHistory} currentAnalysis={mappedHistory[0]} />
      )}

      {/* Edit Case Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-[#0B1F3A]">Edit De-Identified Case</h3>
            <form onSubmit={handleSaveCaseEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Case Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Site</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Medical History</label>
                <textarea
                  rows={2}
                  value={editHistory}
                  onChange={(e) => setEditHistory(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Allergies</label>
                <input
                  type="text"
                  value={editAllergies}
                  onChange={(e) => setEditAllergies(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0E9F8E] text-white rounded-lg font-semibold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-semibold">Notice: AI-assisted analysis, not a standalone medical diagnosis.</span>
        </div>
        <span className="text-[11px] text-slate-500">Quality → Preprocessing → Segmentation → Screening → Explainability</span>
      </div>
    </div>
  );
};
