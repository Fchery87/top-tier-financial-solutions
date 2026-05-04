# ADR 0001: AI Renders Approved Dispute Policy

## Status

Accepted

## Context

The system generates credit dispute letters for a regulated credit restoration workflow. Dispute letters may contain factual claims, legal citations, evidence references, and escalation language. If AI is allowed to infer eligibility, reason codes, evidence requirements, or claim risk from free text, it can create compliance risk by inventing facts or upgrading claims beyond what the client confirmed.

The product still benefits from AI-generated language because staff need efficient, polished, client-specific letters.

## Decision

AI is a Letter Renderer only.

Deterministic application code decides dispute policy before AI is invoked, including eligibility, reason codes, required evidence, claim risk, target recipient, and escalation path.

AI may draft letter language from approved inputs, but it must not decide policy, invent facts, add unapproved reason codes, or upgrade a claim to a higher-risk category.

## Consequences

This reduces compliance risk and makes dispute decisions auditable.

It requires a deterministic dispute policy engine and stronger tests around policy decisions.

Letter generation may be less flexible than a fully AI-driven workflow, but safer and easier to explain during audits or reviews.
