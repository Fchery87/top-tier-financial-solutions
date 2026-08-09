import importlib
import importlib.util

import pytest


async def register_admin(client: object) -> dict[str, str]:
    response = await client.post(  # type: ignore[attr-defined]
        "/api/v1/auth/register",
        json={
            "email": "content-admin@example.com",
            "password": "correct-horse-battery-staple",
            "full_name": "Content Admin",
        },
    )

    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def create_page(
    client: object,
    headers: dict[str, str],
    *,
    slug: str,
    is_published: bool,
) -> None:
    response = await client.post(  # type: ignore[attr-defined]
        "/api/v1/admin/content",
        headers=headers,
        json={
            "slug": slug,
            "title": "Content contract",
            "main_content_json": "{\"blocks\": []}",
            "is_published": is_published,
        },
    )

    assert response.status_code == 201


@pytest.mark.anyio
async def test_public_content_hides_drafts_and_returns_the_existing_public_shape(
    client: object,
) -> None:
    headers = await register_admin(client)
    await create_page(client, headers, slug="draft-content", is_published=False)

    draft_response = await client.get(  # type: ignore[attr-defined]
        "/api/v1/public/content/draft-content"
    )

    assert draft_response.status_code == 404
    assert draft_response.json() == {
        "detail": "Content with slug 'draft-content' not found"
    }

    await create_page(client, headers, slug="published-content", is_published=True)

    response = await client.get(  # type: ignore[attr-defined]
        "/api/v1/public/content/published-content"
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": response.json()["id"],
        "slug": "published-content",
        "title": "Content contract",
        "content": "{\"blocks\": []}",
        "hero_headline": None,
        "hero_subheadline": None,
        "cta_text": None,
        "cta_link": None,
        "meta_title": None,
        "meta_description": None,
        "is_published": True,
        "created_at": response.json()["created_at"],
        "updated_at": response.json()["updated_at"],
    }


def test_content_schema_module_is_the_shared_content_contract() -> None:
    assert importlib.util.find_spec("api.schemas.content") is not None


def test_content_schema_module_exposes_admin_and_public_content_contracts() -> None:
    content = importlib.import_module("api.schemas.content")

    assert all(
        hasattr(content, name)
        for name in (
            "CreatePageRequest",
            "UpdatePageRequest",
            "PageResponse",
            "PageListResponse",
            "CreateTestimonialRequest",
            "UpdateTestimonialRequest",
            "TestimonialResponse",
            "TestimonialListResponse",
            "CreateFAQRequest",
            "UpdateFAQRequest",
            "FAQResponse",
            "FAQListResponse",
            "CreateDisclaimerRequest",
            "UpdateDisclaimerRequest",
            "DisclaimerResponse",
            "DisclaimerListResponse",
            "WebsiteContentResponse",
            "PublicTestimonialResponse",
            "PublicDisclaimerResponse",
            "PublicFAQResponse",
        )
    )


def test_public_content_router_has_its_own_domain_module() -> None:
    assert importlib.util.find_spec("api.routers.content_public") is not None
