from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import get_admin_jwt_secret, get_admin_password


bearer_scheme = HTTPBearer(auto_error=False)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_admin_token(expires_in_seconds: int = 60 * 60 * 12) -> str:
    """Create a signed JWT for the admin session."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in_seconds,
    }

    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(
        get_admin_jwt_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64url_encode(signature)}"


def verify_admin_token(token: str) -> dict[str, Any]:
    """Verify the JWT signature and expiry."""
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token.",
        ) from error

    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    expected_signature = hmac.new(
        get_admin_jwt_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    actual_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token signature.",
        )

    payload = json.loads(_b64url_decode(encoded_payload))
    if int(payload.get("exp", 0)) <= int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin token has expired.",
        )

    return payload


def authenticate_admin_password(password: str) -> bool:
    """Return whether the provided password matches the configured admin password."""
    return hmac.compare_digest(password, get_admin_password())


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    """Require a valid bearer token for admin routes."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    return verify_admin_token(credentials.credentials)
