import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MemoryEvidence } from "./incidentiq-types";
import { onConnectionChange, ping, type ConnectionState } from "./incidentiq-api";

/** A memory actually returned by /api/triage, tagged with the incident that recalled it. */
export interface RecalledMemory extends MemoryEvidence {
  recalledBy: string;
  recalledAt: string;
}

export const DEFAULT_BACKEND = "http://127.0.0.1:8000";

interface Settings {
  backendUrl: string;
  memoryEnabled: boolean;
}

/** Real events produced by this browser session's API calls — never fabricated. */
export interface ActivityEntry {
  at: string;
  incidentId: string;
  service: string;
  severity?: string;
  headline: string;
  outcome?: string;
}

interface Store extends Settings {
  setBackendUrl: (v: string) => void;
  setMemoryEnabled: (v: boolean) => void;
  connection: ConnectionState;
  connectionMessage: string | null;
  checkConnection: () => Promise<boolean>;
  activity: ActivityEntry[];
  logActivity: (entry: ActivityEntry) => void;
  clearActivity: () => void;
  recalled: RecalledMemory[];
  logRecalled: (items: RecalledMemory[]) => void;
}

// Kept on globalThis so hot reloads of this file reuse the same context
// instead of splitting provider and consumers across two instances.
const g = globalThis as { __incidentiqCtx?: React.Context<Store | null> };
const StoreContext = (g.__incidentiqCtx ??= createContext<Store | null>(null));
const KEY = "incidentiq.settings";
const LOG_KEY = "incidentiq.activity";
const MEM_KEY = "incidentiq.recalled";

export function IncidentIQProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    backendUrl: DEFAULT_BACKEND,
    memoryEnabled: true,
  });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [recalled, setRecalled] = useState<RecalledMemory[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("unknown");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  useEffect(() => {
    onConnectionChange((s, m) => {
      setConnection(s);
      setConnectionMessage(m ?? null);
    });
    return () => onConnectionChange(null);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Settings> & { demoMode?: unknown };
        setSettings((s) => ({
          backendUrl: typeof p.backendUrl === "string" ? p.backendUrl : s.backendUrl,
          memoryEnabled: typeof p.memoryEnabled === "boolean" ? p.memoryEnabled : s.memoryEnabled,
        }));
      }
      // Entries flagged `demo` came from the removed sample mode — never show them as real.
      const real = <T,>(xs: T[]) => xs.filter((x) => !(x as { demo?: boolean }).demo);
      const log = localStorage.getItem(LOG_KEY);
      if (log) {
        const a = real(JSON.parse(log) as ActivityEntry[]);
        setActivity(a);
        localStorage.setItem(LOG_KEY, JSON.stringify(a));
      }
      const mem = localStorage.getItem(MEM_KEY);
      if (mem) {
        const m = real(JSON.parse(mem) as RecalledMemory[]);
        setRecalled(m);
        localStorage.setItem(MEM_KEY, JSON.stringify(m));
      }
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  // Check reachability on load and whenever the service address changes.
  useEffect(() => {
    const t = setTimeout(() => void ping(settings.backendUrl), 150);
    return () => clearTimeout(t);
  }, [settings.backendUrl]);

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const logActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => {
      const next = [entry, ...prev.filter((e) => e.incidentId !== entry.incidentId)].slice(0, 12);
      try {
        localStorage.setItem(LOG_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const logRecalled = useCallback((items: RecalledMemory[]) => {
    setRecalled((prev) => {
      const key = (m: RecalledMemory) => `${m.incident_id}|${m.action}`;
      const fresh = new Set(items.map(key));
      const next = [...items, ...prev.filter((m) => !fresh.has(key(m)))].slice(0, 60);
      try {
        localStorage.setItem(MEM_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearActivity = useCallback(() => {
    setActivity([]);
    setRecalled([]);
    try {
      localStorage.removeItem(LOG_KEY);
      localStorage.removeItem(MEM_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...settings,
      setBackendUrl: (backendUrl) => patch({ backendUrl }),
      setMemoryEnabled: (memoryEnabled) => patch({ memoryEnabled }),
      connection,
      connectionMessage,
      checkConnection: () => ping(settings.backendUrl),
      activity,
      logActivity,
      clearActivity,
      recalled,
      logRecalled,
    }),
    [settings, patch, activity, logActivity, clearActivity, recalled, logRecalled, connection, connectionMessage],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useIncidentIQ(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useIncidentIQ must be used inside IncidentIQProvider");
  return ctx;
}
