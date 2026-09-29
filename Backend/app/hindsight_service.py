import os

from dotenv import load_dotenv
from hindsight_client import Hindsight


load_dotenv()

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv(
    "HINDSIGHT_BASE_URL",
    "https://api.hindsight.vectorize.io"
)
HINDSIGHT_BANK_ID = os.getenv(
    "HINDSIGHT_BANK_ID",
    "incidentiq-sre"
)

if not HINDSIGHT_API_KEY:
    raise ValueError("HINDSIGHT_API_KEY is not set")


client = Hindsight(
    base_url=HINDSIGHT_BASE_URL,
    api_key=HINDSIGHT_API_KEY
)


def store_memory(content: str):
    return client.retain(
        bank_id=HINDSIGHT_BANK_ID,
        content=content
    )


def search_memory(query: str):
    return client.recall(
        bank_id=HINDSIGHT_BANK_ID,
        query=query
    )