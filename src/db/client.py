from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from src.config import get_mongodb_database, get_mongodb_uri

_client: AsyncIOMotorClient | None = None


def get_database() -> AsyncIOMotorDatabase:
    """Return the shared Motor database handle."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_mongodb_uri())
    return _client[get_mongodb_database()]
