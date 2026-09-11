"""Shared PostgreSQL/PostGIS helpers for WHITEBLOCK scripts."""

from __future__ import annotations

import os


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is required. Copy .env.example, export DATABASE_URL, "
            "or pass it through your shell environment."
        )
    return url


def connect():
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - environment error
        raise RuntimeError("Install dependencies with: pip install -r requirements.txt") from exc
    return psycopg.connect(database_url())
