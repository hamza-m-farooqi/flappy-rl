from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.db.client import get_database


router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class ScoreSubmission(BaseModel):
    """Incoming score submission payload."""

    username: str = Field(min_length=1, max_length=32)
    score: int = Field(ge=0)


@router.get("")
async def list_leaderboard() -> dict[str, list[dict[str, Any]]]:
    """Return the top leaderboard scores."""
    collection = get_database()["leaderboard"]
    cursor = (
        collection.find({}, {"_id": 0})
        .sort("score", -1)
        .sort("created_at", 1)
        .limit(10)
    )
    scores = await cursor.to_list(length=10)
    return {"scores": scores}


@router.post("")
async def create_leaderboard_entry(payload: ScoreSubmission) -> dict[str, Any]:
    """Store a leaderboard score entry."""
    collection = get_database()["leaderboard"]
    document = {
        "username": payload.username.strip(),
        "score": payload.score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if not document["username"]:
        raise HTTPException(status_code=400, detail="Username cannot be empty.")

    await collection.insert_one(document)
    return {
        "username": document["username"],
        "score": document["score"],
        "created_at": document["created_at"],
    }
