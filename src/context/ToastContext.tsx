import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Info, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export type ToastLevel = 'Informational' | 'Low' | 'Medium' | 'High';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  level: ToastLevel;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function sanitizeClinicalText(input: string): string {
  return input
    .replace(/critical diagnosis/gi, 'AI-assisted finding')
    .replace(/confirmed diagnosis/gi, 'AI-assisted finding')
    .replace(/\bconfirmed\b/gi, 'observed');
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const safeToast: ToastMessage = {
      id,
      title: sanitizeClinicalText(toast.title),
      message: sanitizeClinicalText(toast.message),
      level: toast.level,
    };
    setToasts((prev) => [...prev.slice(-3), safeToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const styleForLevel = (level: ToastLevel) => {
    switch (level) {
      case 'High':
        return 'bg-rose-50 border-rose-300 text-rose-950';
      case 'Medium':
        return 'bg-amber-50 border-amber-300 text-amber-950';
      case 'Low':
        return 'bg-blue-50 border-blue-200 text-blue-950';
      default:
        return 'bg-white border-teal-300 text-[#0B1F3A]';
    }
  };

  const iconForLevel = (level: ToastLevel) => {
    switch (level) {
      case 'High':
        return <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />;
      case 'Medium':
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />;
      case 'Low':
        return <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0 mt-0.5" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-lg backdrop-blur-xs text-xs flex items-start gap-2.5 ${styleForLevel(t.level)}`}
          >
            {iconForLevel(t.level)}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold truncate">{t.title}</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/5 shrink-0">
                  {t.level}
                </span>
              </div>
              <p className="opacity-90 leading-snug">{t.message}</p>
              <div className="text-[10px] opacity-70 pt-0.5">
                AI-assisted analysis, not a standalone medical diagnosis.
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="opacity-60 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
