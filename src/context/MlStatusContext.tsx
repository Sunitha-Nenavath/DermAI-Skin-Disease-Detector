import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mlService } from '../services/mlService';

export interface MlConnectionStatus {
  connected: boolean;
  demo_mode: boolean;
  source: 'env' | 'override' | 'none';
  message: string;
  remote_status?: {
    status?: string;
    loaded_models?: string[];
    device?: string;
  };
}

interface MlStatusContextType {
  status: MlConnectionStatus;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
}

const DEFAULT_STATUS: MlConnectionStatus = {
  connected: false,
  demo_mode: true,
  source: 'none',
  message: 'Checking ML inference service status...',
};

const MlStatusContext = createContext<MlStatusContextType | undefined>(undefined);

export const MlStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<MlConnectionStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const override = mlService.getMlServiceUrl();
      const query = override ? `?url=${encodeURIComponent(override)}` : '';
      const res = await fetch(`/api/ml/status${query}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({
          connected: false,
          demo_mode: true,
          source: 'none',
          message: 'ML status endpoint unavailable. Running in Demo Mode.',
        });
      }
    } catch {
      setStatus({
        connected: false,
        demo_mode: true,
        source: 'none',
        message: 'Unable to probe ML service. Operating in Demo Mode.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <MlStatusContext.Provider value={{ status, isLoading, refreshStatus }}>
      {children}
    </MlStatusContext.Provider>
  );
};

export const useMlStatus = () => {
  const ctx = useContext(MlStatusContext);
  if (!ctx) throw new Error('useMlStatus must be used within MlStatusProvider');
  return ctx;
};
