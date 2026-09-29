from uuid import uuid4
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.hindsight_service import (
    search_memory,
    store_memory,
)

from app.groq_service import (
    analyze_incident,
    analyze_predeploy,
)

from app.incident_analysis import (
    extract_historical_facts,
    calculate_action_statistics,
)

from app.models import (
    OutcomeRequest,
    PreDeployRequest,
)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="IncidentIQ API",
    description="Backend for the IncidentIQ SRE Incident Response Agent",
    version="0.1.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# TRIAGE REQUEST
# =========================================================

class TriageRequest(BaseModel):
    service: str
    severity: str
    alert: str
    logs: str = ""
    memory_enabled: bool = True


# =========================================================
# MEMORY RELEVANCE
# =========================================================

def memory_matches_service(
    memory,
    service: str,
) -> bool:

    service = service.strip().lower()

    if not service:
        return False

    memory_text = (
        getattr(memory, "text", "")
        or ""
    )

    memory_text_lower = memory_text.lower()

    # Service: payments-api
    service_pattern = (
        rf"\bservice\s*:\s*"
        rf"{re.escape(service)}\b"
    )

    if re.search(
        service_pattern,
        memory_text_lower,
    ):
        return True

    # "the payments-api service"
    service_phrase_pattern = (
        rf"\b{re.escape(service)}\s+service\b"
    )

    if re.search(
        service_phrase_pattern,
        memory_text_lower,
    ):
        return True

    # Standalone service name
    if re.search(
        rf"(?<![a-z0-9_-])"
        rf"{re.escape(service)}"
        rf"(?![a-z0-9_-])",
        memory_text_lower,
    ):
        return True

    return False


def filter_memories_by_service(
    memories: list,
    service: str,
) -> list:

    return [
        memory
        for memory in memories
        if memory_matches_service(
            memory,
            service,
        )
    ]


# =========================================================
# MEMORY TEXT
# =========================================================

def build_memory_text(
    memories: list,
) -> str:

    if not memories:
        return """
No relevant historical Hindsight memories were found.

Do not claim that previous incidents or deployments
existed.

Do not invent historical success rates.

Do not invent evidence IDs.

Reason only from the current input.
"""

    blocks = []

    for memory in memories:

        memory_id = getattr(
            memory,
            "id",
            "unknown",
        )

        memory_type = getattr(
            memory,
            "type",
            "unknown",
        )

        memory_text = getattr(
            memory,
            "text",
            "",
        )

        blocks.append(
            f"""
Memory ID: {memory_id}
Memory Type: {memory_type}
Content:
{memory_text}
"""
        )

    return "\n".join(blocks)


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "service": "incidentiq-backend",
    }


# =========================================================
# TRIAGE
# =========================================================

@app.post("/api/triage")
def triage_incident(
    request: TriageRequest,
):

    incident_id = (
        f"INC-{uuid4().hex[:8].upper()}"
    )

    incident_text = f"""
Incident ID: {incident_id}

Service: {request.service}
Severity: {request.severity}
Alert: {request.alert}
Logs: {request.logs}
"""

    recalled_memories = []
    all_recalled_memories = []

    # -----------------------------------------------------
    # HINDSIGHT
    # -----------------------------------------------------

    if request.memory_enabled:

        query = f"""
Service: {request.service}
Severity: {request.severity}
Alert: {request.alert}
Logs: {request.logs}
"""

        hindsight_response = search_memory(
            query
        )

        all_recalled_memories = getattr(
            hindsight_response,
            "results",
            [],
        )

        recalled_memories = (
            filter_memories_by_service(
                all_recalled_memories,
                request.service,
            )
        )

    # -----------------------------------------------------
    # HISTORICAL FACTS
    # -----------------------------------------------------

    historical_facts = (
        extract_historical_facts(
            recalled_memories
        )
    )

    action_statistics = (
        calculate_action_statistics(
            historical_facts
        )
    )

    memory_text = build_memory_text(
        recalled_memories
    )

    # -----------------------------------------------------
    # GROQ
    # -----------------------------------------------------

    analysis = analyze_incident(
        incident=incident_text,
        memories=memory_text,
    )

    # -----------------------------------------------------
    # TRUST BACKEND STATISTICS
    # -----------------------------------------------------

    for recommendation in (
        analysis.recommendations
    ):

        recommendation.historical_success_rate = None
        recommendation.evidence_ids = []

        if not request.memory_enabled:
            continue

        action_text = (
            recommendation.action.lower()
        )

        matched_statistics = None

        for (
            action,
            statistics,
        ) in action_statistics.items():

            action_lower = action.lower()

            if (
                "restart" in action_text
                and "restart" in action_lower
            ):
                matched_statistics = statistics
                break

            if (
                "connection pool"
                in action_text
                and
                "connection pool"
                in action_lower
            ):
                matched_statistics = statistics
                break

            if (
                "timeout" in action_text
                and "timeout" in action_lower
            ):
                matched_statistics = statistics
                break

        if matched_statistics:

            recommendation.historical_success_rate = (
                matched_statistics[
                    "historical_success_rate"
                ]
            )

            recommendation.evidence_ids = (
                matched_statistics[
                    "evidence_ids"
                ]
            )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "incident_id": incident_id,
        "service": request.service,
        "severity": request.severity,
        "alert": request.alert,
        "memory_enabled": request.memory_enabled,

        "memories_recalled_before_filter": (
            len(all_recalled_memories)
            if request.memory_enabled
            else 0
        ),

        "relevant_memories_recalled": len(
            recalled_memories
        ),

        "analysis": analysis.model_dump(),

        "historical_facts": historical_facts,

        "action_statistics": action_statistics,

        "memories_used": [
            {
                "id": getattr(
                    memory,
                    "id",
                    "unknown",
                ),
                "text": getattr(
                    memory,
                    "text",
                    "",
                ),
                "occurred_start": getattr(
                    memory,
                    "occurred_start",
                    None,
                ),
                "occurred_end": getattr(
                    memory,
                    "occurred_end",
                    None,
                ),
                "type": getattr(
                    memory,
                    "type",
                    "unknown",
                ),
            }
            for memory in recalled_memories
        ],
    }


# =========================================================
# PRE-DEPLOY
# =========================================================

@app.post("/api/predeploy")
def predeploy_risk(
    request: PreDeployRequest,
):

    # -----------------------------------------------------
    # MEMORY OFF
    #
    # Do NOT call Hindsight.
    # -----------------------------------------------------

    all_recalled_memories = []
    relevant_memories = []

    if request.memory_enabled:

        query = f"""
Service: {request.service}

Proposed deployment change:
{request.change}

Find historical incidents, deployments,
outcomes, postmortems, and runbooks related
to this service and proposed change.
"""

        hindsight_response = search_memory(
            query
        )

        all_recalled_memories = getattr(
            hindsight_response,
            "results",
            [],
        )

        relevant_memories = (
            filter_memories_by_service(
                all_recalled_memories,
                request.service,
            )
        )

    # -----------------------------------------------------
    # GROQ
    # -----------------------------------------------------

    memory_text = build_memory_text(
        relevant_memories
    )

    analysis = analyze_predeploy(
        service=request.service,
        change=request.change,
        memories=memory_text,
    )

    # -----------------------------------------------------
    # EXTRACT REFERENCES
    # -----------------------------------------------------

    related_incidents = []
    related_deployments = []

    for memory in relevant_memories:

        text = (
            getattr(
                memory,
                "text",
                "",
            )
            or ""
        )

        incident_ids = re.findall(
            r"\bINC-\d+\b",
            text,
            flags=re.IGNORECASE,
        )

        deployment_ids = re.findall(
            r"\bDEPLOY-\d+\b",
            text,
            flags=re.IGNORECASE,
        )

        for incident_id in incident_ids:

            incident_id = incident_id.upper()

            if incident_id not in related_incidents:
                related_incidents.append(
                    incident_id
                )

        for deployment_id in deployment_ids:

            deployment_id = deployment_id.upper()

            if (
                deployment_id
                not in related_deployments
            ):
                related_deployments.append(
                    deployment_id
                )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "service": request.service,

        "change": request.change,

        "memory_enabled": request.memory_enabled,

        "risk": analysis.risk,

        "risk_score": analysis.risk_score,

        "rationale": analysis.rationale,

        "related_incidents": (
            related_incidents
        ),

        "related_deployments": (
            related_deployments
        ),

        "safeguards": analysis.safeguards,

        "memories_recalled_before_filter": (
            len(all_recalled_memories)
            if request.memory_enabled
            else 0
        ),

        "relevant_memories_recalled": (
            len(relevant_memories)
        ),

        "memories_used": [
            {
                "id": getattr(
                    memory,
                    "id",
                    "unknown",
                ),
                "text": getattr(
                    memory,
                    "text",
                    "",
                ),
                "type": getattr(
                    memory,
                    "type",
                    "unknown",
                ),
                "occurred_start": getattr(
                    memory,
                    "occurred_start",
                    None,
                ),
            }
            for memory in relevant_memories
        ],
    }


# =========================================================
# OUTCOME
# =========================================================

@app.post("/api/outcome")
def record_outcome(
    request: OutcomeRequest,
):

    normalized_outcome = (
        request.outcome
        .lower()
        .strip()
    )

    if normalized_outcome == "worked":

        outcome_description = "successful"

    elif normalized_outcome == "failed":

        outcome_description = "failed"

    elif normalized_outcome == "partial":

        outcome_description = "temporary"

    else:

        outcome_description = (
            normalized_outcome
        )

    outcome_memory = f"""
Incident {request.incident_id} affected the
{request.service} service.

Resolution attempt:
{request.action}

Outcome:
{outcome_description}

Engineer notes:
{request.notes}

Interpretation:
The engineer marked this resolution attempt as
{outcome_description}.
"""

    result = store_memory(
        outcome_memory
    )

    return {
        "status": "recorded",
        "incident_id": request.incident_id,
        "service": request.service,
        "action": request.action,
        "outcome": normalized_outcome,
        "stored_outcome": outcome_description,
        "memory": outcome_memory,
        "hindsight_result": str(result),
    }