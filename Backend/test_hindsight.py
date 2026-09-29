from app.hindsight_service import store_memory, search_memory


print("Storing test incident...")

result = store_memory(
    """
    Incident INC-001 affected the payments-api service.
    The service experienced HTTP 503 errors because the database
    connection pool was exhausted after a sudden traffic spike.
    Restarting the service temporarily restored availability.
    Increasing the database connection pool size and adding connection
    timeout monitoring resolved the issue permanently.
    The resolution was successful.
    """
)

print("Memory stored!")
print(result)

print("\nSearching memory...")

results = search_memory(
    "What happened when payments-api had database connection pool exhaustion?"
)

print("\nRelevant memories:")

for memory in results.results:
    print("-", memory.text)