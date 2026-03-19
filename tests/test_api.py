from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from fastapi.testclient import TestClient

from src.server.app import create_app


class FakeCursor:
    def __init__(self, rows: Iterable[dict[str, Any]]) -> None:
        self._rows = list(rows)

    async def to_list(self, length: int) -> list[dict[str, Any]]:
        return self._rows[:length]


class FakeCollection:
    def __init__(self) -> None:
        self.documents = [
            {
                "username": "hamza",
                "score": 7,
                "created_at": "2026-03-15T00:00:00+00:00",
            }
        ]

    def aggregate(self, pipeline: list[dict[str, Any]]) -> FakeCursor:
        del pipeline
        return FakeCursor(self.documents)

    async def insert_one(self, document: dict[str, Any]) -> None:
        self.documents.append(document)


class FakeDatabase:
    def __init__(self) -> None:
        self.leaderboard = FakeCollection()

    def __getitem__(self, name: str) -> FakeCollection:
        if name != "leaderboard":
            raise KeyError(name)
        return self.leaderboard


def test_root_and_health_endpoints_return_200() -> None:
    client = TestClient(create_app())

    root = client.get("/")
    health = client.get("/health")

    assert root.status_code == 200
    assert root.json() == {"status": "online", "project": "flappy-rl"}
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}


def test_training_status_schema(monkeypatch: Any) -> None:
    from src.server import app as app_module

    monkeypatch.setattr(
        app_module.training_manager,
        "status",
        lambda: {
            "is_running": False,
            "active_run_names": [],
            "runs": [],
            "champions": [],
        },
    )
    client = TestClient(create_app())

    response = client.get("/training/status")

    assert response.status_code == 200
    assert response.json() == {"is_running": False, "active_run_names": []}


def test_game_state_schema() -> None:
    client = TestClient(create_app())

    response = client.get("/game/state")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) >= {
        "frame",
        "score",
        "game_over",
        "bird",
        "birds",
        "pipes",
        "world",
        "alive_count",
        "total_birds",
    }
    assert set(payload["bird"]) >= {"x", "y", "radius", "velocity", "alive"}
    assert set(payload["world"]) == {"screen_width", "screen_height", "ground_height"}


def test_admin_login_and_protected_status(monkeypatch: Any) -> None:
    from src.server.routers import admin as admin_router

    monkeypatch.setattr(
        admin_router,
        "authenticate_admin_password",
        lambda password: password == "secret",
    )
    monkeypatch.setattr(
        admin_router.training_manager,
        "status",
        lambda: {
            "is_running": False,
            "active_run_names": [],
            "runs": [],
            "champions": [],
        },
    )
    client = TestClient(create_app())

    unauthorized = client.get("/admin/training/status")
    login = client.post("/admin/login", json={"password": "secret"})
    token = login.json()["access_token"]
    authorized = client.get(
        "/admin/training/status",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert unauthorized.status_code == 401
    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert authorized.status_code == 200
    assert authorized.json()["is_running"] is False


def test_leaderboard_endpoints_return_expected_schema(monkeypatch: Any) -> None:
    from src.server.routers import leaderboard as leaderboard_router

    fake_database = FakeDatabase()
    monkeypatch.setattr(leaderboard_router, "get_database", lambda: fake_database)
    client = TestClient(create_app())

    create_response = client.post(
        "/leaderboard",
        json={"username": "pilot", "score": 12},
    )
    list_response = client.get("/leaderboard")

    assert create_response.status_code == 200
    assert set(create_response.json()) == {"username", "score", "created_at"}
    assert list_response.status_code == 200
    payload = list_response.json()
    assert "scores" in payload
    assert isinstance(payload["scores"], list)
    assert set(payload["scores"][0]) == {"username", "score", "created_at"}
