"""Shared request and response contracts for the content domain."""

from datetime import datetime

from pydantic import BaseModel


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


class WebsiteContentResponse(BaseModel):
    id: str
    slug: str
    title: str
    content: str | None = None
    hero_headline: str | None = None
    hero_subheadline: str | None = None
    cta_text: str | None = None
    cta_link: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class PublicTestimonialResponse(BaseModel):
    id: str
    author_name: str
    author_location: str | None = None
    quote: str
    created_at: datetime
    updated_at: datetime


class PublicDisclaimerResponse(BaseModel):
    id: str
    name: str
    content: str
    display_hint: str | None = None
    created_at: datetime
    updated_at: datetime


class PublicFAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    display_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime
