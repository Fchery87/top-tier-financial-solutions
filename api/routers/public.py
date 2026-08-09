"""Public endpoints outside the managed website-content domain."""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlmodel import Session

from ..database import get_session
from ..models import ConsultationRequest, ConsultationStatus

router = APIRouter(prefix="/public", tags=["public"])


class ContactFormRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: str | None = None
    message: str | None = None


class ContactFormResponse(BaseModel):
    id: str
    message: str = "Contact form submitted successfully"


def send_contact_form_email(form_data: ContactFormRequest) -> None:
    """Send a best-effort notification for a newly submitted contact form."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    recipient_email = os.getenv("CONTACT_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        print("Warning: SMTP credentials not configured. Email notification skipped.")
        return

    message = MIMEMultipart()
    message["From"] = smtp_user
    message["To"] = recipient_email
    message["Subject"] = f"New Contact Form Submission from {form_data.full_name}"
    message.attach(
        MIMEText(
            f"""
    New contact form submission received:

    Name: {form_data.full_name}
    Email: {form_data.email}
    Phone: {form_data.phone_number or 'Not provided'}

    Message:
    {form_data.message or 'No message provided'}
    """,
            "plain",
        )
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(message)
        print(f"Email notification sent to {recipient_email}")
    except Exception as error:
        print(f"Failed to send email notification: {error}")


@router.post(
    "/contact-forms",
    response_model=ContactFormResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_contact_form(
    request: ContactFormRequest,
    session: Session = Depends(get_session),
) -> ContactFormResponse:
    """Persist a contact-form inquiry and attempt its notification."""
    if not request.full_name or not request.full_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required",
        )

    name_parts = request.full_name.strip().split(maxsplit=1)
    consultation_request = ConsultationRequest(
        first_name=name_parts[0],
        last_name=name_parts[1] if len(name_parts) > 1 else "",
        email=request.email,
        phone_number=request.phone_number,
        message=request.message,
        status=ConsultationStatus.new,
    )
    session.add(consultation_request)
    session.commit()
    session.refresh(consultation_request)

    try:
        send_contact_form_email(request)
    except Exception as error:
        print(f"Email notification failed: {error}")

    return ContactFormResponse(id=str(consultation_request.id))
