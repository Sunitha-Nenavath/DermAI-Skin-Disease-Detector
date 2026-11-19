import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useMlStatus } from '../context/MlStatusContext';
import { useToast } from '../context/ToastContext';
import { caseService } from '../services/caseService';
import { analysisService, StoredAnalysisRecord } from '../services/analysisService';
import { modelService } from '../services/modelService';
import { reportService } from '../services/reportService';
import type { ClinicalCase } from '../types';
import { DISEASE_CLASSES, DiseaseClassKey } from '../types';
import {
  Plus,
  ArrowRight,
  ShieldAlert,
  Activity,
  Download,
  Server,
  BarChart3,
  Clock,
  FileCheck,
  Search,
  RefreshCw,
  Eye,
  X,
  SlidersHorizontal,
  Database,
  Layers,
  BookOpen,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
} from 'lucide-react';

type TimeframeKey = '7d' | '30d' | 'all';
type StatusFilterKey = 'all' | 'review' | 'quality_passed' | 'awaiting';
type SortKey = 'newest' | 'code' | 'confidence';
type LeftChartMode = 'timeline' | 'sites' | 'quality';
type RightChartMode = 'live_findings' | 'confidence' | 'ham10000';

const HAM10000_REFERENCE = [
  { key: 'nv', name: 'Melanocytic Nevi', count: 6705, risk: 'Low', color: '#0E9F8E' },
  { key: 'mel', name: 'Melanoma', count: 1113, risk: 'Critical', color: '#DC2626' },
  { key: 'bkl', name: 'Benign Keratosis', count: 1099, risk: 'Low', color: '#0EA5E9' },
  { key: 'bcc', name: 'Basal Cell Carcinoma', count: 514, risk: 'High', color: '#D97706' },
  { key: 'akiec', name: 'Actinic Keratoses', count: 327, risk: 'High', color: '#EA580C' },
  { key: 'vasc', name: 'Vascular Lesions', count: 142, risk: 'Moderate', color: '#6366F1' },
  { key: 'df', name: 'Dermatofibroma', count: 115, risk: 'Low', color: '#64748B' },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getThresholdValue(): number {
  const saved = localStorage.getItem('dermai_confidence_threshold');
  return saved ? parseFloat(saved) : 0.5;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { status: mlStatus, isLoading: mlProbing, refreshStatus } = useMlStatus();
  const { showToast } = useToast();

  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [analyses, setAnalyses] = useState<StoredAnalysisRecord[]>([]);
  const [registeredUsersCount, setRegisteredUsersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic interactive state
  const [timeframe, setTimeframe] = useState<TimeframeKey>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [leftChartMode, setLeftChartMode] = useState<LeftChartMode>('timeline');
  const [rightChartMode, setRightChartMode] = useState<RightChartMode>('live_findings');
  const [selectedCase, setSelectedCase] = useState<ClinicalCase | null>(null);

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [caseData, analysisData] = await Promise.all([
        caseService.listCases(user.role, user.uid),
        analysisService.listAllRecent(user.role),
      ]);
      setCases(caseData || []);

      const scopedAnalyses =
        user.role === 'patient'
          ? analysisData.filter((a) => a.owner_id === user.uid)
          : analysisData;
      setAnalyses(scopedAnalyses);

      const hasLive = scopedAnalyses.some((a) => !a.is_demo_mode && a.confidence > 0);
      setRightChartMode((prev) => (prev === 'live_findings' && !hasLive ? 'ham10000' : prev));

      if (user.role === 'admin' && auth.currentUser) {
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          setRegisteredUsersCount(uSnap.size);
        } catch {
          setRegisteredUsersCount(null);
        }
      }
    } catch (err: any) {
      console.warn('Dashboard load warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const confidenceThreshold = getThresholdValue();
  const activeModel = modelService.getActiveVersion();

  const isCaseRequiringReview = (c: ClinicalCase): boolean =>
    c.status === 'requires_clinical_review' ||
    Boolean(c.latest_prediction && !c.latest_prediction.is_demo_mode && c.latest_prediction.confidence < confidenceThreshold);

  const timeframeCutoff = useMemo(() => {
    if (timeframe === 'all') return 0;
    const days = timeframe === '7d' ? 7 : 30;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [timeframe]);

  const timeframeCases = useMemo(() => {
    if (timeframeCutoff === 0) return cases;
    return cases.filter((c) => new Date(c.created_at).getTime() >= timeframeCutoff);
  }, [cases, timeframeCutoff]);

  const timeframeAnalyses = useMemo(() => {
    if (timeframeCutoff === 0) return analyses;
    return analyses.filter((a) => new Date(a.created_at).getTime() >= timeframeCutoff);
  }, [analyses, timeframeCutoff]);

  const liveAnalyses = useMemo(
    () => timeframeAnalyses.filter((a) => !a.is_demo_mode && a.confidence > 0),
    [timeframeAnalyses]
  );

  // Core KPIs (strictly grounded in real loaded records)
  const totalCases = timeframeCases.length;
  const casesRequiringReview = useMemo(
    () => timeframeCases.filter(isCaseRequiringReview).length,
    [timeframeCases, confidenceThreshold]
  );

  const evaluatedQualityCases = useMemo(
    () => timeframeCases.filter((c) => Boolean(c.quality_label)),
    [timeframeCases]
  );
  const passedQualityCount = useMemo(
    () => evaluatedQualityCases.filter((c) => c.quality_label === 'Good' || c.quality_label === 'Acceptable').length,
    [evaluatedQualityCases]
  );
  const qualityPassedRate =
    evaluatedQualityCases.length > 0
      ? Math.round((passedQualityCount / evaluatedQualityCases.length) * 100)
      : 0;

  const meanLatencyMs =
    liveAnalyses.length > 0
      ? Math.round(liveAnalyses.reduce((acc, a) => acc + (a.latency_ms || 0), 0) / liveAnalyses.length)
      : null;

  // Chart 1A: Screening Activity Timeline (bucketed by date)
  const timelineChartData = useMemo(() => {
    const map = new Map<string, { dateLabel: string; ts: number; cases: number; qualityPassed: number }>();
    timeframeCases.forEach((c) => {
      const dt = new Date(c.created_at);
      if (Number.isNaN(dt.getTime())) return;
      const key = dt.toISOString().slice(0, 10);
      const label = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const existing = map.get(key) || { dateLabel: label, ts: dt.getTime(), cases: 0, qualityPassed: 0 };
      existing.cases += 1;
      if (c.quality_label === 'Good' || c.quality_label === 'Acceptable') {
        existing.qualityPassed += 1;
      }
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  }, [timeframeCases]);

  // Chart 1B: Anatomical Sites Distribution
  const bodySiteChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    timeframeCases.forEach((c) => {
      const site = (c.body_location || 'Unspecified').replace(/_/g, ' ');
      const pretty = site.charAt(0).toUpperCase() + site.slice(1);
      counts[pretty] = (counts[pretty] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([site, count]) => ({ site, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [timeframeCases]);

  // Chart 1C: Image Quality Gate Breakdown
  const qualityChartData = useMemo(() => {
    const good = timeframeCases.filter((c) => c.quality_label === 'Good').length;
    const acceptable = timeframeCases.filter((c) => c.quality_label === 'Acceptable').length;
    const poor = timeframeCases.filter((c) => c.quality_label === 'Poor').length;
    const pending = timeframeCases.filter((c) => !c.quality_label).length;
    return [
      { label: 'Good', count: good, color: '#0E9F8E' },
      { label: 'Acceptable', count: acceptable, color: '#0EA5E9' },
      { label: 'Poor', count: poor, color: '#DC2626' },
      { label: 'Pending', count: pending, color: '#94A3B8' },
    ];
  }, [timeframeCases]);

  // Chart 2A: Live ML Findings Distribution
  const liveDiseaseChartData = useMemo(() => {
    const map: Record<string, number> = {};
    (Object.keys(DISEASE_CLASSES) as DiseaseClassKey[]).forEach((k) => {
      map[DISEASE_CLASSES[k].name] = 0;
    });
    liveAnalyses.forEach((a) => {
      const meta = DISEASE_CLASSES[a.predicted_label as DiseaseClassKey];
      const name = meta?.name || a.predicted_name;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [liveAnalyses]);

  // Chart 2B: Confidence Stratification
  const confidenceBins = useMemo(
    () => [
      { range: '0–49%', count: liveAnalyses.filter((a) => a.confidence < 0.5).length, color: '#DC2626' },
      { range: '50–69%', count: liveAnalyses.filter((a) => a.confidence >= 0.5 && a.confidence < 0.7).length, color: '#D97706' },
      { range: '70–84%', count: liveAnalyses.filter((a) => a.confidence >= 0.7 && a.confidence < 0.85).length, color: '#0EA5E9' },
      { range: '85–100%', count: liveAnalyses.filter((a) => a.confidence >= 0.85).length, color: '#0E9F8E' },
    ],
    [liveAnalyses]
  );

  // Filtered & sorted registry rows
  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = timeframeCases.filter((c) => {
      if (statusFilter === 'review' && !isCaseRequiringReview(c)) return false;
      if (
        statusFilter === 'quality_passed' &&
        c.quality_label !== 'Good' &&
        c.quality_label !== 'Acceptable'
      ) {
        return false;
      }
      if (statusFilter === 'awaiting' && c.latest_prediction) return false;

      if (q) {
        const finding = c.latest_prediction?.top3?.[0]?.label_name || '';
        const haystack = `${c.case_code} ${c.title} ${c.body_location} ${finding}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'code') return a.case_code.localeCompare(b.case_code);
      if (sortBy === 'confidence') {
        const ca = a.latest_prediction && !a.latest_prediction.is_demo_mode ? a.latest_prediction.confidence : -1;
        const cb = b.latest_prediction && !b.latest_prediction.is_demo_mode ? b.latest_prediction.confidence : -1;
        return cb - ca;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [timeframeCases, statusFilter, searchQuery, sortBy, confidenceThreshold]);

  const handleDownloadReport = async (c: ClinicalCase) => {
    if (!user) return;
    await reportService.exportPDF({
      clinicalCase: c,
      prediction: c.latest_prediction,
      quality: c.quality_metrics,
      userEmail: user.email,
      userRole: user.role,
    });
    showToast({
      title: 'Clinical Report Ready',
      message: `PDF decision support report generated for ${c.case_code}.`,
      level: 'Informational',
    });
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadDashboard(), refreshStatus()]);
    showToast({
      title: 'Workspace Synced',
      message: 'Cases, analytics, and ML service connectivity refreshed.',
      level: 'Informational',
    });
  };

  const formatQualityTone = (label?: string) => {
    if (label === 'Good') return 'text-emerald-700';
    if (label === 'Acceptable') return 'text-sky-700';
    if (label === 'Poor') return 'text-rose-700';
    return 'text-slate-400';
  };

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const roleDisplay = user?.role ? user.role.replace('_', ' ') : 'clinician';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
      {/* 1. Clinical Command Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0B1F3A] text-white border border-slate-800 px-6 py-6 sm:px-8 sm:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #5eead4 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-teal-300/90 uppercase tracking-wider">
              <span>{todayFormatted}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>{roleDisplay} workspace</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className={mlStatus.connected ? 'text-emerald-300' : 'text-amber-300'}>
                {mlStatus.connected ? 'PyTorch ML Connected' : 'Demo Mode (Classical CV Active)'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {getTimeGreeting()}, {user?.displayName || 'Clinical User'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Monitor dermatological screening cases, image quality gates, and HAM10000 clinical decision support workflows from a single workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={loading || mlProbing}
              className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || mlProbing ? 'animate-spin' : ''}`} />
              <span>Sync Data</span>
            </button>
            <Link
              to="/dataset"
              className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-white transition whitespace-nowrap"
            >
              HAM10000 EDA
            </Link>
            <Link
              to="/cases/new"
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0E9F8E] hover:bg-[#0b8a7b] text-white transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Lesion Case</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Interactive Filter & Timeframe Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-[#0B1F3A]">Cohort Window:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {([
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ] as { id: TimeframeKey; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeframe(opt.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  timeframe === opt.id
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {user?.email} · Threshold ≥ {Math.round(confidenceThreshold * 100)}%
        </div>
      </div>

      {/* 3. Single-Elevation Interactive KPI Strip (Tabular Numerals, Zero Pills) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left bg-white p-5 rounded-xl border transition ${
            statusFilter === 'all'
              ? 'border-[#0B1F3A] ring-1 ring-[#0B1F3A]/10'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>{user?.role === 'patient' ? 'My Cases' : 'Screening Cases'}</span>
            <ScanLine className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#0B1F3A]">
              {loading ? '—' : totalCases}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {timeframeAnalyses.length} scans
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            De-identified records in selected window
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'review' ? 'all' : 'review')}
          className={`text-left bg-white p-5 rounded-xl border transition ${
            statusFilter === 'review'
              ? 'border-rose-600 ring-1 ring-rose-600/10'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Clinical Review Queue</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-rose-600">
              {loading ? '—' : casesRequiringReview}
            </span>
            <span className="text-[11px] font-semibold text-rose-600">
              {statusFilter === 'review' ? 'Filtered' : 'Click to filter'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Flagged cases or confidence below {Math.round(confidenceThreshold * 100)}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'quality_passed' ? 'all' : 'quality_passed')}
          className={`text-left bg-white p-5 rounded-xl border transition ${
            statusFilter === 'quality_passed'
              ? 'border-[#0E9F8E] ring-1 ring-[#0E9F8E]/15'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Image Quality Gate</span>
            <CheckCircle2 className="w-4 h-4 text-[#0E9F8E]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#0E9F8E]">
              {loading ? '—' : evaluatedQualityCases.length > 0 ? `${qualityPassedRate}%` : '—'}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {passedQualityCount}/{evaluatedQualityCases.length} passed
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0E9F8E] transition-all duration-500"
              style={{ width: `${evaluatedQualityCases.length > 0 ? qualityPassedRate : 0}%` }}
            />
          </div>
        </button>

        <Link
          to="/models"
          className="text-left bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 transition block"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Serving Pipeline</span>
            <Cpu className="w-4 h-4 text-[#0B1F3A]" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#0B1F3A] truncate">
            {activeModel}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={mlStatus.connected ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
              {mlStatus.connected ? 'Live PyTorch Inference' : 'Demo · Classical CV'}
            </span>
            <span className="font-mono tabular-nums text-slate-500">
              {meanLatencyMs !== null ? `${meanLatencyMs}ms` : `${liveAnalyses.length} live`}
            </span>
          </div>
        </Link>
      </section>

      {/* 4. Dynamic Interactive Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Chart: Screening Volume, Body Sites & Quality */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0E9F8E]" />
                <span>Cohort Activity &amp; Image Quality</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Live metrics aggregated directly from recorded cases
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-auto">
              {([
                { id: 'timeline', label: 'Timeline' },
                { id: 'sites', label: 'Body Sites' },
                { id: 'quality', label: 'Quality' },
              ] as { id: LeftChartMode; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeftChartMode(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                    leftChartMode === tab.id
                      ? 'bg-white text-[#0B1F3A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {timeframeCases.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 px-6 text-center space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                No screening cases in this timeframe yet
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                Create your first lesion case to populate screening volume trends, anatomical site breakdowns, and image quality scores.
              </p>
              <Link
                to="/cases/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0E9F8E] hover:bg-[#0b8a7b] text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Case</span>
              </Link>
            </div>
          ) : leftChartMode === 'timeline' ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E9F8E" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#0E9F8E" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cases"
                    name="Total Cases"
                    stroke="#0B1F3A"
                    strokeWidth={2}
                    fillOpacity={0.08}
                    fill="#0B1F3A"
                  />
                  <Area
                    type="monotone"
                    dataKey="qualityPassed"
                    name="Quality Passed"
                    stroke="#0E9F8E"
                    strokeWidth={2}
                    fill="url(#tealGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : leftChartMode === 'sites' ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bodySiteChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 11, fill: '#334155' }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="count" name="Cases" radius={[0, 6, 6, 0]}>
                    {bodySiteChartData.map((_entry, idx) => (
                      <Cell key={`site-${idx}`} fill={idx === 0 ? '#0E9F8E' : '#0B1F3A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityChartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="count" name="Uploads" radius={[6, 6, 0, 0]} maxBarSize={54}>
                    {qualityChartData.map((entry, idx) => (
                      <Cell key={`qual-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Chart: 7-Class Diagnostic & Confidence Intelligence */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0E9F8E]" />
                <span>Diagnostic Class &amp; Confidence</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {rightChartMode === 'ham10000'
                  ? 'HAM10000 benchmark distribution (10,015 images · Reference Only)'
                  : `${liveAnalyses.length} recorded live ML predictions`}
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-auto">
              {([
                { id: 'live_findings', label: 'Live ML' },
                { id: 'confidence', label: 'Confidence' },
                { id: 'ham10000', label: 'HAM10000 Ref' },
              ] as { id: RightChartMode; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRightChartMode(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                    rightChartMode === tab.id
                      ? 'bg-white text-[#0B1F3A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {rightChartMode === 'ham10000' ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={HAM10000_REFERENCE} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={132} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any, _name: any, item: any) => [
                      `${Number(val).toLocaleString()} images (${item?.payload?.risk} Risk)`,
                      'HAM10000 Baseline',
                    ]}
                    contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {HAM10000_REFERENCE.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : liveAnalyses.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 px-6 text-center space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                No live PyTorch ML predictions recorded in this window
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                Demo Mode never fabricates diagnostic probabilities. Connect your trained model endpoint in Settings or view the HAM10000 dataset reference.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRightChartMode('ham10000')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
                >
                  View HAM10000 Reference
                </button>
                <Link
                  to="/settings"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B1F3A] hover:bg-slate-800 text-white transition"
                >
                  Configure ML Service
                </Link>
              </div>
            </div>
          ) : rightChartMode === 'live_findings' ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liveDiseaseChartData} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={132} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="count" name="Live Predictions" radius={[0, 6, 6, 0]}>
                    {liveDiseaseChartData.map((_entry, index) => (
                      <Cell key={`live-${index}`} fill={index === 0 ? '#0E9F8E' : '#0B1F3A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceBins} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="count" name="Predictions" radius={[6, 6, 0, 0]} maxBarSize={54}>
                    {confidenceBins.map((entry, idx) => (
                      <Cell key={`bin-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* 5. Patient-Specific Recent Analyses Strip (when signed in as Patient) */}
      {user?.role === 'patient' && (
        <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0E9F8E]" />
              <span>Your Recent Screening Analyses</span>
            </h2>
            <Link to="/cases" className="text-xs font-semibold text-[#0E9F8E] hover:underline">
              All Cases
            </Link>
          </div>
          {analyses.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No completed analyses recorded yet. Create a case to upload a skin lesion image and run screening.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {analyses.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  to={`/cases/${a.case_id}`}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-[#0E9F8E] flex items-center gap-3 transition"
                >
                  <img
                    src={a.image_url || '/sample_images/nv_sample_1.jpg'}
                    alt="Lesion thumbnail"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#0B1F3A] truncate">{a.predicted_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {a.is_demo_mode
                        ? 'Demo Mode · Classical CV'
                        : `${Math.round(a.confidence * 100)}% confidence`}
                      {' · '}
                      {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <FileCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 6. Admin Platform Overview Bar (Real State Only) */}
      {user?.role === 'admin' && (
        <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#0E9F8E]" />
              <span>Platform Readiness &amp; Governance</span>
            </h2>
            <Link
              to="/admin"
              className="text-xs font-semibold text-[#0E9F8E] hover:underline flex items-center gap-1"
            >
              <span>Open User &amp; Audit Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="pt-2 md:pt-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ML Endpoint</div>
              <div className={`font-bold mt-1 ${mlStatus.connected ? 'text-emerald-700' : 'text-amber-700'}`}>
                {mlStatus.connected ? 'Connected' : 'Demo Mode'}
              </div>
            </div>
            <div className="pt-2 md:pt-0 md:pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Checkpoints</div>
              <div className="font-bold text-[#0B1F3A] mt-1 truncate">
                {mlStatus.remote_status?.loaded_models?.length
                  ? mlStatus.remote_status.loaded_models.join(', ')
                  : 'None loaded'}
              </div>
            </div>
            <div className="pt-2 md:pt-0 md:pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Version</div>
              <div className="font-mono font-bold text-[#0E9F8E] mt-1 truncate">{activeModel}</div>
            </div>
            <div className="pt-2 md:pt-0 md:pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mean Latency</div>
              <div className="font-mono tabular-nums font-bold text-[#0B1F3A] mt-1">
                {meanLatencyMs !== null ? `${meanLatencyMs} ms` : '—'}
              </div>
            </div>
            <div className="pt-2 md:pt-0 md:pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cloud Accounts</div>
              <div className="font-mono tabular-nums font-bold text-[#0B1F3A] mt-1">
                {registeredUsersCount !== null ? registeredUsersCount : '—'}
              </div>
            </div>
            <div className="pt-2 md:pt-0 md:pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Logged Scans</div>
              <div className="font-mono tabular-nums font-bold text-[#0E9F8E] mt-1">{analyses.length}</div>
            </div>
          </div>
        </section>
      )}

      {/* 7. Interactive Screening Case Registry + Live Inspector */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${
            selectedCase ? 'xl:col-span-8' : 'xl:col-span-12'
          }`}
        >
          {/* Registry Header + Live Search & Status Controls */}
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F3A]">Screening Case Registry</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  Showing {filteredCases.length} of {timeframeCases.length} records
                </p>
              </div>
              <Link
                to="/cases"
                className="text-xs font-semibold text-[#0E9F8E] hover:underline flex items-center gap-1"
              >
                <span>Open Full Registry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by case code, concern, anatomical site, or finding..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'review', label: 'Needs Review' },
                    { id: 'quality_passed', label: 'Quality Passed' },
                    { id: 'awaiting', label: 'Awaiting Scan' },
                  ] as { id: StatusFilterKey; label: string }[]).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition whitespace-nowrap ${
                        statusFilter === st.id
                          ? 'bg-white text-[#0B1F3A] shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Sort cases"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="code">Sort: Case Code</option>
                  <option value="confidence">Sort: Confidence</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-11 rounded-lg bg-slate-100/80 animate-pulse" />
              ))}
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                {cases.length === 0
                  ? 'No screening cases recorded yet.'
                  : 'No cases match the current search or filter.'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                {cases.length === 0
                  ? 'Start a new mobile or dermoscopic screening case to run image quality evaluation, Otsu segmentation, and AI analysis.'
                  : 'Clear filters to view all cases in your cohort.'}
              </p>
              {cases.length === 0 ? (
                <Link
                  to="/cases/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0E9F8E] hover:bg-[#0b8a7b] text-white transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Case</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTimeframe('all');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Concern &amp; Site</th>
                    <th className="px-4 py-3">Finding</th>
                    <th className="px-4 py-3 text-right">Confidence</th>
                    <th className="px-4 py-3">Quality</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.slice(0, 8).map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    const needsReview = isCaseRequiringReview(c);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCase(isSelected ? null : c)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={c.image_url || '/sample_images/nv_sample_1.jpg'}
                              alt={c.case_code}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-mono font-bold text-[#0B1F3A]">{c.case_code}</div>
                              <div className="text-[10px] font-mono tabular-nums text-slate-400">
                                {new Date(c.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[210px]">
                          <div className="font-semibold text-slate-800 truncate">{c.title}</div>
                          <div className="text-[11px] text-slate-500 capitalize">
                            {c.body_location}
                            {needsReview ? ' · Review Required' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                          {c.latest_prediction?.is_demo_mode
                            ? 'Demo · Classical CV'
                            : c.latest_prediction?.top3?.[0]?.label_name || 'Awaiting Analysis'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#0E9F8E] whitespace-nowrap">
                          {c.latest_prediction && !c.latest_prediction.is_demo_mode
                            ? `${Math.round(c.latest_prediction.confidence * 100)}%`
                            : '—'}
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${formatQualityTone(c.quality_label)}`}>
                          {c.quality_label || 'Pending'}
                        </td>
                        <td
                          className="px-4 py-3 text-right whitespace-nowrap space-x-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCase(isSelected ? null : c)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-100 rounded-md transition"
                            title="Quick inspect case details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-100 rounded-md transition"
                            title="Download PDF Report"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          <Link
                            to={`/cases/${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0E9F8E] hover:bg-[#0b8a7b] rounded-md transition"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Quick Case Inspector Panel */}
        {selectedCase && (
          <aside className="xl:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-[#0E9F8E] uppercase">
                  {selectedCase.case_code}
                </div>
                <h3 className="text-sm font-bold text-[#0B1F3A] mt-0.5">{selectedCase.title}</h3>
                <p className="text-[11px] text-slate-500 capitalize">
                  {selectedCase.body_location} · {new Date(selectedCase.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                aria-label="Close inspector"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[4/3]">
              <img
                src={selectedCase.image_url || '/sample_images/nv_sample_1.jpg'}
                alt={selectedCase.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Quality Gate</div>
                <div className={`font-bold mt-0.5 ${formatQualityTone(selectedCase.quality_label)}`}>
                  {selectedCase.quality_label || 'Pending'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Primary Finding</div>
                <div className="font-bold text-[#0B1F3A] mt-0.5 truncate">
                  {selectedCase.latest_prediction?.is_demo_mode
                    ? 'Demo · Classical CV'
                    : selectedCase.latest_prediction?.top3?.[0]?.label_name || 'Pending'}
                </div>
              </div>
            </div>

            {selectedCase.clinical_notes && (
              <div className="text-xs space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Clinical Notes
                </div>
                <p className="text-slate-600 leading-relaxed">{selectedCase.clinical_notes}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownloadReport(selectedCase)}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
              <Link
                to={`/cases/${selectedCase.id}`}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0E9F8E] hover:bg-[#0b8a7b] text-white transition"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </aside>
        )}
      </section>

      {/* 8. Quick Workflow Launchpad */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/cases/new"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0E9F8E] transition flex items-start gap-3"
        >
          <div className="p-2 rounded-lg bg-teal-50 text-[#0E9F8E] shrink-0">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B1F3A] group-hover:text-[#0E9F8E] transition">
              Capture &amp; Quality Check
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Upload mobile or dermoscopic image with live sharpness &amp; lighting check
            </p>
          </div>
        </Link>

        <Link
          to="/models"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0E9F8E] transition flex items-start gap-3"
        >
          <div className="p-2 rounded-lg bg-slate-100 text-[#0B1F3A] shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B1F3A] group-hover:text-[#0E9F8E] transition">
              Model Registry
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Compare EfficientNet-B3, ResNet50, ConvNeXt &amp; ensemble weights
            </p>
          </div>
        </Link>

        <Link
          to="/evaluation"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0E9F8E] transition flex items-start gap-3"
        >
          <div className="p-2 rounded-lg bg-slate-100 text-[#0B1F3A] shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B1F3A] group-hover:text-[#0E9F8E] transition">
              ROC &amp; Confusion Matrix
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Inspect 7-class validation sensitivity, specificity &amp; calibration
            </p>
          </div>
        </Link>

        <Link
          to={user?.role === 'admin' ? '/admin' : '/settings'}
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0E9F8E] transition flex items-start gap-3"
        >
          <div className="p-2 rounded-lg bg-slate-100 text-[#0B1F3A] shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0B1F3A] group-hover:text-[#0E9F8E] transition">
              {user?.role === 'admin' ? 'Governance & Audit Logs' : 'ML Endpoint & Help'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {user?.role === 'admin'
                ? 'Manage user accounts, role permissions & immutable audit trail'
                : 'Connect trained PyTorch service URL & adjust confidence threshold'}
            </p>
          </div>
        </Link>
      </section>

      {/* 9. Mandatory Clinical Disclaimer */}
      <footer className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-semibold text-[#0B1F3A]">
            Notice: AI-assisted analysis, not a standalone medical diagnosis.
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          Clinical Decision Support Protocol · HAM10000 Aligned
        </span>
      </footer>
    </div>
  );
};
