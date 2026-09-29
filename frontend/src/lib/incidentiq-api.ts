import type {
  MemoryEvidence,
  OutcomeRequest,
  PredeployResult,
  Recommendation,
  TriageRequest,
  TriageResult,
} from "./incidentiq-types";

export type ConnectionState =
  | "unknown"
  | "checking"
  | "online"
  | "offline";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "http" | "parse",
    readonly status?: number,
  ) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* Connection state                                                           */
/* -------------------------------------------------------------------------- */

let listener:
  | ((state: ConnectionState, message?: string) => void)
  | null = null;

export const onConnectionChange = (
  fn: typeof listener,
) => {
  listener = fn;
};

const base = (url: string) =>
  url.trim().replace(/\/$/, "");

/* -------------------------------------------------------------------------- */
/* Generic POST                                                               */
/* -------------------------------------------------------------------------- */

async function post<T>(
  backendUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${base(backendUrl)}${path}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    const message =
      `Could not reach the incident service at ${backendUrl}. ` +
      `Check that FastAPI is running.`;

    listener?.("offline", message);

    throw new ApiError(
      message,
      "network",
    );
  }

  listener?.("online");

  if (!response.ok) {
    const text = await response
      .text()
      .catch(() => "");

    let detail = text;

    try {
      const json = JSON.parse(text) as {
        detail?: unknown;
      };

      if (json.detail) {
        detail =
          typeof json.detail === "string"
            ? json.detail
            : JSON.stringify(json.detail);
      }
    } catch {
      /* Response was plain text. */
    }

    throw new ApiError(
      `The service answered ${response.status} for ${path}. ${detail.slice(
        0,
        300,
      )}`.trim(),
      "http",
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      `The service returned an unreadable response for ${path}.`,
      "parse",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Backend health                                                             */
/* -------------------------------------------------------------------------- */

export async function ping(
  backendUrl: string,
): Promise<boolean> {
  listener?.("checking");

  try {
    await fetch(
      `${base(backendUrl)}/openapi.json`,
      {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
      },
    );

    listener?.("online");

    return true;
  } catch {
    listener?.(
      "offline",
      `No answer from ${backendUrl}.`,
    );

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Backend response types                                                     */
/* -------------------------------------------------------------------------- */

type BackendHistoricalFact = {
  action: string;
  outcome: string;
  incident_id: string | null;
  evidence_ids: string[];
  evidence: string;
};

type BackendMemory = {
  id: string;
  text: string;
  occurred_start?: string;
  occurred_end?: string;
  type?: string;
};

type BackendRecommendation = {
  action: string;
  rationale: string;
  historical_success_rate:
    | number
    | null;
  drift_detected: boolean;
  evidence_ids: string[];
};

type BackendTriageResponse = {
  incident_id: string;
  service: string;
  severity: string;
  alert: string;

  memory_enabled: boolean;

  memories_recalled_before_filter: number;
  relevant_memories_recalled: number;

  analysis: {
    summary: string;
    root_cause: string;
    confidence: number;
    recommendations: BackendRecommendation[];
  };

  historical_facts: BackendHistoricalFact[];

  action_statistics: Record<
    string,
    {
      action: string;
      attempts: number;
      successful_incidents: number;
      failed_incidents: number;
      temporary_incidents: number;
      historical_success_rate: number;
      evidence_ids: string[];
    }
  >;

  memories_used: BackendMemory[];
};

/* -------------------------------------------------------------------------- */
/* Actual backend Pre-Deploy response                                        */
/* -------------------------------------------------------------------------- */

type BackendPredeployResponse = {
  risk: string;

  risk_score: number;

  rationale: string;

  safeguards: string[];

  related_incidents: string[];

  related_deployments: {
    id?: string;
    outcome?: string;
    summary?: string;
  }[];

  memories_recalled_before_filter?: number;

  relevant_memories_recalled?: number;

  memories_used?: BackendMemory[];
};

/* -------------------------------------------------------------------------- */
/* Triage helpers                                                             */
/* -------------------------------------------------------------------------- */

function extractIncidentId(
  fact: BackendHistoricalFact,
): string {
  if (fact.incident_id) {
    return fact.incident_id;
  }

  const match =
    fact.evidence?.match(/INC-\d+/i);

  if (match) {
    return match[0].toUpperCase();
  }

  return "HISTORICAL";
}

function normalizeOutcome(
  outcome: string,
): string {
  const value =
    outcome.toLowerCase();

  if (value.includes("success")) {
    return "VERIFIED";
  }

  if (value.includes("work")) {
    return "WORKED";
  }

  if (value.includes("temporary")) {
    return "TEMPORARY";
  }

  if (value.includes("fail")) {
    return "FAILED";
  }

  return outcome.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Historical evidence adapter                                                */
/* -------------------------------------------------------------------------- */

function adaptHistoricalEvidence(
  facts: BackendHistoricalFact[],
  memories: BackendMemory[],
): MemoryEvidence[] {
  const memoryById = new Map(
    memories.map((memory) => [
      memory.id,
      memory,
    ]),
  );

  return facts.map((fact) => {
    const relatedMemory =
      fact.evidence_ids
        .map((id) =>
          memoryById.get(id),
        )
        .find(Boolean);

    return {
      incident_id:
        extractIncidentId(fact),

      /*
       * The backend already filters these memories
       * by service, so the service is not required
       * by the graph.
       */
      service: "",

      action: fact.action,

      outcome:
        normalizeOutcome(
          fact.outcome,
        ),

      detail: fact.evidence,

      summary: fact.evidence,

      timestamp:
        relatedMemory?.occurred_start,

      type:
        relatedMemory?.type ??
        "historical_fact",
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Recommendation adapter                                                    */
/* -------------------------------------------------------------------------- */

function adaptRecommendations(
  recommendations: BackendRecommendation[],
  historicalFacts: BackendHistoricalFact[],
  confidence: number,
): Recommendation[] {
  return recommendations.map(
    (recommendation, index) => {
      /*
       * Backend returns Hindsight UUIDs.
       *
       * Frontend graph wants incident IDs.
       *
       * UUID
       *   ↓
       * historical fact
       *   ↓
       * INC-001 / INC-103 / etc.
       */

      const supportingIncidents =
        historicalFacts
          .filter((fact) =>
            fact.evidence_ids.some(
              (id) =>
                recommendation.evidence_ids.includes(
                  id,
                ),
            ),
          )
          .map((fact) =>
            extractIncidentId(fact),
          )
          .filter(
            (id, i, array) =>
              array.indexOf(id) === i,
          );

      return {
        index: index + 1,

        title:
          recommendation.action,

        change:
          recommendation.action,

        historical_success:
          recommendation
            .historical_success_rate ??
          undefined,

        confidence,

        evidence:
          supportingIncidents,

        why:
          recommendation.rationale,
      };
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Triage response adapter                                                    */
/* -------------------------------------------------------------------------- */

function adaptTriageResponse(
  raw: BackendTriageResponse,
): TriageResult {
  const confidence =
    raw.analysis?.confidence ?? 0;

  const evidence =
    adaptHistoricalEvidence(
      raw.historical_facts ?? [],
      raw.memories_used ?? [],
    );

  const recommendations =
    adaptRecommendations(
      raw.analysis
        ?.recommendations ?? [],
      raw.historical_facts ?? [],
      confidence,
    );

  return {
    incident_id:
      raw.incident_id,

    service:
      raw.service,

    severity:
      raw.severity,

    summary:
      raw.analysis?.summary ?? "",

    root_cause:
      raw.analysis?.root_cause ?? "",

    confidence,

    evidence,

    recommendations,
  };
}

/* -------------------------------------------------------------------------- */
/* Pre-Deploy response adapter                                                */
/* -------------------------------------------------------------------------- */

function adaptPredeployResponse(
  raw: BackendPredeployResponse,
): PredeployResult {
  return {
    /*
     * Backend:
     *   risk
     *
     * Frontend:
     *   risk_level
     */
    risk_level:
      raw.risk ?? "UNKNOWN",

    risk_score:
      raw.risk_score ?? 0,

    rationale:
      raw.rationale ?? "",

    /*
     * Backend:
     *   related_incidents
     *
     * Frontend:
     *   supporting_incidents
     */
    supporting_incidents:
      raw.related_incidents ?? [],

    safeguards:
      raw.safeguards ?? [],

    related_deployments:
      raw.related_deployments ?? [],

    memories_recalled_before_filter:
      raw.memories_recalled_before_filter,

    relevant_memories_recalled:
      raw.relevant_memories_recalled,

    memories_used:
      raw.memories_used ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* TRIAGE                                                                     */
/* -------------------------------------------------------------------------- */

export async function triage(
  backendUrl: string,
  body: TriageRequest,
): Promise<TriageResult> {
  const raw =
    await post<BackendTriageResponse>(
      backendUrl,
      "/api/triage",
      body,
    );

  return adaptTriageResponse(raw);
}

/* -------------------------------------------------------------------------- */
/* OUTCOME                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * IMPORTANT:
 *
 * This matches the actual FastAPI backend:
 *
 * {
 *   incident_id,
 *   service,
 *   action,
 *   outcome,
 *   notes
 * }
 *
 * Do NOT send:
 *
 * recommendation
 * result
 * memory_enabled
 */

export async function submitOutcome(
  backendUrl: string,
  body: OutcomeRequest,
) {
  return post<{ ok?: boolean }>(
    backendUrl,
    "/api/outcome",
    body,
  );
}

/* -------------------------------------------------------------------------- */
/* PRE-DEPLOY                                                                 */
/* -------------------------------------------------------------------------- */

export async function predeploy(
  backendUrl: string,
  body: {
    service: string;
    change: string;
    memory_enabled: boolean;
  },
): Promise<PredeployResult> {
  const raw =
    await post<BackendPredeployResponse>(
      backendUrl,
      "/api/predeploy",
      body,
    );

  return adaptPredeployResponse(raw);
}