import os
import tempfile

# Must be set before the app is imported.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["CHAT_RATE_LIMIT_PER_MINUTE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import chat as chat_router  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    chat_router._recent.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def make_user(client, email=None):
    """Register a user and return auth headers."""
    email = email or "a@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def auth(client):
    return make_user(client, "a@example.com")


@pytest.fixture
def auth_b(client):
    return make_user(client, "b@example.com")


class ExplodingProvider:
    """Fails the test if the model is called at all."""

    name, is_mock = "exploding", False

    def generate(self, *a, **k):
        raise AssertionError("LLM must not be called for this message")
