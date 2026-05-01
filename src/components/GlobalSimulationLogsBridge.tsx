import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useSimulationLogsBridgeSetter } from '../context/SimulationLogsBridgeContext.js';
import type { SimulationSession } from '../models/types.js';
import { simulationApi } from '../services/simulationApi.js';
import { hardEvictAllSimulationLocalStorage } from '../utils/simulationLocalStorage.js';

function sortSessions(sessions: SimulationSession[]): SimulationSession[] {
  return [...sessions].sort((a, b) => {
    const dateA = a.createdAt || '';
    const dateB = b.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Registers the simulation-logs sidebar bridge on every route except `/simulate`,
 * where `SimulationPage` owns the bridge. Without this, leaving Run simulation
 * cleared the bridge (placeholder text) until the user opened that page again.
 */
export function GlobalSimulationLogsBridge(): null {
  const { user, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const setSimulationLogsBridge = useSimulationLogsBridgeSetter();
  const [sessions, setSessions] = useState<SimulationSession[]>([]);
  const [clearingAll, setClearingAll] = useState(false);

  const refreshSessions = useCallback(async () => {
    if (!user) return;
    try {
      const list = await simulationApi.getAll();
      setSessions(sortSessions(list));
    } catch {
      setSessions([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    void refreshSessions();
  }, [user, pathname, refreshSessions]);

  const deleteSessionOffPage = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!window.confirm('Delete this simulation history?')) return;
      try {
        await simulationApi.delete(id);
        try {
          localStorage.removeItem(`simulationPersonaResults_${id}`);
          localStorage.removeItem(`simulationRunSummary_${id}`);
        } catch {
          /* ignore */
        }
        await refreshSessions();
      } catch (err) {
        console.error('Failed to delete simulation:', err);
        alert('Failed to delete simulation. Please try again.');
      }
    },
    [refreshSessions]
  );

  const clearAllOffPage = useCallback(async () => {
    if (!isAdmin || sessions.length === 0) return;
    const n = sessions.length;
    if (
      !window.confirm(
        `Delete all ${n} simulation log(s) for your account? This removes saved sessions and cached data in this browser. This cannot be undone.`
      )
    ) {
      return;
    }
    setClearingAll(true);
    try {
      const ids = sessions.map((s) => s.id);
      const results = await Promise.allSettled(ids.map((id) => simulationApi.delete(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      hardEvictAllSimulationLocalStorage();
      try {
        localStorage.removeItem('simulationActiveSessionId');
      } catch {
        /* ignore */
      }
      await refreshSessions();
      if (failed > 0) {
        alert(`${failed} of ${n} simulation(s) could not be deleted. Refresh and try again if needed.`);
      }
    } catch (err) {
      console.error('Failed to clear simulation logs:', err);
      alert('Failed to clear simulation logs. Please try again.');
    } finally {
      setClearingAll(false);
    }
  }, [isAdmin, sessions, refreshSessions]);

  const onSelectSession = useCallback(
    (s: SimulationSession) => {
      navigate(`/simulate?resumeSession=${encodeURIComponent(s.id)}`);
    },
    [navigate]
  );

  const bridgePayload = useMemo(() => {
    if (!user || pathname === '/simulate') return null;
    return {
      sessions,
      activeSessionId: null as string | null,
      onSelectSession,
      onDeleteSession: deleteSessionOffPage,
      onClearAll: clearAllOffPage,
      clearing: clearingAll,
      isAdmin,
    };
  }, [user, pathname, sessions, onSelectSession, deleteSessionOffPage, clearAllOffPage, clearingAll, isAdmin]);

  useLayoutEffect(() => {
    if (!user) {
      setSimulationLogsBridge(null);
      return;
    }
    if (pathname === '/simulate') {
      return;
    }
    if (!bridgePayload) {
      setSimulationLogsBridge(null);
      return;
    }
    setSimulationLogsBridge(bridgePayload);
  }, [user, pathname, bridgePayload, setSimulationLogsBridge]);

  return null;
}
