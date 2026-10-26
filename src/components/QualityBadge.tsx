import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { QualityLabel } from '../types';

interface QualityBadgeProps {
  label: QualityLabel;
  score?: number;
  showIcon?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ label, score, showIcon = true }) => {
  if (label === 'Good') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
        {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        <span>Good Quality</span>
        {score !== undefined && <span className="font-mono text-[11px] opacity-80">({score})</span>}
      </span>
    );
  }

  if (label === 'Acceptable') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200">
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
        <span>Acceptable</span>
        {score !== undefined && <span className="font-mono text-[11px] opacity-80">({score})</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-800 border border-rose-200">
      {showIcon && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
      <span>Poor Quality (Retake)</span>
      {score !== undefined && <span className="font-mono text-[11px] opacity-80">({score})</span>}
    </span>
  );
};
