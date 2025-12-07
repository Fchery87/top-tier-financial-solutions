from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AdminUser, ConsultationRequest, ConsultationStatus

router = APIRouter(prefix="/admin", tags=["admin-leads"])


# Request/Response models
class UpdateConsultationRequestRequest(BaseModel):
    status: ConsultationStatus | None = None


class ConsultationRequestResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone_number: str | None = None
    message: str | None = None
    source_page_slug: str | None = None
    status: ConsultationStatus
    requested_at: datetime
    updated_at: datetime


class ConsultationRequestListResponse(BaseModel):
    items: list[ConsultationRequestResponse]
    total: int
    page: int
    limit: int


@router.get("/contact-forms", response_model=ConsultationRequestListResponse)
async def list_contact_forms(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status_filter: ConsultationStatus | None = Query(None, alias="status"),
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """List all contact form submissions with pagination and filtering"""
    offset = (page - 1) * limit

    statement = select(ConsultationRequest)
    if status_filter is not None:
        statement = statement.where(ConsultationRequest.status == status_filter)

    statement = statement.offset(offset).limit(limit).order_by(ConsultationRequest.requested_at.desc())
    submissions = session.exec(statement).all()

    count_statement = select(ConsultationRequest)
    if status_filter is not None:
        count_statement = count_statement.where(ConsultationRequest.status == status_filter)
    total = len(session.exec(count_statement).all())

    return ConsultationRequestListResponse(
        items=[
            ConsultationRequestResponse(
                id=str(s.id),
                first_name=s.first_name,
                last_name=s.last_name,
                email=s.email,
                phone_number=s.phone_number,
                message=s.message,
                source_page_slug=s.source_page_slug,
                status=s.status,
                requested_at=s.requested_at,
                updated_at=s.updated_at
            )
            for s in submissions
        ],
        total=total,
        page=page,
        limit=limit
    )


@router.get("/contact-forms/{id}", response_model=ConsultationRequestResponse)
async def get_contact_form(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Get a specific contact form submission by ID"""
    submission = session.get(ConsultationRequest, id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact form submission not found"
        )

    return ConsultationRequestResponse(
        id=str(submission.id),
        first_name=submission.first_name,
        last_name=submission.last_name,
        email=submission.email,
        phone_number=submission.phone_number,
        message=submission.message,
        source_page_slug=submission.source_page_slug,
        status=submission.status,
        requested_at=submission.requested_at,
        updated_at=submission.updated_at
    )


@router.put("/contact-forms/{id}", response_model=ConsultationRequestResponse)
async def update_contact_form(
    id: UUID,
    request: UpdateConsultationRequestRequest,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Update a contact form submission (e.g., change status)"""
    submission = session.get(ConsultationRequest, id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact form submission not found"
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(submission, key, value)

    submission.updated_at = datetime.utcnow()
    session.add(submission)
    session.commit()
    session.refresh(submission)

    return ConsultationRequestResponse(
        id=str(submission.id),
        first_name=submission.first_name,
        last_name=submission.last_name,
        email=submission.email,
        phone_number=submission.phone_number,
        message=submission.message,
        source_page_slug=submission.source_page_slug,
        status=submission.status,
        requested_at=submission.requested_at,
        updated_at=submission.updated_at
    )


@router.delete("/contact-forms/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_form(
    id: UUID,
    session: Session = Depends(get_session),
    current_user: AdminUser = Depends(get_current_user)
):
    """Delete a contact form submission"""
    submission = session.get(ConsultationRequest, id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact form submission not found"
        )

    session.delete(submission)
    session.commit()
