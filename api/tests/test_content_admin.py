import importlib.util

import pytest


@pytest.mark.anyio
async def test_admin_content_list_requires_bearer_authentication(
    client: object,
) -> None:
    response = await client.get("/api/v1/admin/content")  # type: ignore[attr-defined]

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


@pytest.mark.anyio
async def test_admin_content_crud_families_keep_their_response_contracts(
    client: object,
) -> None:
    registration = await client.post(  # type: ignore[attr-defined]
        "/api/v1/auth/register",
        json={
            "email": "admin-content@example.com",
            "password": "correct-horse-battery-staple",
            "full_name": "Admin Content",
        },
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    cases = (
        (
            "/api/v1/admin/content",
            {"slug": "admin-page", "title": "Admin Page"},
            "slug",
            "admin-page",
        ),
        (
            "/api/v1/admin/testimonials",
            {"author_name": "Client", "quote": "Great service"},
            "author_name",
            "Client",
        ),
        (
            "/api/v1/admin/faqs",
            {"question": "Question?", "answer": "Answer."},
            "question",
            "Question?",
        ),
        (
            "/api/v1/admin/disclaimers",
            {"name": "Required", "content": "Disclosure"},
            "name",
            "Required",
        ),
    )

    for path, payload, field, expected in cases:
        created = await client.post(path, headers=headers, json=payload)  # type: ignore[attr-defined]
        assert created.status_code == 201
        assert created.json()[field] == expected

        listed = await client.get(path, headers=headers)  # type: ignore[attr-defined]
        assert listed.status_code == 200
        assert listed.json()["items"][0][field] == expected


def test_admin_content_router_has_its_own_domain_module() -> None:
    assert importlib.util.find_spec("api.routers.content_admin") is not None
