import pytest


@pytest.mark.anyio
async def test_admin_content_list_requires_bearer_authentication(
    client: object,
) -> None:
    response = await client.get("/api/v1/admin/content")  # type: ignore[attr-defined]

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
