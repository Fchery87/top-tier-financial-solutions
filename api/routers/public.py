from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from ..database import get_session
from ..models import Page, Testimonial, Disclaimer, FAQItem, ConsultationRequest, ConsultationStatus

router = APIRouter(prefix="/public", tags=["public"])


# Response models
class WebsiteContentResponse(BaseModel):
    id: str
    slug: str
    title: str
    content: Optional[str] = None
    hero_headline: Optional[str] = None
    hero_subheadline: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class TestimonialResponse(BaseModel):
    id: str
    author_name: str
    author_location: Optional[str] = None
    quote: str
    created_at: datetime
    updated_at: datetime


class DisclaimerResponse(BaseModel):
    id: str
    name: str
    content: str
    display_hint: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    display_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime


class ContactFormRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    message: Optional[str] = None


class ContactFormResponse(BaseModel):
    id: str
    message: str = "Contact form submitted successfully"


@router.get("/content/{slug}", response_model=WebsiteContentResponse)
async def get_website_content_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """Retrieve specific website content by slug"""
    statement = select(Page).where(Page.slug == slug, Page.is_published == True)
    page = session.exec(statement).first()
    
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content with slug '{slug}' not found"
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
        updated_at=page.updated_at
    )


@router.get("/testimonials", response_model=List[TestimonialResponse])
async def get_approved_testimonials(
    session: Session = Depends(get_session)
):
    """Retrieve all approved testimonials"""
    statement = select(Testimonial).where(
        Testimonial.is_approved == True
    ).order_by(Testimonial.order_index)
    
    testimonials = session.exec(statement).all()
    
    return [
        TestimonialResponse(
            id=str(t.id),
            author_name=t.author_name,
            author_location=t.author_location,
            quote=t.quote,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in testimonials
    ]


@router.get("/disclaimers", response_model=List[DisclaimerResponse])
async def get_active_disclaimers(
    session: Session = Depends(get_session)
):
    """Retrieve all active legal disclaimers"""
    statement = select(Disclaimer).where(Disclaimer.is_active == True)
    disclaimers = session.exec(statement).all()
    
    return [
        DisclaimerResponse(
            id=str(d.id),
            name=d.name,
            content=d.content,
            display_hint=d.display_hint,
            created_at=d.created_at,
            updated_at=d.updated_at
        )
        for d in disclaimers
    ]


@router.get("/faqs", response_model=List[FAQResponse])
async def get_published_faqs(
    session: Session = Depends(get_session)
):
    """Retrieve all published FAQ items"""
    statement = select(FAQItem).where(
        FAQItem.is_published == True
    ).order_by(FAQItem.display_order)
    
    faqs = session.exec(statement).all()
    
    return [
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
    ]


def send_contact_form_email(form_data: ContactFormRequest):
    """Send email notification for contact form submission"""
    # Get SMTP configuration from environment
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    recipient_email = os.getenv("CONTACT_EMAIL", smtp_user)
    
    if not smtp_user or not smtp_password:
        print("Warning: SMTP credentials not configured. Email notification skipped.")
        return
    
    # Create email message
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = recipient_email
    msg['Subject'] = f"New Contact Form Submission from {form_data.full_name}"
    
    body = f"""
    New contact form submission received:
    
    Name: {form_data.full_name}
    Email: {form_data.email}
    Phone: {form_data.phone_number or 'Not provided'}
    
    Message:
    {form_data.message or 'No message provided'}
    """
    
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        print(f"Email notification sent to {recipient_email}")
    except Exception as e:
        print(f"Failed to send email notification: {e}")


@router.post("/contact-forms", response_model=ContactFormResponse, status_code=status.HTTP_201_CREATED)
async def submit_contact_form(
    request: ContactFormRequest,
    session: Session = Depends(get_session)
):
    """Submit a new contact form inquiry"""
    # Validate input
    if not request.full_name or len(request.full_name.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required"
        )
    
    # Split full name into first and last name
    name_parts = request.full_name.strip().split(maxsplit=1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Create consultation request
    consultation_request = ConsultationRequest(
        first_name=first_name,
        last_name=last_name,
        email=request.email,
        phone_number=request.phone_number,
        message=request.message,
        status=ConsultationStatus.new
    )
    
    session.add(consultation_request)
    session.commit()
    session.refresh(consultation_request)
    
    # Send email notification (non-blocking)
    try:
        send_contact_form_email(request)
    except Exception as e:
        print(f"Email notification failed: {e}")
        # Don't fail the request if email fails
    
    return ContactFormResponse(
        id=str(consultation_request.id)
    )
