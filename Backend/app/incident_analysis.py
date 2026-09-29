import re


def extract_incident_id(text: str):
    """
    Extract an incident ID such as INC-001 from memory text.
    """

    match = re.search(
        r"\bINC-\d+\b",
        text.upper()
    )

    if match:
        return match.group(0)

    return None


def normalize_action(action: str):
    """
    Normalize different descriptions of the same action
    so they are grouped into the same statistics.

    Example:
        "Increase the database connection pool size"
        "increasing the database connection pool size"

    Both become:
        "increase database connection pool size"
    """

    action_lower = action.lower().strip()

    # Database connection pool
    if "connection pool" in action_lower:

        return "increase database connection pool size"

    # Restart
    if "restart" in action_lower:

        return "restart service"

    # Connection timeout monitoring
    if (
        "timeout monitoring" in action_lower
        or "connection-timeout monitoring" in action_lower
    ):

        return "add connection timeout monitoring"

    return action_lower


def extract_resolution_attempt(text: str):
    """
    Extract the resolution action from different Hindsight
    memory representations.

    Structured format:

        Resolution attempt:
        Increase database connection pool size

        Outcome:
        successful

    Natural-language Hindsight format:

        The engineer resolved incident INC-002 by increasing
        the database connection pool size, which eliminated
        HTTP 503 errors.
    """

    # ---------------------------------------------------------
    # 1. Structured engineer outcome memory
    # ---------------------------------------------------------

    match = re.search(
        r"Resolution attempt:\s*(.*?)\s*Outcome:",
        text,
        re.IGNORECASE | re.DOTALL
    )

    if match:

        return normalize_action(
            match.group(1).strip()
        )

    # ---------------------------------------------------------
    # 2. Natural-language engineer outcome
    # ---------------------------------------------------------

    match = re.search(
        r"resolved incident\s+INC-\d+\s+by\s+(.+?)(?:,\s*which|\.|\|)",
        text,
        re.IGNORECASE
    )

    if match:

        action = match.group(1).strip()

        return normalize_action(action)

    return None


def extract_engineer_outcome(text: str):
    """
    Detect explicit or natural-language engineer-confirmed
    outcomes.

    Supported structured format:

        Outcome:
        successful

    Also supports Hindsight-generated representations such as:

        The engineer resolved incident INC-002 by increasing
        the database connection pool size...
    """

    text_lower = text.lower()

    # ---------------------------------------------------------
    # 1. Explicit structured outcome
    # ---------------------------------------------------------

    match = re.search(
        r"Outcome:\s*([a-zA-Z_-]+)",
        text,
        re.IGNORECASE
    )

    if match:

        outcome = match.group(1).lower().strip()

        if outcome in {
            "successful",
            "success",
            "worked"
        }:
            return "successful"

        if outcome in {
            "failed",
            "failure",
            "unsuccessful"
        }:
            return "failed"

        if outcome in {
            "temporary",
            "temporarily"
        }:
            return "temporary"

    # ---------------------------------------------------------
    # 2. Hindsight natural-language successful outcome
    # ---------------------------------------------------------

    if (
        "engineer resolved incident" in text_lower
        and "by increasing the database connection pool size"
        in text_lower
    ):
        return "successful"

    # ---------------------------------------------------------
    # 3. Other successful wording
    # ---------------------------------------------------------

    if (
        "successfully stopped" in text_lower
        or "successfully resolved" in text_lower
        or "resolved by increasing" in text_lower
    ):
        return "successful"

    return None


def extract_historical_facts(memories):
    """
    Extract explicit historical outcome facts from Hindsight.

    Handles:

    1. Historical incident/postmortem memories
    2. Engineer-confirmed outcome memories
    3. Temporary mitigations
    4. Failed attempts

    Duplicate Hindsight representations are merged.
    """

    facts_by_key = {}

    # =========================================================
    # First pass:
    # Find incident IDs appearing in recalled memories.
    # =========================================================

    known_incident_ids = []

    for memory in memories:

        incident_id = extract_incident_id(
            memory.text
        )

        if (
            incident_id
            and incident_id not in known_incident_ids
        ):

            known_incident_ids.append(
                incident_id
            )

    # If exactly one incident appears in the recalled
    # evidence, memories without an explicit ID can be
    # associated with that incident.
    default_incident_id = (
        known_incident_ids[0]
        if len(known_incident_ids) == 1
        else None
    )

    # =========================================================
    # Second pass:
    # Extract historical facts.
    # =========================================================

    for memory in memories:

        text = memory.text
        text_lower = text.lower()

        incident_id = extract_incident_id(
            text
        )

        # -----------------------------------------------------
        # Associate ID-less memory with the only known incident
        # when there is exactly one.
        # -----------------------------------------------------

        if incident_id is None:

            incident_id = default_incident_id

        # =====================================================
        # 1. Engineer-confirmed outcome memory
        # =====================================================

        engineer_outcome = extract_engineer_outcome(
            text
        )

        if engineer_outcome:

            action = extract_resolution_attempt(
                text
            )

            if action:

                key = (
                    incident_id,
                    action,
                    engineer_outcome
                )

                if key not in facts_by_key:

                    facts_by_key[key] = {
                        "action": action,
                        "outcome": engineer_outcome,
                        "incident_id": incident_id,
                        "evidence_ids": [],
                        "evidence": text
                    }

                facts_by_key[key][
                    "evidence_ids"
                ].append(
                    memory.id
                )

                # We already processed this memory.
                continue

        # =====================================================
        # 2. Temporary mitigation
        # =====================================================

        if (
            "temporarily restored" in text_lower
            or "temporary mitigation" in text_lower
        ):

            action = extract_action_from_temporary(
                text
            )

            key = (
                incident_id,
                action,
                "temporary"
            )

            if key not in facts_by_key:

                facts_by_key[key] = {
                    "action": action,
                    "outcome": "temporary",
                    "incident_id": incident_id,
                    "evidence_ids": [],
                    "evidence": text
                }

            facts_by_key[key][
                "evidence_ids"
            ].append(
                memory.id
            )

        # =====================================================
        # 3. Permanent resolution
        # =====================================================

        if (
            "permanently resolved" in text_lower
            or "permanent resolution" in text_lower
        ):

            actions = extract_permanent_actions(
                text
            )

            for action in actions:

                key = (
                    incident_id,
                    action,
                    "successful"
                )

                if key not in facts_by_key:

                    facts_by_key[key] = {
                        "action": action,
                        "outcome": "successful",
                        "incident_id": incident_id,
                        "evidence_ids": [],
                        "evidence": text
                    }

                facts_by_key[key][
                    "evidence_ids"
                ].append(
                    memory.id
                )

        # =====================================================
        # 4. Failed attempt
        # =====================================================

        if (
            "failed" in text_lower
            or "unsuccessful" in text_lower
        ):

            action = extract_failed_action(
                text
            )

            key = (
                incident_id,
                action,
                "failed"
            )

            if key not in facts_by_key:

                facts_by_key[key] = {
                    "action": action,
                    "outcome": "failed",
                    "incident_id": incident_id,
                    "evidence_ids": [],
                    "evidence": text
                }

            facts_by_key[key][
                "evidence_ids"
            ].append(
                memory.id
            )

    # =========================================================
    # Remove duplicate evidence IDs.
    # =========================================================

    facts = []

    for fact in facts_by_key.values():

        fact["evidence_ids"] = list(
            dict.fromkeys(
                fact["evidence_ids"]
            )
        )

        facts.append(
            fact
        )

    return facts


def extract_action_from_temporary(text: str):
    """
    Extract the temporary action from known incident wording.
    """

    text_lower = text.lower()

    if "restart" in text_lower:

        return "restart service"

    return "temporary mitigation"


def extract_permanent_actions(text: str):
    """
    Extract permanent actions from known incident wording.
    """

    text_lower = text.lower()

    actions = []

    # ---------------------------------------------------------
    # Database connection pool
    # ---------------------------------------------------------

    if "connection pool" in text_lower:

        actions.append(
            "increase database connection pool size"
        )

    # ---------------------------------------------------------
    # Connection timeout monitoring
    # ---------------------------------------------------------

    if "connection timeout" in text_lower:

        actions.append(
            "add connection timeout monitoring"
        )

    # ---------------------------------------------------------
    # Fallback
    # ---------------------------------------------------------

    if not actions:

        actions.append(
            "permanent resolution"
        )

    return actions


def extract_failed_action(text: str):
    """
    Extract the action associated with a failed attempt.
    """

    text_lower = text.lower()

    if "restart" in text_lower:

        return "restart service"

    if "connection pool" in text_lower:

        return "database connection pool change"

    if "timeout" in text_lower:

        return "connection timeout monitoring"

    return "unknown attempt"


def calculate_action_statistics(historical_facts):
    """
    Calculate outcome statistics from explicit historical facts.

    Each incident is counted only once for a particular action,
    regardless of how many Hindsight memories describe it.
    """

    statistics = {}

    for fact in historical_facts:

        action = fact["action"]
        incident_id = fact["incident_id"]

        # -----------------------------------------------------
        # Create statistics bucket for this action.
        # -----------------------------------------------------

        if action not in statistics:

            statistics[action] = {
                "action": action,
                "attempts": set(),
                "successful_incidents": set(),
                "failed_incidents": set(),
                "temporary_incidents": set(),
                "evidence_ids": []
            }

        data = statistics[action]

        # -----------------------------------------------------
        # Count the incident as an attempt.
        # -----------------------------------------------------

        if incident_id:

            data["attempts"].add(
                incident_id
            )

        # -----------------------------------------------------
        # Successful attempt.
        # -----------------------------------------------------

        if fact["outcome"] == "successful":

            if incident_id:

                data[
                    "successful_incidents"
                ].add(
                    incident_id
                )

        # -----------------------------------------------------
        # Failed attempt.
        # -----------------------------------------------------

        elif fact["outcome"] == "failed":

            if incident_id:

                data[
                    "failed_incidents"
                ].add(
                    incident_id
                )

        # -----------------------------------------------------
        # Temporary mitigation.
        # -----------------------------------------------------

        elif fact["outcome"] == "temporary":

            if incident_id:

                data[
                    "temporary_incidents"
                ].add(
                    incident_id
                )

        # -----------------------------------------------------
        # Store evidence IDs.
        # -----------------------------------------------------

        data[
            "evidence_ids"
        ].extend(
            fact["evidence_ids"]
        )

    # =========================================================
    # Convert sets into JSON-friendly statistics.
    # =========================================================

    results = {}

    for action, data in statistics.items():

        attempts = len(
            data["attempts"]
        )

        successful = len(
            data["successful_incidents"]
        )

        # -----------------------------------------------------
        # Calculate success rate.
        # -----------------------------------------------------

        if attempts > 0:

            success_rate = (
                successful / attempts
            )

        else:

            success_rate = None

        results[action] = {

            "action": action,

            "attempts": attempts,

            "successful_incidents": successful,

            "failed_incidents": len(
                data["failed_incidents"]
            ),

            "temporary_incidents": len(
                data["temporary_incidents"]
            ),

            "historical_success_rate": (
                success_rate
            ),

            "evidence_ids": list(
                dict.fromkeys(
                    data["evidence_ids"]
                )
            )
        }

    return results