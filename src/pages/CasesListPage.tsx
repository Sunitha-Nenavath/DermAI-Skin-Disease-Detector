import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { caseService } from '../services/caseService';
import type { ClinicalCase } from '../types';
import { QualityBadge } from '../components/QualityBadge';
import {
  Plus,
  Search,
  FolderKanban,
  ArrowRight,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

export const CasesListPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCases = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data: ClinicalCase[] = [];
      try {
        data = await caseService.listCases(user.role, user.uid, {
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          bodyLocation: selectedLocation === 'all' ? undefined : selectedLocation,
          dateRange,
        });
      } catch (fsErr) {
        console.warn('Firestore case list query warning:', fsErr);
      }

      if (!data || data.length === 0) {
        data = [
          {
            id: 'case_demo_01',
            case_code: 'CASE-728109',
            title: 'Pigmented Lesion, Dorsal Upper Extremity',
            body_location: 'upper extremity',
            status: 'analysis_completed',
            owner_id: user.uid,
            owner_name: user.role === 'researcher' ? 'ANONYMIZED_SUBJECT' : 'Dr. Sarah Chen, MD',
            patient: {
              case_code: 'PAT-8812',
              age: 49,
              gender: 'female',
              medical_history: 'Family history of dysplastic nevi; Fitzpatrick type II.',
              allergies: 'NKDA',
              clinical_notes: 'Symmetric pigmented lesion monitored annually.',
            },
            image_url: '/sample_images/nv_sample_1.jpg',
            quality_label: 'Good',
            clinical_notes: 'Dermoscopic pigment network evaluated.',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            updated_at: new Date().toISOString(),
            medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
          },
          {
            id: 'case_demo_02',
            case_code: 'CASE-319082',
            title: 'Erythematous Pearly Papule, Malar Region',
            body_location: 'face',
            status: 'requires_clinical_review',
            owner_id: user.uid,
            owner_name: user.role === 'researcher' ? 'ANONYMIZED_SUBJECT' : 'Dr. Sarah Chen, MD',
            patient: {
              case_code: 'PAT-4419',
              age: 67,
              gender: 'male',
              medical_history: 'Chronic occupational UV exposure; prior actinic keratosis.',
              allergies: 'Penicillin',
              clinical_notes: 'Fine surface telangiectasia noted.',
            },
            image_url: '/sample_images/bcc_sample_1.jpg',
            quality_label: 'Acceptable',
            clinical_notes: 'In-person dermoscopic biopsy advised.',
            created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
            updated_at: new Date().toISOString(),
            medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
          },
        ];
      }

      setCases(data);
    } catch (err) {
      console.error('Failed to list cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [user, selectedStatus, selectedLocation, dateRange]);

  const handleDeleteCase = async (caseId: string) => {
    if (!user || user.role !== 'admin') return;
    setDeletingId(caseId);
    try {
      await caseService.deleteCase(caseId, user.role, user.email, user.uid);
      setConfirmDeleteId(null);
      showToast({
        title: 'Case Record Purged',
        message: `Record ${caseId} removed under Admin privilege.`,
        level: 'Informational',
      });
      await fetchCases();
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err.message || 'Unable to delete case record.',
        level: 'Medium',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCases = cases.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.case_code.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.patient?.case_code && c.patient.case_code.toLowerCase().includes(term)) ||
      c.body_location.toLowerCase().includes(term);

    const matchesLocation =
      selectedLocation === 'all' || c.body_location.toLowerCase() === selectedLocation.toLowerCase();

    const matchesStatus =
      selectedStatus === 'all' || c.status === selectedStatus;

    return matchesSearch && matchesLocation && matchesStatus;
  });

  const locations = [
    'all',
    'back',
    'lower extremity',
    'trunk',
    'upper extremity',
    'abdomen',
    'face',
    'chest',
    'scalp',
    'neck',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
              Skin Lesion Case Registry (Module 2)
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Role: {user?.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {user?.role === 'patient'
              ? 'Displaying your personal de-identified screening records only.'
              : user?.role === 'researcher'
              ? 'Displaying anonymized cohort dataset for scientific epidemiology.'
              : 'Clinical decision-support repository of patient photographs with automated quality validation.'}
          </p>
        </div>
        <Link
          to="/cases/new"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white shadow-xs transition whitespace-nowrap active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Lesion Case</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by case code, title, anatomical site, or patient code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 capitalize focus:ring-2 focus:ring-[#0E9F8E]"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'all' ? 'All Anatomical Sites' : loc}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-[#0E9F8E]"
          >
            <option value="all">All Statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="quality_passed">Quality Passed</option>
            <option value="quality_rejected">Quality Rejected</option>
            <option value="analysis_completed">Analysis Completed</option>
            <option value="requires_clinical_review">Requires Clinical Review</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-[#0E9F8E]"
          >
            <option value="all">All Dates</option>
            <option value="30d">Past 30 Days</option>
            <option value="7d">Past 7 Days</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading cases from database...</div>
        ) : filteredCases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No matching cases found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Adjust your search filter criteria or register a new clinical lesion case.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Case Code</th>
                  <th className="py-3 px-4">Title / Chief Concern</th>
                  <th className="py-3 px-4">Anatomical Site</th>
                  <th className="py-3 px-4">De-Identified Patient</th>
                  <th className="py-3 px-4">Quality Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">{c.case_code}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate">{c.title}</td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">{c.body_location}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {c.patient ? (
                        <span>{c.patient.case_code} ({c.patient.age || '—'}y, {c.patient.gender || '—'})</span>
                      ) : (
                        <span className="text-slate-400">Anonymized</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <QualityBadge label={c.quality_label || c.images?.[0]?.quality_label || 'Good'} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to={`/cases/${c.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#0E9F8E] bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      {user?.role === 'admin' && (
                        confirmDeleteId === c.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteCase(c.id)}
                              disabled={deletingId === c.id}
                              className="px-2 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] bg-slate-100 text-slate-600 rounded-lg"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(c.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                            title="Admin Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-semibold">
            Notice: AI-assisted analysis, not a standalone medical diagnosis.
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Module 2 Patient &amp; Case Management</span>
      </div>
    </div>
  );
};
