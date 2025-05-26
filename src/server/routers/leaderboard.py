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
    """Return the top leaderboard scores, keeping only each user's best run."""
    collection = get_database()["leaderboard"]
    pipeline = [
        {"$sort": {"username": 1, "score": -1, "created_at": 1}},
        {
            "$group": {
                "_id": "$username",
                "username": {"$first": "$username"},
                "score": {"$first": "$score"},
                "created_at": {"$first": "$created_at"},
            }
        },
        {"$sort": {"score": -1, "created_at": 1, "username": 1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "username": 1, "score": 1, "created_at": 1}},
    ]
    cursor = collection.aggregate(
        pipeline,
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
