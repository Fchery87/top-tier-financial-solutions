# ADR 0002: Gate Billing by Services Rendered

## Status

Accepted

## Context

Credit restoration services are subject to strict consumer protection requirements. The product must avoid enabling advance-fee billing or automated charges before qualifying work has been performed. Some result-based or telemarketing-related billing scenarios may require even stricter verification before fees are collected.

The schema already models invoices, services rendered, payment audit logs, fee configurations, and billing profiles. Live payment processor charging would increase compliance risk if it can occur before those controls are enforced.

## Decision

Invoices and payment status may be tracked now, but live payment collection is deferred until billing compliance enforcement exists.

An invoice may become payable only after a qualifying Services Rendered event is recorded.

When result-based or telemarketing-related billing rules apply, a Results-Verified Billing Lock overrides ordinary invoice readiness and blocks fees until the required result verification and supporting report timing are satisfied.

## Consequences

This keeps billing behavior aligned with credit repair compliance expectations and creates an audit trail for why a charge was allowed.

It delays payment automation and requires explicit service-event records before charging.

Billing features must be designed around compliance gates rather than generic subscription billing assumptions.
