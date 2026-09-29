import json
import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

from app.models import (
    PreDeployAnalysis,
    TriageAnalysis,
)


# =========================================================
# ENVIRONMENT
# =========================================================

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError(
        "GROQ_API_KEY was not found in Backend/.env"
    )


# =========================================================
# GROQ CLIENT
# =========================================================

client = Groq(api_key=api_key)

MODEL = "openai/gpt-oss-120b"


# =========================================================
# INCIDENT ANALYSIS
# =========================================================

def analyze_incident(
    incident: str,
    memories: str,
) -> TriageAnalysis:

    prompt = f"""
You are an SRE incident response assistant.

Analyze the current incident using the historical
Hindsight memories provided below.

IMPORTANT:
- Base your reasoning on the evidence.
- Do not invent historical incidents.
- Do not invent evidence IDs.
- Recommend practical actions an on-call engineer can take.
- Confidence must reflect how strongly the evidence
  supports the diagnosis.
- Historical success rates should only be estimated
  from explicit outcome information in the memories.
- If there is insufficient historical evidence, say so.

CURRENT INCIDENT:
{incident}

HISTORICAL HINDSIGHT MEMORIES:
{memories}
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a careful SRE incident "
                    "response assistant."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "triage_analysis",
                "schema": TriageAnalysis.model_json_schema(),
            },
        },
    )

    raw_result = json.loads(
        response.choices[0].message.content
    )

    return TriageAnalysis.model_validate(
        raw_result
    )


# =========================================================
# PRE-DEPLOY RISK ANALYSIS
# =========================================================

def analyze_predeploy(
    service: str,
    change: str,
    memories: str,
) -> PreDeployAnalysis:

    prompt = f"""
You are an SRE pre-deployment risk assessment assistant.

An engineer wants to deploy a proposed change to a
production service.

Use the historical Hindsight memories to determine
whether the proposed change has known risks.

CURRENT SERVICE:
{service}

PROPOSED CHANGE:
{change}

HISTORICAL HINDSIGHT MEMORIES:
{memories}

IMPORTANT RULES:

1. Base your assessment on the supplied evidence.

2. Do not invent historical incidents.

3. Do not invent historical deployments.

4. Do not claim that a change previously caused an
   incident unless the supplied memories support it.

5. If there is no relevant historical evidence,
   explicitly acknowledge that limitation.

6. Safeguards must be practical actions an SRE can
   take before or immediately after deployment.

7. HIGH means the historical evidence indicates
   meaningful deployment risk.

8. MEDIUM means there is some relevant evidence,
   uncertainty, or a potentially risky interaction.

9. LOW means there is little historical evidence
   indicating meaningful risk.

10. risk_score must be between 0 and 1.

11. Keep the rationale concise but evidence-based.

12. Do not fabricate incident IDs or deployment IDs.
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a cautious production "
                    "deployment risk analyst."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "predeploy_analysis",
                "schema": PreDeployAnalysis.model_json_schema(),
            },
        },
    )

    raw_result = json.loads(
        response.choices[0].message.content
    )

    return PreDeployAnalysis.model_validate(
        raw_result
    )