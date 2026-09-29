from typing import Literal

from pydantic import BaseModel, Field


class Recommendation(BaseModel):
    action: str
    rationale: str
    historical_success_rate: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )
    drift_detected: bool = False
    evidence_ids: list[str] = []


class TriageAnalysis(BaseModel):
    summary: str
    root_cause: str
    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )
    recommendations: list[Recommendation]


class OutcomeRequest(BaseModel):
    incident_id: str
    service: str
    action: str
    outcome: str
    notes: str = ""


class PreDeployRequest(BaseModel):
    service: str
    change: str
    memory_enabled: bool = True


class PreDeployAnalysis(BaseModel):
    risk: Literal["HIGH", "MEDIUM", "LOW"]

    risk_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    rationale: str

    safeguards: list[str]