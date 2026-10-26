import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { casesApi } from '../services/api';
import { ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [bodyLocation, setBodyLocation] = useState('upper extremity');
  const [patientAge, setPatientAge] = useState<number | ''>(48);
  const [patientGender, setPatientGender] = useState('male');
  const [medicalHistory, setMedicalHistory] = useState('Mild sun exposure; no prior history of cutaneous melanoma.');
  const [clinicalNotes, setClinicalNotes] = useState('Patient noticed gradual darkening and asymmetry over recent months.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const created = await casesApi.create({
        title,
        body_location: bodyLocation,
        patient_age: patientAge === '' ? undefined : Number(patientAge),
        patient_gender: patientGender,
        medical_history: medicalHistory,
        clinical_notes: clinicalNotes,
      });
      // Redirect directly to case detail for image intake
      navigate(`/cases/${created.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create case. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        to="/cases"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Case Registry</span>
      </Link>

      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
          Create De-Identified Lesion Case
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Initiate a new clinical screening record before capturing or uploading mobile images.
        </p>
      </div>

      {/* Strict Privacy Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong>De-Identification Policy</strong>: In accordance with HIPAA and GDPR research standards, do not enter real patient names, social security numbers, or direct personal identifiers. The system automatically assigns a random alphanumeric code (e.g. <code>PAT-2026-X12</code>).
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Case Title / Chief Clinical Concern *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Asymmetrical pigmented border, dorsal left forearm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Anatomical Body Location (HAM10000 Aligned) *
            </label>
            <select
              value={bodyLocation}
              onChange={(e) => setBodyLocation(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg capitalize focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
            >
              <option value="back">back</option>
              <option value="lower extremity">lower extremity (legs, feet)</option>
              <option value="trunk">trunk (back/torso general)</option>
              <option value="upper extremity">upper extremity (arms, hands)</option>
              <option value="abdomen">abdomen</option>
              <option value="face">face</option>
              <option value="chest">chest</option>
              <option value="scalp">scalp</option>
              <option value="neck">neck</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Patient Age (Years)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              placeholder="e.g. 54"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Patient Biological Gender
          </label>
          <select
            value={patientGender}
            onChange={(e) => setPatientGender(e.target.value)}
            className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / Non-Binary</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Relevant Dermatological Medical History
          </label>
          <textarea
            rows={2}
            value={medicalHistory}
            onChange={(e) => setMedicalHistory(e.target.value)}
            placeholder="Sunburn history, prior dysplastic nevi, family melanoma history, Fitzpatrick phototype..."
            className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Initial Clinical Intake Notes
          </label>
          <textarea
            rows={3}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Lesion evolution, diameter changes, bleeding, elevation, itching..."
            className="mt-1 block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to="/cases"
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#0E9F8E] hover:bg-[#0B7C6E] rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Case...' : 'Save & Proceed to Image Intake'}
          </button>
        </div>
      </form>
    </div>
  );
};
