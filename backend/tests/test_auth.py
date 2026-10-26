"""
DermAI Tests — Authentication: register, login, JWT validation, role checks.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    """GET /health returns status ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """POST /auth/register creates a user and returns a token."""
    resp = await client.post("/auth/register", json={
        "email": "alice@test.com",
        "password": "SecurePass1!",
        "full_name": "Alice Test",
        "role": "patient",
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@test.com"
    assert data["user"]["role"] == "patient"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Second registration with same email returns 409."""
    payload = {
        "email": "bob@test.com",
        "password": "SecurePass1!",
        "full_name": "Bob Test",
        "role": "clinician",
    }
    resp1 = await client.post("/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/auth/register", json=payload)
    assert resp2.status_code == 409
    assert "already registered" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Password under 8 chars is rejected."""
    resp = await client.post("/auth/register", json={
        "email": "charlie@test.com",
        "password": "short",
        "full_name": "Charlie",
        "role": "patient",
    })
    assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """POST /auth/login returns a valid token."""
    # Register first
    await client.post("/auth/register", json={
        "email": "diana@test.com",
        "password": "SecurePass1!",
        "full_name": "Diana",
        "role": "clinician",
    })
    # Now login
    resp = await client.post("/auth/login", json={
        "email": "diana@test.com",
        "password": "SecurePass1!",
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["role"] == "clinician"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Wrong password returns 401."""
    await client.post("/auth/register", json={
        "email": "eve@test.com",
        "password": "CorrectPass1!",
        "full_name": "Eve",
        "role": "patient",
    })
    resp = await client.post("/auth/login", json={
        "email": "eve@test.com",
        "password": "WrongPassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    """Unknown email returns 401."""
    resp = await client.post("/auth/login", json={
        "email": "unknown@test.com",
        "password": "anypassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    """GET /users/me returns current user data."""
    # Register and get token
    reg = await client.post("/auth/register", json={
        "email": "frank@test.com",
        "password": "SecurePass1!",
        "full_name": "Frank",
        "role": "researcher",
    })
    token = reg.json()["access_token"]

    resp = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "frank@test.com"
    assert data["role"] == "researcher"


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    """GET /users/me without token returns 403."""
    resp = await client.get("/users/me")
    assert resp.status_code == 403  # HTTPBearer raises 403 when no credentials


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """GET /users/me with invalid token returns 401."""
    resp = await client.get("/users/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient):
    """PUT /users/me updates full_name."""
    reg = await client.post("/auth/register", json={
        "email": "grace@test.com",
        "password": "SecurePass1!",
        "full_name": "Grace",
        "role": "patient",
    })
    token = reg.json()["access_token"]

    resp = await client.put(
        "/users/me",
        json={"full_name": "Grace Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Grace Updated"
