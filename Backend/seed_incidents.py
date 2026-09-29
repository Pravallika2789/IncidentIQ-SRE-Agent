from app.hindsight_service import store_memory


# =========================================================
# INCIDENTIQ CONTROLLED TEST DATASET
# =========================================================
#
# This dataset is intentionally small and realistic.
#
# It contains:
# - Multiple services
# - Repeated incident patterns
# - Successful resolutions
# - Failed resolutions
# - Different root causes
#
# This lets us test whether IncidentIQ actually learns
# from Hindsight rather than relying on mock frontend data.
# =========================================================


INCIDENTS = [

    # =====================================================
    # PAYMENTS API
    # =====================================================

    """
Incident ID: INC-101

Service: payments-api

Severity: CRITICAL

Alert:
Database connection pool exhausted.

Logs:
HikariPool-1 - Connection is not available,
request timed out after 30000ms.
active=50 idle=0 waiting=317.

Root cause:
The database connection pool was too small for the
traffic level.

Resolution attempt:
Increase the database connection pool size from 50 to 100.

Outcome:
successful

Engineer notes:
The service recovered after increasing the database
connection pool size. HTTP 503 errors stopped and
request latency returned to normal.
""",

    """
Incident ID: INC-102

Service: payments-api

Severity: HIGH

Alert:
Database connection pool exhaustion.

Logs:
HikariPool-1 - Connection is not available.
active=50 idle=0 waiting=241.

Root cause:
The configured database connection pool was undersized
during a traffic spike.

Resolution attempt:
Increase the database connection pool size.

Outcome:
successful

Engineer notes:
Increasing the pool size restored database connectivity
and eliminated the connection timeout errors.
""",

    """
Incident ID: INC-103

Service: payments-api

Severity: HIGH

Alert:
Database connection pool exhausted.

Logs:
active=50 idle=0 waiting=180.
request timeout rate increased.

Root cause:
Database queries were running longer than expected,
causing connections to remain occupied.

Resolution attempt:
Restart the payments-api service.

Outcome:
failed

Engineer notes:
The restart temporarily cleared existing connections,
but connection pool exhaustion returned shortly afterward.
The restart did not permanently resolve the incident.
""",

    """
Incident ID: INC-104

Service: payments-api

Severity: MEDIUM

Alert:
High database latency.

Logs:
p95 database query latency increased to 4.8 seconds.

Root cause:
Long-running database queries were holding connections
for too long.

Resolution attempt:
Identify and terminate the long-running queries.

Outcome:
successful

Engineer notes:
Database latency returned to normal after the problematic
queries were terminated.
""",


    # =====================================================
    # AUTH SERVICE
    # =====================================================

    """
Incident ID: INC-201

Service: auth-service

Severity: HIGH

Alert:
JWT validation failures.

Logs:
JWT signature verification failed.
kid=auth-key-2026.
issuer mismatch.

Root cause:
The service was configured with an outdated JWT issuer URL.

Resolution attempt:
Update the JWT issuer configuration to the current
authentication authority.

Outcome:
successful

Engineer notes:
JWT validation errors stopped after updating the issuer
configuration.
""",

    """
Incident ID: INC-202

Service: auth-service

Severity: CRITICAL

Alert:
Authentication error rate above 30 percent.

Logs:
JWT signature verification failed.
Unknown signing key ID.
kid=auth-key-2026.

Root cause:
The authentication service did not have the current
signing key.

Resolution attempt:
Rotate and synchronize the JWT signing key.

Outcome:
successful

Engineer notes:
Authentication recovered after the signing key was
synchronized across the authentication services.
""",

    """
Incident ID: INC-203

Service: auth-service

Severity: HIGH

Alert:
JWT validation failures.

Logs:
issuer mismatch.
expected issuer=https://auth.incidentiq.internal
received issuer=https://legacy-auth.internal

Root cause:
The configured JWT issuer was incorrect.

Resolution attempt:
Restart the auth-service.

Outcome:
failed

Engineer notes:
Restarting the service did not change the incorrect
issuer configuration. Authentication failures continued.
""",


    # =====================================================
    # CHECKOUT SERVICE
    # =====================================================

    """
Incident ID: INC-301

Service: checkout-service

Severity: HIGH

Alert:
Checkout requests timing out.

Logs:
Database request timeout after 30000ms.
active connections=40.
waiting requests=122.

Root cause:
Database connection contention during peak traffic.

Resolution attempt:
Increase the checkout-service database connection pool
size.

Outcome:
successful

Engineer notes:
Increasing the connection pool reduced request waiting
time and checkout latency returned to normal.
""",

    """
Incident ID: INC-302

Service: checkout-service

Severity: HIGH

Alert:
Checkout latency increased.

Logs:
p99 latency=8.2 seconds.
database requests timing out.

Root cause:
Long-running database queries caused connection
contention.

Resolution attempt:
Restart the checkout-service.

Outcome:
failed

Engineer notes:
The restart provided only temporary relief. Database
contention returned within several minutes.
""",

    """
Incident ID: INC-303

Service: checkout-service

Severity: MEDIUM

Alert:
Checkout database latency.

Logs:
Multiple slow SQL queries detected.

Root cause:
A newly deployed query caused excessive database load.

Resolution attempt:
Rollback the latest deployment.

Outcome:
successful

Engineer notes:
Rolling back the deployment immediately reduced
database load and restored checkout latency.
""",


    # =====================================================
    # REDIS SESSION CACHE
    # =====================================================

    """
Incident ID: INC-401

Service: redis-session-cache

Severity: HIGH

Alert:
Redis latency increased.

Logs:
Redis p99 latency=450ms.
Memory usage=96 percent.

Root cause:
Redis memory pressure caused eviction and increased
latency.

Resolution attempt:
Increase Redis memory allocation.

Outcome:
successful

Engineer notes:
Increasing available Redis memory reduced eviction
pressure and latency returned to normal.
""",

    """
Incident ID: INC-402

Service: redis-session-cache

Severity: HIGH

Alert:
Session cache latency.

Logs:
Redis p99 latency=620ms.
Memory usage=97 percent.

Root cause:
Redis instance was approaching its memory limit.

Resolution attempt:
Restart Redis.

Outcome:
failed

Engineer notes:
The restart temporarily reduced memory usage, but the
same memory pressure returned shortly afterward.
""",


    # =====================================================
    # ORDERS DB
    # =====================================================

    """
Incident ID: INC-501

Service: orders-db

Severity: CRITICAL

Alert:
Database CPU saturation.

Logs:
CPU utilization=98 percent.
Query latency increased significantly.

Root cause:
A newly introduced query caused excessive database CPU
usage.

Resolution attempt:
Rollback the query-related deployment.

Outcome:
successful

Engineer notes:
CPU utilization dropped below 60 percent after rollback.
""",

    """
Incident ID: INC-502

Service: orders-db

Severity: HIGH

Alert:
Database CPU saturation.

Logs:
CPU utilization=95 percent.
Slow query count increased.

Root cause:
Inefficient query execution plan.

Resolution attempt:
Restart the database.

Outcome:
failed

Engineer notes:
Restarting the database did not resolve the inefficient
query. CPU saturation returned after traffic resumed.
""",


    # =====================================================
    # NOTIFICATION WORKER
    # =====================================================

    """
Incident ID: INC-601

Service: notification-worker

Severity: HIGH

Alert:
Kafka consumer lag increased.

Logs:
consumer lag=18500 messages.
worker throughput decreased.

Root cause:
Notification worker consumers were processing messages
too slowly.

Resolution attempt:
Increase the number of notification worker consumers.

Outcome:
successful

Engineer notes:
Increasing consumer capacity reduced Kafka lag and
restored normal processing throughput.
""",

    """
Incident ID: INC-602

Service: notification-worker

Severity: HIGH

Alert:
Kafka consumer lag.

Logs:
consumer lag=22000 messages.
worker CPU=45 percent.

Root cause:
A downstream notification provider was responding slowly.

Resolution attempt:
Increase the number of notification workers.

Outcome:
failed

Engineer notes:
Adding more workers did not solve the problem because
the downstream provider remained slow.
""",
]


# =========================================================
# SEED HINDSIGHT
# =========================================================


def main():

    print("=" * 70)
    print("IncidentIQ - Seeding Hindsight")
    print("=" * 70)

    successful = 0
    failed = 0

    for index, incident in enumerate(INCIDENTS, start=1):

        print()
        print(f"[{index}/{len(INCIDENTS)}] Storing incident...")

        try:
            result = store_memory(incident)

            print("✓ Stored successfully")
            print(f"  Hindsight result: {result}")

            successful += 1

        except Exception as exc:

            print("✗ Failed to store incident")
            print(f"  Error: {exc}")

            failed += 1

    print()
    print("=" * 70)
    print("SEEDING COMPLETE")
    print("=" * 70)
    print(f"Total incidents : {len(INCIDENTS)}")
    print(f"Stored          : {successful}")
    print(f"Failed          : {failed}")
    print("=" * 70)


if __name__ == "__main__":
    main()