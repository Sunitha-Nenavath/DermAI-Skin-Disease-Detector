import React, { useState } from 'react';
import {
  History,
  Calendar,
  Layers,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import type { PredictionResult } from '../types';

export interface HistoricalAnalysisItem {
  id: string;
  timestamp: string;
  model_version: string;
  imageUrl: string;
  predictedCondition: string;
  confidence: number;
  riskTag: string;
  notes?: string;
}

interface CaseHistoryFollowUpProps {
  history: HistoricalAnalysisItem[];
  currentAnalysis?: HistoricalAnalysisItem | null;
}

export const CaseHistoryFollowUp: React.FC<CaseHistoryFollowUpProps> = ({
  history,
  currentAnalysis,
}) => {
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(
    history.length > 1 ? history[1].id : history[0]?.id || null
  );
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '90d'>('all');

  const baselineItem = history.find((h) => h.id === selectedBaselineId) || history[0];
  const latestItem = currentAnalysis || history[0];

  const filteredHistory = history.filter((item) => {
    if (timeFilter === 'all') return true;
    const itemTime = new Date(item.timestamp).getTime();
    const days = timeFilter === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return itemTime >= cutoff;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B1F3A]">
              Longitudinal History & Follow-Up Evolution (Module 12)
            </h3>
            <span className="text-[10px] bg-teal-50 text-[#0E9F8E] border border-teal-200 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
              {history.length} Analysis Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor skin lesion morphological evolution, pigment network shifts, and model confidence over time.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter:</span>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-[#0E9F8E]"
          >
            <option value="all">All Records</option>
            <option value="90d">Past 90 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Previous vs New Comparative View (Side-by-Side) */}
        {baselineItem && latestItem && baselineItem.id !== latestItem.id ? (
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0E9F8E]" />
                Comparative Temporal Evaluation: Previous vs Current
              </h4>
              <div className="text-xs text-slate-500">
                Baseline:{' '}
                <select
                  value={baselineItem.id}
                  onChange={(e) => setSelectedBaselineId(e.target.value)}
                  className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-medium ml-1"
                >
                  {history.map((h, i) => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.timestamp).toLocaleDateString()} ({h.model_version})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Previous / Baseline */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Baseline Image</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(baselineItem.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="aspect-square rounded-xl overflow-hidden bg-black border border-slate-200">
                  <img
                    src={baselineItem.imageUrl}
                    alt="Baseline lesion"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Finding:</span>
                    <strong className="text-slate-800">{baselineItem.predictedCondition}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence:</span>
                    <strong className="font-mono text-[#0E9F8E]">{baselineItem.confidence}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model:</span>
                    <span className="text-[11px] text-slate-600 font-mono">{baselineItem.model_version}</span>
                  </div>
                </div>
              </div>

              {/* Current / Follow-Up */}
              <div className="bg-white p-4 rounded-xl border border-[#0E9F8E]/30 ring-1 ring-[#0E9F8E]/20 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0E9F8E]">Current Follow-Up</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(latestItem.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="aspect-square rounded-xl overflow-hidden bg-black border border-slate-200">
                  <img
                    src={latestItem.imageUrl}
                    alt="Follow-up lesion"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Finding:</span>
                    <strong className="text-slate-800">{latestItem.predictedCondition}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence:</span>
                    <strong className="font-mono text-[#0E9F8E]">{latestItem.confidence}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model:</span>
                    <span className="text-[11px] text-slate-600 font-mono">{latestItem.model_version}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-teal-50/50 border border-teal-200/60 rounded-xl text-xs text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <span>
              Baseline analysis initialized. Future follow-up photographs will populate the comparative timeline to observe morphological evolution over time.
            </span>
          </div>
        )}

        {/* Chronological Table of Past Analyses */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#0E9F8E]" />
            Historical Analysis Timeline & Model Versions
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Model Version</th>
                  <th className="px-4 py-2.5">Analysis Finding</th>
                  <th className="px-4 py-2.5">Confidence</th>
                  <th className="px-4 py-2.5">Risk Tag</th>
                  <th className="px-4 py-2.5 text-right">Thumbnail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {item.model_version}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {item.predictedCondition}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#0E9F8E] font-bold">
                      {item.confidence}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {item.riskTag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <img
                        src={item.imageUrl}
                        alt="thumb"
                        className="w-8 h-8 rounded-lg object-cover inline-block border border-slate-200 bg-black"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mandatory Disclaimer */}
        <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <span className="font-medium">
              Notice: AI-assisted analysis, not a standalone medical diagnosis.
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Longitudinal Monitoring Support</span>
        </div>
      </div>
    </div>
  );
};
