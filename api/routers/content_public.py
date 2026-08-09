"""Public read-only content endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from ..database import get_session
from ..schemas.content import (
    PublicDisclaimerResponse,
    PublicFAQResponse,
    PublicTestimonialResponse,
    WebsiteContentResponse,
)
from ..services.content import (
    get_published_page,
    list_active_disclaimers,
    list_approved_testimonials,
    list_published_faqs,
)

router = APIRouter(prefix="/public", tags=["public-content"])


@router.get("/content/{slug}", response_model=WebsiteContentResponse)
async def get_website_content_by_slug(
    slug: str,
    session: Session = Depends(get_session),
) -> WebsiteContentResponse:
    """Retrieve a published website-content page by slug."""
    page = get_published_page(session, slug)

    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with slug '{slug}' not found",
        )

    return WebsiteContentResponse(
        id=str(page.id),
        slug=page.slug,
        title=page.title,
        content=page.main_content_json,
        hero_headline=page.hero_headline,
        hero_subheadline=page.hero_subheadline,
        cta_text=page.cta_text,
        cta_link=page.cta_link,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        is_published=page.is_published,
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


@router.get("/testimonials", response_model=list[PublicTestimonialResponse])
async def get_approved_testimonials(
    session: Session = Depends(get_session),
) -> list[PublicTestimonialResponse]:
    """Retrieve approved testimonials in their configured display order."""
    return [
        PublicTestimonialResponse(
            id=str(testimonial.id),
            author_name=testimonial.author_name,
            author_location=testimonial.author_location,
            quote=testimonial.quote,
            created_at=testimonial.created_at,
            updated_at=testimonial.updated_at,
        )
        for testimonial in list_approved_testimonials(session)
    ]


@router.get("/disclaimers", response_model=list[PublicDisclaimerResponse])
async def get_active_disclaimers(
    session: Session = Depends(get_session),
) -> list[PublicDisclaimerResponse]:
    """Retrieve active legal disclaimers."""
    return [
        PublicDisclaimerResponse(
            id=str(disclaimer.id),
            name=disclaimer.name,
            content=disclaimer.content,
            display_hint=disclaimer.display_hint,
            created_at=disclaimer.created_at,
            updated_at=disclaimer.updated_at,
        )
        for disclaimer in list_active_disclaimers(session)
    ]


@router.get("/faqs", response_model=list[PublicFAQResponse])
async def get_published_faqs(
    session: Session = Depends(get_session),
) -> list[PublicFAQResponse]:
    """Retrieve published FAQs in their configured display order."""
    return [
        PublicFAQResponse(
            id=str(faq.id),
            question=faq.question,
            answer=faq.answer,
            display_order=faq.display_order,
            is_published=faq.is_published,
            created_at=faq.created_at,
            updated_at=faq.updated_at,
        )
        for faq in list_published_faqs(session)
    ]
