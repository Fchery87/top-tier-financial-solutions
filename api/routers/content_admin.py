"""Administrative CRUD endpoints for managed website content."""

from datetime import datetime
from typing import TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AdminUser, Disclaimer, FAQItem, Page, Testimonial
from ..schemas.content import (
    CreateDisclaimerRequest,
    CreateFAQRequest,
    CreatePageRequest,
    CreateTestimonialRequest,
    DisclaimerListResponse,
    DisclaimerResponse,
    FAQListResponse,
    FAQResponse,
    PageListResponse,
    PageResponse,
    TestimonialListResponse,
    TestimonialResponse,
    UpdateDisclaimerRequest,
    UpdateFAQRequest,
    UpdatePageRequest,
    UpdateTestimonialRequest,
)

router = APIRouter(prefix="/admin", tags=["admin-content"])

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


def serialize(entity: object, response_type: type[ResponseModel]) -> ResponseModel:
    """Project a SQLModel entity into its declared API response model."""
    values = {
        field: getattr(entity, field)
        for field in response_type.model_fields
        if field != "id"
    }
    return response_type(id=str(entity.id), **values)  # type: ignore[attr-defined]


def get_or_404(session: Session, model_type: type[object], item_id: UUID, detail: str) -> object:
    entity = session.get(model_type, item_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return entity


@router.get("/content", response_model=PageListResponse)
async def list_pages(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> PageListResponse:
    """List website-content pages with pagination."""
    del current_user
    pages = session.exec(select(Page).offset((page - 1) * limit).limit(limit)).all()
    total = len(session.exec(select(Page)).all())
    return PageListResponse(
        items=[serialize(item, PageResponse) for item in pages],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/content", response_model=PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    request: CreatePageRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> PageResponse:
    """Create a website-content page when its slug is unused."""
    del current_user
    if session.exec(select(Page).where(Page.slug == request.slug)).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Page with slug '{request.slug}' already exists",
        )
    page = Page(**request.model_dump())
    session.add(page)
    session.commit()
    session.refresh(page)
    return serialize(page, PageResponse)


@router.get("/content/{id}", response_model=PageResponse)
async def get_page(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> PageResponse:
    del current_user
    return serialize(get_or_404(session, Page, id, "Page not found"), PageResponse)


@router.put("/content/{id}", response_model=PageResponse)
async def update_page(
    id: UUID,
    request: UpdatePageRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> PageResponse:
    del current_user
    page = get_or_404(session, Page, id, "Page not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(page, key, value)
    page.updated_at = datetime.utcnow()
    session.add(page)
    session.commit()
    session.refresh(page)
    return serialize(page, PageResponse)


@router.delete("/content/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> None:
    del current_user
    session.delete(get_or_404(session, Page, id, "Page not found"))
    session.commit()


@router.get("/testimonials", response_model=TestimonialListResponse)
async def list_testimonials(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_approved: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> TestimonialListResponse:
    del current_user
    statement = select(Testimonial)
    count_statement = select(Testimonial)
    if is_approved is not None:
        statement = statement.where(Testimonial.is_approved == is_approved)
        count_statement = count_statement.where(Testimonial.is_approved == is_approved)
    testimonials = session.exec(
        statement.offset((page - 1) * limit).limit(limit).order_by(Testimonial.order_index)
    ).all()
    return TestimonialListResponse(
        items=[serialize(item, TestimonialResponse) for item in testimonials],
        total=len(session.exec(count_statement).all()),
        page=page,
        limit=limit,
    )


@router.post(
    "/testimonials",
    response_model=TestimonialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_testimonial(
    request: CreateTestimonialRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> TestimonialResponse:
    del current_user
    testimonial = Testimonial(**request.model_dump())
    session.add(testimonial)
    session.commit()
    session.refresh(testimonial)
    return serialize(testimonial, TestimonialResponse)


@router.put("/testimonials/{id}", response_model=TestimonialResponse)
async def update_testimonial(
    id: UUID,
    request: UpdateTestimonialRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> TestimonialResponse:
    del current_user
    testimonial = get_or_404(session, Testimonial, id, "Testimonial not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(testimonial, key, value)
    testimonial.updated_at = datetime.utcnow()
    session.add(testimonial)
    session.commit()
    session.refresh(testimonial)
    return serialize(testimonial, TestimonialResponse)


@router.delete("/testimonials/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> None:
    del current_user
    session.delete(get_or_404(session, Testimonial, id, "Testimonial not found"))
    session.commit()


@router.get("/faqs", response_model=FAQListResponse)
async def list_faqs(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_published: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> FAQListResponse:
    del current_user
    statement = select(FAQItem)
    count_statement = select(FAQItem)
    if is_published is not None:
        statement = statement.where(FAQItem.is_published == is_published)
        count_statement = count_statement.where(FAQItem.is_published == is_published)
    faqs = session.exec(
        statement.offset((page - 1) * limit).limit(limit).order_by(FAQItem.display_order)
    ).all()
    return FAQListResponse(
        items=[serialize(item, FAQResponse) for item in faqs],
        total=len(session.exec(count_statement).all()),
        page=page,
        limit=limit,
    )


@router.post("/faqs", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    request: CreateFAQRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> FAQResponse:
    del current_user
    faq = FAQItem(**request.model_dump())
    session.add(faq)
    session.commit()
    session.refresh(faq)
    return serialize(faq, FAQResponse)


@router.put("/faqs/{id}", response_model=FAQResponse)
async def update_faq(
    id: UUID,
    request: UpdateFAQRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> FAQResponse:
    del current_user
    faq = get_or_404(session, FAQItem, id, "FAQ not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(faq, key, value)
    faq.updated_at = datetime.utcnow()
    session.add(faq)
    session.commit()
    session.refresh(faq)
    return serialize(faq, FAQResponse)


@router.delete("/faqs/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> None:
    del current_user
    session.delete(get_or_404(session, FAQItem, id, "FAQ not found"))
    session.commit()


@router.get("/disclaimers", response_model=DisclaimerListResponse)
async def list_disclaimers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_active: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> DisclaimerListResponse:
    del current_user
    statement = select(Disclaimer)
    count_statement = select(Disclaimer)
    if is_active is not None:
        statement = statement.where(Disclaimer.is_active == is_active)
        count_statement = count_statement.where(Disclaimer.is_active == is_active)
    disclaimers = session.exec(statement.offset((page - 1) * limit).limit(limit)).all()
    return DisclaimerListResponse(
        items=[serialize(item, DisclaimerResponse) for item in disclaimers],
        total=len(session.exec(count_statement).all()),
        page=page,
        limit=limit,
    )


@router.post(
    "/disclaimers",
    response_model=DisclaimerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_disclaimer(
    request: CreateDisclaimerRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> DisclaimerResponse:
    del current_user
    if session.exec(select(Disclaimer).where(Disclaimer.name == request.name)).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Disclaimer with name '{request.name}' already exists",
        )
    disclaimer = Disclaimer(**request.model_dump())
    session.add(disclaimer)
    session.commit()
    session.refresh(disclaimer)
    return serialize(disclaimer, DisclaimerResponse)


@router.put("/disclaimers/{id}", response_model=DisclaimerResponse)
async def update_disclaimer(
    id: UUID,
    request: UpdateDisclaimerRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> DisclaimerResponse:
    del current_user
    disclaimer = get_or_404(session, Disclaimer, id, "Disclaimer not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(disclaimer, key, value)
    disclaimer.updated_at = datetime.utcnow()
    session.add(disclaimer)
    session.commit()
    session.refresh(disclaimer)
    return serialize(disclaimer, DisclaimerResponse)


@router.delete("/disclaimers/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_disclaimer(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user),
) -> None:
    del current_user
    session.delete(get_or_404(session, Disclaimer, id, "Disclaimer not found"))
    session.commit()
