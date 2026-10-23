"""Privacy demo host. Its API accepts aggregate counts, never private text."""

import logging
import os
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

import httpx2
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from mcp import Client, MCPError
from mcp.client.streamable_http import streamable_http_client
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from starlette.middleware.trustedhost import TrustedHostMiddleware

ROOT = Path(__file__).resolve().parents[1]
Count = Annotated[StrictInt, Field(ge=0, le=100000)]
ALLOWED_ORIGINS = {"http://127.0.0.1:8000", "http://localhost:8000"}
for name in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VEILX_PUBLIC_ORIGIN"):
    if value := os.environ.get(name):
        origin = value if name == "VEILX_PUBLIC_ORIGIN" else f"https://{value}"
        parsed = urlsplit(origin)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"{name} must identify a single HTTPS origin.")
        ALLOWED_ORIGINS.add(origin.rstrip("/"))
ALLOWED_HOSTS = sorted(
    {host for origin in ALLOWED_ORIGINS if (host := urlsplit(origin).hostname)}
)
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
logging.getLogger("mcp").setLevel(logging.WARNING)


class Counts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person: Count = 0
    address: Count = 0
    email: Count = 0
    phone: Count = 0
    id: Count = 0
    dob: Count = 0
    card: Count = 0
    secret: Count = 0
    session_token: Count = 0


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intent: Literal["summary", "capabilities"]
    counts_by_type: Counts = Field(default_factory=Counts)
    unresolved_count: Count = 0


mcp = MCPServer("VeilX", version="1.0.0", log_level="WARNING")


async def metadata_only(ctx, call_next):
    if ctx.method == "tools/call":
        params = ctx.params or {}
        arguments = params.get("arguments") or {}
        allowed = {
            "summarize_protection": {"counts_by_type", "unresolved_count"},
            "get_protection_capabilities": set(),
        }
        try:
            name = params.get("name")
            if (
                name not in allowed
                or not isinstance(arguments, dict)
                or set(arguments) - allowed[name]
            ):
                raise ValueError("Unsupported arguments")
            AssistantRequest.model_validate(
                {
                    "intent": "summary"
                    if name == "summarize_protection"
                    else "capabilities",
                    **arguments,
                }
            )
        except (ValueError, TypeError):
            raise MCPError(
                code=-32602,
                message="Only approved aggregate integer counts are accepted.",
            ) from None
    return await call_next(ctx)


# The SDK ignores unknown function arguments by default; reject them before validation/logging.
mcp.middleware.append(metadata_only)


@mcp.tool(structured_output=True)
def get_protection_capabilities() -> dict[str, object]:
    """Explain VeilX's supported local protection and its limits. No private inputs."""
    return {
        "categories": list(Counts.model_fields),
        "message": "VeilX suggests local masking for names, addresses, email, phone, contextual IDs and birth dates, cards, secrets and session credentials. Review is required. Secrets never restore.",
        "limits": [
            "Detection can miss private information.",
            "Only the verified ChatGPT adapter and supported editors are covered.",
            "This is an Alexa+ frontend simulation, not a linked Amazon account.",
            "The server receives counts only; it cannot access your private map.",
        ],
    }


@mcp.tool(structured_output=True)
def summarize_protection(
    counts_by_type: Counts, unresolved_count: Count = 0
) -> dict[str, object]:
    """Summarize caller-approved aggregate counts. Never supply text, maps or identifiers."""
    counts = counts_by_type.model_dump()
    total = sum(counts.values())
    credentials = counts["secret"] + counts["session_token"]
    return {
        "total_masked": total,
        "counts_by_type": counts,
        "unresolved_count": unresolved_count,
        "credentials_masked": credentials,
        "message": f"VeilX masked {total} item(s) in this workspace. {credentials} credential(s) will remain masked in replies. {unresolved_count} item(s) still need review. Counts describe this workspace only; detection is not a guarantee.",
    }


mcp_app = mcp.streamable_http_app(
    json_response=True,
    stateless_http=True,
    max_request_body_size=8192,
    transport_security=TransportSecuritySettings(
        allowed_hosts=[
            entry for host in ALLOWED_HOSTS for entry in (host, f"{host}:*")
        ],
        allowed_origins=sorted(ALLOWED_ORIGINS),
    ),
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with mcp.session_manager.run():
        yield


app = FastAPI(
    title="VeilX local demo",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
recent_requests: deque[float] = deque()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.headers.get("origin") not in ALLOWED_ORIGINS | {None}:
        response = JSONResponse({"detail": "Origin not permitted."}, status_code=403)
    elif request.url.path == "/api/assistant" and request.method == "POST":
        now = time.monotonic()
        while recent_requests and now - recent_requests[0] >= 60:
            recent_requests.popleft()
        if len(recent_requests) >= 60:
            response = JSONResponse(
                {"detail": "Too many requests. Try again shortly."}, status_code=429
            )
        else:
            recent_requests.append(now)
            response = await call_next(request)
    else:
        response = await call_next(request)
    response.headers.update(
        {
            "Content-Security-Policy": CSP,
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Cache-Control": "no-store",
        }
    )
    return response


class BodyLimit:
    """Bound the complete HTTP body before any JSON decoder sees it."""

    def __init__(self, application):
        self.app = application

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > 8192:
                return await JSONResponse(
                    {"detail": "Request too large."}, status_code=413
                )(scope, receive, send)
            if not message.get("more_body", False):
                break
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        return await self.app(scope, replay, send)


app.add_middleware(BodyLimit)


@app.exception_handler(RequestValidationError)
async def invalid_input(_request: Request, _error: RequestValidationError):
    # Validation errors must not echo rejected private values or arbitrary field names.
    return JSONResponse(
        {
            "detail": "Only the supported intent and non-negative integer category counts are accepted."
        },
        status_code=422,
    )


@app.get("/healthz")
def health():
    return {"status": "ok", "privacy": "aggregate-counts-only"}


@app.get("/download/veilx-extension.zip")
def download():
    path = ROOT / "dist/veilx-extension.zip"
    if not path.is_file():
        return JSONResponse({"detail": "Run npm run build:app first."}, status_code=503)
    return FileResponse(
        path, media_type="application/zip", filename="veilx-extension.zip"
    )


@app.post("/api/assistant")
async def assistant(body: AssistantRequest):
    tool = (
        "summarize_protection"
        if body.intent == "summary"
        else "get_protection_capabilities"
    )
    arguments = (
        {
            "counts_by_type": body.counts_by_type.model_dump(),
            "unresolved_count": body.unresolved_count,
        }
        if body.intent == "summary"
        else {}
    )
    try:
        # ASGI HTTP transport reaches the real mounted endpoint without a serverless loopback socket.
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), timeout=10
        ) as http_client:
            async with Client(
                streamable_http_client(
                    "http://127.0.0.1:8000/mcp", http_client=http_client
                ),
                read_timeout_seconds=10,
            ) as client:
                result = await client.call_tool(tool, arguments)
            if result.is_error or not isinstance(result.structured_content, dict):
                raise RuntimeError("Tool call failed")
            return {
                "tool": tool,
                "transport": "Streamable HTTP",
                "result": result.structured_content,
            }
    except (MCPError, OSError, TimeoutError, RuntimeError, ValueError, ExceptionGroup):
        return JSONResponse(
            {"detail": "The MCP tool is temporarily unavailable. Please retry."},
            status_code=503,
        )


@app.get("/")
def home():
    path = ROOT / "dist/web/index.html"
    if not path.is_file():
        return JSONResponse({"detail": "Run npm run build:app first."}, status_code=503)
    return FileResponse(path)


app.mount(
    "/assets",
    StaticFiles(directory=ROOT / "dist/web/assets", check_dir=False),
    name="assets",
)
app.mount("/", mcp_app)
