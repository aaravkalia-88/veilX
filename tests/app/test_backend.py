from fastapi.testclient import TestClient
from backend.app import app
import pytest


@pytest.fixture(scope='module')
def local_client():
    # The official MCP session manager owns one application lifespan.
    with TestClient(app, base_url='http://127.0.0.1:8000') as client:
        yield client


def test_health_and_security_headers(local_client):
    client = local_client
    response = client.get('/healthz')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert "script-src 'self'" in response.headers['content-security-policy']
    assert response.headers['x-content-type-options'] == 'nosniff'


def test_assistant_rejects_raw_text_extra_fields_and_invalid_counts(local_client):
    client = local_client
    for body in [
        {'intent': 'summary', 'draft': 'maya@example.com'},
        {'intent': 'summary', 'counts_by_type': {'email': 'maya@example.com'}},
        {'intent': 'summary', 'counts_by_type': {'unknown': 1}},
        {'intent': 'summary', 'counts_by_type': {'email': -1}},
        {'intent': 'summary', 'counts_by_type': {'email': True}},
        {'intent': 'summary', 'counts_by_type': {'email': 100001}},
    ]:
        response = client.post('/api/assistant', json=body)
        assert response.status_code == 422
        assert 'maya@example.com' not in response.text


def test_rejects_untrusted_origins_and_hosts(local_client):
    client = local_client
    assert client.post('/api/assistant', json={'intent': 'capabilities'}, headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.get('/healthz', headers={'Host': 'evil.example'}).status_code == 400
