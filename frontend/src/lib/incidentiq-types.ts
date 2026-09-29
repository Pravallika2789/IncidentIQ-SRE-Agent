export type OutcomeStatus =
  | "VERIFIED"
  | "WORKED"
  | "TEMPORARY"
  | "FAILED"
  | string;

export interface MemoryEvidence {
  incident_id: string;
  service: string;
  action: string;
  outcome: OutcomeStatus;
  detail?: string;
  type?: string;
  summary?: string;
  timestamp?: string;
}

export interface Recommendation {
  index?: number;
  title: string;
  change?: string;
  historical_success?: number;
  confidence?: number;
  evidence?: string[];
  why?: string;
}

export interface TriageResult {
  incident_id: string;
  service: string;
  severity: string;
  summary: string;
  root_cause: string;
  confidence?: number;
  evidence: MemoryEvidence[];
  recommendations: Recommendation[];
}

export interface TriageRequest {
  service: string;
  severity: string;
  alert: string;
  logs: string;
  memory_enabled: boolean;
}

/*
 * This matches the actual FastAPI /api/outcome endpoint.
 */
export interface OutcomeRequest {
  incident_id: string;
  service: string;
  action: string;
  outcome: string;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Pre-Deploy                                                                 */
/* -------------------------------------------------------------------------- */

export interface PredeployMemory {
  id: string;
  text: string;
  occurred_start?: string;
  occurred_end?: string;
  type?: string;
}

export interface RelatedDeployment {
  id?: string;
  outcome?: string;
  summary?: string;
}

export interface PredeployResult {
  /*
   * These are the names used by the frontend.
   * The API adapter converts the backend names into these names.
   */
  risk_level: string;
  risk_score: number;
  rationale?: string;

  supporting_incidents: string[];

  safeguards: string[];

  related_deployments?: RelatedDeployment[];

  /*
   * Real Hindsight information.
   */
  memories_recalled_before_filter?: number;
  relevant_memories_recalled?: number;

  memories_used?: PredeployMemory[];
}