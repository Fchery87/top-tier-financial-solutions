"""Persistence queries that define public content visibility."""

from sqlmodel import Session, select

from ..models import Disclaimer, FAQItem, Page, Testimonial


def get_published_page(session: Session, slug: str) -> Page | None:
    statement = select(Page).where(Page.slug == slug, Page.is_published == True)
    return session.exec(statement).first()


def list_approved_testimonials(session: Session) -> list[Testimonial]:
    statement = select(Testimonial).where(
        Testimonial.is_approved == True
    ).order_by(Testimonial.order_index)
    return list(session.exec(statement).all())


def list_active_disclaimers(session: Session) -> list[Disclaimer]:
    statement = select(Disclaimer).where(Disclaimer.is_active == True)
    return list(session.exec(statement).all())


def list_published_faqs(session: Session) -> list[FAQItem]:
    statement = select(FAQItem).where(
        FAQItem.is_published == True
    ).order_by(FAQItem.display_order)
    return list(session.exec(statement).all())
