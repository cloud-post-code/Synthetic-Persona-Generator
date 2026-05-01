import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SimulationSession } from '../models/types.js';

export type SimulationLogsBridgePayload = {
  sessions: SimulationSession[];
  activeSessionId: string | null;
  onSelectSession: (session: SimulationSession) => void | Promise<void>;
  onDeleteSession: (e: React.MouseEvent, id: string) => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  clearing: boolean;
  isAdmin: boolean;
};

type SimulationLogsBridgeContextValue = {
  bridge: SimulationLogsBridgePayload | null;
  setSimulationLogsBridge: (next: SimulationLogsBridgePayload | null) => void;
};

const SimulationLogsBridgeContext = createContext<SimulationLogsBridgeContextValue | undefined>(undefined);

export function SimulationLogsBridgeProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<SimulationLogsBridgePayload | null>(null);

  const setSimulationLogsBridge = useCallback((next: SimulationLogsBridgePayload | null) => {
    setBridge(next);
  }, []);

  const value = useMemo(
    () => ({ bridge, setSimulationLogsBridge }),
    [bridge, setSimulationLogsBridge]
  );

  return (
    <SimulationLogsBridgeContext.Provider value={value}>
      {children}
    </SimulationLogsBridgeContext.Provider>
  );
}

export function useSimulationLogsBridge(): SimulationLogsBridgePayload | null {
  const ctx = useContext(SimulationLogsBridgeContext);
  if (!ctx) {
    throw new Error('useSimulationLogsBridge must be used within SimulationLogsBridgeProvider');
  }
  return ctx.bridge;
}

export function useSimulationLogsBridgeSetter(): (next: SimulationLogsBridgePayload | null) => void {
  const ctx = useContext(SimulationLogsBridgeContext);
  if (!ctx) {
    throw new Error('useSimulationLogsBridgeSetter must be used within SimulationLogsBridgeProvider');
  }
  return ctx.setSimulationLogsBridge;
}
