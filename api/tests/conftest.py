"""Isolated fixtures for FastAPI content-route contract tests."""

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import httpx
import pytest
from sqlmodel import Session, SQLModel

TEST_DATABASE_PATH = Path(tempfile.gettempdir()) / (
    f"top-tier-content-tests-{os.getpid()}.sqlite3"
)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH}"

from api.database import engine, get_session  # noqa: E402
from api.index import app  # noqa: E402

engine.echo = False


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class ContentApiClient:
    """In-process client that does not use Starlette's threaded TestClient."""

    async def request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.request(method, url, **kwargs)

    async def get(self, url: str, **kwargs: object) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: object) -> httpx.Response:
        return await self.request("POST", url, **kwargs)


@pytest.fixture
def client() -> Generator[ContentApiClient, None, None]:
    """Provide a disposable database-backed API client for one test."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

    async def get_test_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    yield ContentApiClient()

    app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(engine)
