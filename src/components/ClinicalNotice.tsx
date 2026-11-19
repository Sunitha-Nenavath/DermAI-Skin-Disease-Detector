import React from 'react';
import { ShieldAlert, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { useMlStatus } from '../context/MlStatusContext';

interface ClinicalBannerProps {
  isDemoMode?: boolean;
}

export const ClinicalBanner: React.FC<ClinicalBannerProps> = ({ isDemoMode }) => {
  const { status } = useMlStatus();
  const effectiveDemoMode = isDemoMode !== undefined ? isDemoMode : status.demo_mode;

  return (
    <div className="flex flex-col">
      {effectiveDemoMode ? (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 border-b border-amber-600 shadow-xs text-center">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-950 shrink-0" />
          <span>
            <strong>DEMO MODE:</strong> no trained model connected. Output is not a real prediction. Real client-side quality check, preprocessing &amp; classical lesion segmentation are active.
          </span>
        </div>
      ) : (
        <div className="bg-emerald-600 text-white px-4 py-1 text-[11px] font-semibold flex items-center justify-center gap-2 border-b border-emerald-700 text-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
          <span>
            <strong>LIVE ML CONNECTED:</strong> {status.message}
          </span>
        </div>
      )}

      {/* Mandatory clinical decision support disclaimer */}
      <div className="bg-[#0B1F3A] text-slate-200 px-4 py-1.5 text-xs flex items-center justify-center gap-2 border-b border-slate-800 text-center">
        <ShieldAlert className="w-3.5 h-3.5 text-[#0E9F8E] shrink-0" />
        <span className="tracking-wide">
          <strong className="text-[#0E9F8E] font-medium">Clinical Decision Support:</strong> AI-assisted analysis, not a standalone medical diagnosis.
        </span>
      </div>
    </div>
  );
};

export const ClinicalFooter: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 mt-16 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#0E9F8E] flex items-center justify-center text-white font-bold text-[10px]">
            D
          </div>
          <span className="font-bold text-[#0B1F3A]">DermAI Platform</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Mobile Skin Disease Screening &amp; Triage</span>
        </div>

        {/* Mandatory verbatim disclaimer */}
        <div className="bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-md text-[#0B1F3A] font-medium flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#0E9F8E]" />
          <span>AI-assisted analysis, not a standalone medical diagnosis.</span>
        </div>

        <div className="text-slate-400 text-[11px]">
          HAM10000 7-Class Protocol · Client-Side Laplacian &amp; Otsu Vision · De-identified Demo Data Only
        </div>
      </div>
    </footer>
  );
};
