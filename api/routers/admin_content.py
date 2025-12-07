from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AdminUser, Disclaimer, FAQItem, Page, Testimonial

router = APIRouter(prefix="/admin", tags=["admin-content"])


# Request/Response models for Pages
class CreatePageRequest(BaseModel):
    slug: str
    title: str
    hero_headline: str | None = None
    hero_subheadline: str | None = None
    main_content_json: str | None = None
    cta_text: str | None = None
    cta_link: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    is_published: bool = False


class UpdatePageRequest(BaseModel):
    title: str | None = None
    hero_headline: str | None = None
    hero_subheadline: str | None = None
    main_content_json: str | None = None
    cta_text: str | None = None
    cta_link: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    is_published: bool | None = None


class PageResponse(BaseModel):
    id: str
    slug: str
    title: str
    hero_headline: str | None = None
    hero_subheadline: str | None = None
    main_content_json: str | None = None
    cta_text: str | None = None
    cta_link: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class PageListResponse(BaseModel):
    items: list[PageResponse]
    total: int
    page: int
    limit: int


# Request/Response models for Testimonials
class CreateTestimonialRequest(BaseModel):
    author_name: str
    author_location: str | None = None
    quote: str
    order_index: int = 0
    is_approved: bool = False


class UpdateTestimonialRequest(BaseModel):
    author_name: str | None = None
    author_location: str | None = None
    quote: str | None = None
    order_index: int | None = None
    is_approved: bool | None = None


class TestimonialResponse(BaseModel):
    id: str
    author_name: str
    author_location: str | None = None
    quote: str
    order_index: int
    is_approved: bool
    created_at: datetime
    updated_at: datetime


class TestimonialListResponse(BaseModel):
    items: list[TestimonialResponse]
    total: int
    page: int
    limit: int


# Request/Response models for FAQs
class CreateFAQRequest(BaseModel):
    question: str
    answer: str
    display_order: int = 0
    is_published: bool = True


class UpdateFAQRequest(BaseModel):
    question: str | None = None
    answer: str | None = None
    display_order: int | None = None
    is_published: bool | None = None


class FAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    display_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime


class FAQListResponse(BaseModel):
    items: list[FAQResponse]
    total: int
    page: int
    limit: int


# Request/Response models for Disclaimers
class CreateDisclaimerRequest(BaseModel):
    name: str
    content: str
    display_hint: str | None = None
    is_active: bool = True


class UpdateDisclaimerRequest(BaseModel):
    name: str | None = None
    content: str | None = None
    display_hint: str | None = None
    is_active: bool | None = None


class DisclaimerResponse(BaseModel):
    id: str
    name: str
    content: str
    display_hint: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DisclaimerListResponse(BaseModel):
    items: list[DisclaimerResponse]
    total: int
    page: int
    limit: int


# ===== PAGES ENDPOINTS =====

@router.get("/content", response_model=PageListResponse)
async def list_pages(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """List all website content pages with pagination"""
    offset = (page - 1) * limit

    statement = select(Page).offset(offset).limit(limit)
    pages = session.exec(statement).all()

    count_statement = select(Page)
    total = len(session.exec(count_statement).all())

    return PageListResponse(
        items=[
            PageResponse(
                id=str(p.id),
                slug=p.slug,
                title=p.title,
                hero_headline=p.hero_headline,
                hero_subheadline=p.hero_subheadline,
                main_content_json=p.main_content_json,
                cta_text=p.cta_text,
                cta_link=p.cta_link,
                meta_title=p.meta_title,
                meta_description=p.meta_description,
                is_published=p.is_published,
                created_at=p.created_at,
                updated_at=p.updated_at
            )
            for p in pages
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.post("/content", response_model=PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    request: CreatePageRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Create a new website content page"""
    # Check if slug already exists
    statement = select(Page).where(Page.slug == request.slug)
    existing = session.exec(statement).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Page with slug '{request.slug}' already exists"
        )

    page = Page(**request.model_dump())
    session.add(page)
    session.commit()
    session.refresh(page)

    return PageResponse(
        id=str(page.id),
        slug=page.slug,
        title=page.title,
        hero_headline=page.hero_headline,
        hero_subheadline=page.hero_subheadline,
        main_content_json=page.main_content_json,
        cta_text=page.cta_text,
        cta_link=page.cta_link,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        is_published=page.is_published,
        created_at=page.created_at,
        updated_at=page.updated_at
    )


@router.get("/content/{id}", response_model=PageResponse)
async def get_page(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Get a specific page by ID"""
    page = session.get(Page, id)

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )

    return PageResponse(
        id=str(page.id),
        slug=page.slug,
        title=page.title,
        hero_headline=page.hero_headline,
        hero_subheadline=page.hero_subheadline,
        main_content_json=page.main_content_json,
        cta_text=page.cta_text,
        cta_link=page.cta_link,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        is_published=page.is_published,
        created_at=page.created_at,
        updated_at=page.updated_at
    )


@router.put("/content/{id}", response_model=PageResponse)
async def update_page(
    id: UUID,
    request: UpdatePageRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Update an existing page"""
    page = session.get(Page, id)

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(page, key, value)

    page.updated_at = datetime.utcnow()
    session.add(page)
    session.commit()
    session.refresh(page)

    return PageResponse(
        id=str(page.id),
        slug=page.slug,
        title=page.title,
        hero_headline=page.hero_headline,
        hero_subheadline=page.hero_subheadline,
        main_content_json=page.main_content_json,
        cta_text=page.cta_text,
        cta_link=page.cta_link,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        is_published=page.is_published,
        created_at=page.created_at,
        updated_at=page.updated_at
    )


@router.delete("/content/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Delete a page"""
    page = session.get(Page, id)

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )

    session.delete(page)
    session.commit()


# ===== TESTIMONIALS ENDPOINTS =====

@router.get("/testimonials", response_model=TestimonialListResponse)
async def list_testimonials(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_approved: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """List all testimonials with optional filtering"""
    offset = (page - 1) * limit

    statement = select(Testimonial)
    if is_approved is not None:
        statement = statement.where(Testimonial.is_approved == is_approved)

    statement = statement.offset(offset).limit(limit).order_by(Testimonial.order_index)
    testimonials = session.exec(statement).all()

    count_statement = select(Testimonial)
    if is_approved is not None:
        count_statement = count_statement.where(Testimonial.is_approved == is_approved)
    total = len(session.exec(count_statement).all())

    return TestimonialListResponse(
        items=[
            TestimonialResponse(
                id=str(t.id),
                author_name=t.author_name,
                author_location=t.author_location,
                quote=t.quote,
                order_index=t.order_index,
                is_approved=t.is_approved,
                created_at=t.created_at,
                updated_at=t.updated_at
            )
            for t in testimonials
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.post("/testimonials", response_model=TestimonialResponse, status_code=status.HTTP_201_CREATED)
async def create_testimonial(
    request: CreateTestimonialRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Create a new testimonial"""
    testimonial = Testimonial(**request.model_dump())
    session.add(testimonial)
    session.commit()
    session.refresh(testimonial)

    return TestimonialResponse(
        id=str(testimonial.id),
        author_name=testimonial.author_name,
        author_location=testimonial.author_location,
        quote=testimonial.quote,
        order_index=testimonial.order_index,
        is_approved=testimonial.is_approved,
        created_at=testimonial.created_at,
        updated_at=testimonial.updated_at
    )


@router.put("/testimonials/{id}", response_model=TestimonialResponse)
async def update_testimonial(
    id: UUID,
    request: UpdateTestimonialRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Update an existing testimonial"""
    testimonial = session.get(Testimonial, id)

    if not testimonial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found"
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(testimonial, key, value)

    testimonial.updated_at = datetime.utcnow()
    session.add(testimonial)
    session.commit()
    session.refresh(testimonial)

    return TestimonialResponse(
        id=str(testimonial.id),
        author_name=testimonial.author_name,
        author_location=testimonial.author_location,
        quote=testimonial.quote,
        order_index=testimonial.order_index,
        is_approved=testimonial.is_approved,
        created_at=testimonial.created_at,
        updated_at=testimonial.updated_at
    )


@router.delete("/testimonials/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Delete a testimonial"""
    testimonial = session.get(Testimonial, id)

    if not testimonial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found"
        )

    session.delete(testimonial)
    session.commit()


# ===== FAQ ENDPOINTS =====

@router.get("/faqs", response_model=FAQListResponse)
async def list_faqs(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_published: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """List all FAQ items with optional filtering"""
    offset = (page - 1) * limit

    statement = select(FAQItem)
    if is_published is not None:
        statement = statement.where(FAQItem.is_published == is_published)

    statement = statement.offset(offset).limit(limit).order_by(FAQItem.display_order)
    faqs = session.exec(statement).all()

    count_statement = select(FAQItem)
    if is_published is not None:
        count_statement = count_statement.where(FAQItem.is_published == is_published)
    total = len(session.exec(count_statement).all())

    return FAQListResponse(
        items=[
            FAQResponse(
                id=str(f.id),
                question=f.question,
                answer=f.answer,
                display_order=f.display_order,
                is_published=f.is_published,
                created_at=f.created_at,
                updated_at=f.updated_at
            )
            for f in faqs
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.post("/faqs", response_model=FAQResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    request: CreateFAQRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Create a new FAQ item"""
    faq = FAQItem(**request.model_dump())
    session.add(faq)
    session.commit()
    session.refresh(faq)

    return FAQResponse(
        id=str(faq.id),
        question=faq.question,
        answer=faq.answer,
        display_order=faq.display_order,
        is_published=faq.is_published,
        created_at=faq.created_at,
        updated_at=faq.updated_at
    )


@router.put("/faqs/{id}", response_model=FAQResponse)
async def update_faq(
    id: UUID,
    request: UpdateFAQRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Update an existing FAQ item"""
    faq = session.get(FAQItem, id)

    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found"
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(faq, key, value)

    faq.updated_at = datetime.utcnow()
    session.add(faq)
    session.commit()
    session.refresh(faq)

    return FAQResponse(
        id=str(faq.id),
        question=faq.question,
        answer=faq.answer,
        display_order=faq.display_order,
        is_published=faq.is_published,
        created_at=faq.created_at,
        updated_at=faq.updated_at
    )


@router.delete("/faqs/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Delete an FAQ item"""
    faq = session.get(FAQItem, id)

    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ not found"
        )

    session.delete(faq)
    session.commit()


# ===== DISCLAIMERS ENDPOINTS =====

@router.get("/disclaimers", response_model=DisclaimerListResponse)
async def list_disclaimers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    is_active: bool | None = None,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """List all legal disclaimers with optional filtering"""
    offset = (page - 1) * limit

    statement = select(Disclaimer)
    if is_active is not None:
        statement = statement.where(Disclaimer.is_active == is_active)

    statement = statement.offset(offset).limit(limit)
    disclaimers = session.exec(statement).all()

    count_statement = select(Disclaimer)
    if is_active is not None:
        count_statement = count_statement.where(Disclaimer.is_active == is_active)
    total = len(session.exec(count_statement).all())

    return DisclaimerListResponse(
        items=[
            DisclaimerResponse(
                id=str(d.id),
                name=d.name,
                content=d.content,
                display_hint=d.display_hint,
                is_active=d.is_active,
                created_at=d.created_at,
                updated_at=d.updated_at
            )
            for d in disclaimers
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.post("/disclaimers", response_model=DisclaimerResponse, status_code=status.HTTP_201_CREATED)
async def create_disclaimer(
    request: CreateDisclaimerRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Create a new legal disclaimer"""
    # Check if name already exists
    statement = select(Disclaimer).where(Disclaimer.name == request.name)
    existing = session.exec(statement).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Disclaimer with name '{request.name}' already exists"
        )

    disclaimer = Disclaimer(**request.model_dump())
    session.add(disclaimer)
    session.commit()
    session.refresh(disclaimer)

    return DisclaimerResponse(
        id=str(disclaimer.id),
        name=disclaimer.name,
        content=disclaimer.content,
        display_hint=disclaimer.display_hint,
        is_active=disclaimer.is_active,
        created_at=disclaimer.created_at,
        updated_at=disclaimer.updated_at
    )


@router.put("/disclaimers/{id}", response_model=DisclaimerResponse)
async def update_disclaimer(
    id: UUID,
    request: UpdateDisclaimerRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Update an existing disclaimer"""
    disclaimer = session.get(Disclaimer, id)

    if not disclaimer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disclaimer not found"
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(disclaimer, key, value)

    disclaimer.updated_at = datetime.utcnow()
    session.add(disclaimer)
    session.commit()
    session.refresh(disclaimer)

    return DisclaimerResponse(
        id=str(disclaimer.id),
        name=disclaimer.name,
        content=disclaimer.content,
        display_hint=disclaimer.display_hint,
        is_active=disclaimer.is_active,
        created_at=disclaimer.created_at,
        updated_at=disclaimer.updated_at
    )


@router.delete("/disclaimers/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_disclaimer(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Delete a disclaimer"""
    disclaimer = session.get(Disclaimer, id)

    if not disclaimer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disclaimer not found"
        )

    session.delete(disclaimer)
    session.commit()
