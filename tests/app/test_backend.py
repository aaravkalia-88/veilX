import asyncio
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from mcp import Client, MCPError

from backend.app import (
    ROOT,
    Counts,
    app,
    get_protection_capabilities,
    mcp,
    summarize_protection,
)


@pytest.fixture(scope="module")
def local_client():
    # The official MCP session manager owns one application lifespan.
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        yield client


def test_health_and_security_headers(local_client):
    client = local_client
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "script-src 'self'" in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_assistant_rejects_raw_text_extra_fields_and_invalid_counts(local_client):
    client = local_client
    for body in [
        {"intent": "summary", "draft": "maya@example.com"},
        {"intent": "summary", "counts_by_type": {"email": "maya@example.com"}},
        {"intent": "summary", "counts_by_type": {"unknown": 1}},
        {"intent": "summary", "counts_by_type": {"email": -1}},
        {"intent": "summary", "counts_by_type": {"email": True}},
        {"intent": "summary", "counts_by_type": {"email": 100001}},
    ]:
        response = client.post("/api/assistant", json=body)
        assert response.status_code == 422
        assert "maya@example.com" not in response.text


def test_rejects_untrusted_origins_and_hosts(local_client):
    client = local_client
    assert (
        client.post(
            "/api/assistant",
            json={"intent": "capabilities"},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert client.get("/healthz", headers={"Host": "evil.example"}).status_code == 400


def test_tools_report_real_counts_without_exposing_private_values():
    result = summarize_protection(Counts(email=2, person=1, secret=1), 3)
    assert result["total_masked"] == 4
    assert result["credentials_masked"] == 1
    assert result["unresolved_count"] == 3
    assert "cannot access your private map" in " ".join(
        get_protection_capabilities()["limits"]
    )


def test_body_limit_and_build_artifacts(local_client):
    assert local_client.post("/api/assistant", content=b"x" * 8193).status_code == 413
    assert local_client.get("/").status_code == 200
    assert local_client.get("/download/veilx-extension.zip").status_code == 200
    with ZipFile(ROOT / "dist/veilx-extension.zip") as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {
            "manifest.json",
            "panel.html",
            "background.js",
            "panel.js",
            "content.js",
            "styles.css",
            "icon.svg",
            "icon16.png",
            "icon32.png",
            "icon48.png",
            "icon128.png",
            "THIRD_PARTY_LICENSES.txt",
            "LICENSE.txt",
        }


def test_mcp_rejects_extra_private_fields():
    async def check():
        async with Client(mcp) as client:
            for name, arguments in [
                (
                    "summarize_protection",
                    {
                        "counts_by_type": {"email": 1},
                        "draft": "synthetic-private-field",
                    },
                ),
                ("get_protection_capabilities", {"draft": "synthetic-private-field"}),
            ]:
                with pytest.raises(MCPError):
                    await client.call_tool(name, arguments)

    asyncio.run(check())
