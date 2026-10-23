"""Vercel's discoverable ASGI entrypoint; local Uvicorn uses the same app."""

from backend.app import app

__all__ = ["app"]
