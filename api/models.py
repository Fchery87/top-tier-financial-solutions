import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Column, Field, SQLModel
from sqlmodel import Enum as SQLEnum


class ConsultationStatus(str, enum.Enum):
    """Status enum for consultation requests"""
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    archived = "archived"


class AdminUser(SQLModel, table=True):
    """Admin user model for authentication"""
    __tablename__ = "admin_users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    full_name: str = Field(max_length=255)
    hashed_password: str = Field(max_length=255)
    role: str = Field(default="admin", max_length=50)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Page(SQLModel, table=True):
    """Website content pages model"""
    __tablename__ = "pages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    slug: str = Field(unique=True, index=True, max_length=255)
    title: str = Field(max_length=255)
    hero_headline: str | None = Field(default=None, max_length=500)
    hero_subheadline: str | None = Field(default=None)
    main_content_json: str | None = Field(default=None)  # JSONB stored as text
    cta_text: str | None = Field(default=None, max_length=255)
    cta_link: str | None = Field(default=None, max_length=2048)
    meta_title: str | None = Field(default=None, max_length=255)
    meta_description: str | None = Field(default=None)
    is_published: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Service(SQLModel, table=True):
    """Services offered by Top Tier Financial Solutions"""
    __tablename__ = "services"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    description: str
    order_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Testimonial(SQLModel, table=True):
    """Client testimonials model"""
    __tablename__ = "testimonials"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    author_name: str = Field(max_length=255)
    author_location: str | None = Field(default=None, max_length=255)
    quote: str
    order_index: int = Field(default=0, index=True)
    is_approved: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Disclaimer(SQLModel, table=True):
    """Legal disclaimers model"""
    __tablename__ = "disclaimers"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    content: str
    display_hint: str | None = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FAQItem(SQLModel, table=True):
    """FAQ items model"""
    __tablename__ = "faq_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    question: str = Field(max_length=500)
    answer: str
    display_order: int = Field(default=0, index=True)
    is_published: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConsultationRequest(SQLModel, table=True):
    """Contact form submissions / consultation requests model"""
    __tablename__ = "consultation_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    first_name: str = Field(max_length=255)
    last_name: str = Field(max_length=255)
    email: str = Field(index=True, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    message: str | None = Field(default=None)
    source_page_slug: str | None = Field(default=None, max_length=255)
    status: ConsultationStatus = Field(
        default=ConsultationStatus.new,
        sa_column=Column(SQLEnum(ConsultationStatus), index=True)
    )
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
