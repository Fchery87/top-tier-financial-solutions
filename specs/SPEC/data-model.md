---
title: Data Model
owner: architect
version: 1.0
date: 2025-11-29
status: draft
---

This data model outlines the core entities required for the Top Tier Financial Solutions MVP website, focusing on static content display and lead generation. It prioritizes conciseness and direct relevance to the PRD's functional requirements.

### 1. ER Diagram (Mermaid)

```mermaid
erDiagram
    pages {
        UUID id PK
        VARCHAR slug UNIQUE
        VARCHAR title
        JSONB main_content_json
    }
    services {
        UUID id PK
        VARCHAR name UNIQUE
        TEXT description
    }
    testimonials {
        UUID id PK
        VARCHAR author_name
        TEXT quote
    }
    disclaimers {
        UUID id PK
        VARCHAR name UNIQUE
        TEXT content
    }
    consultation_requests {
        UUID id PK
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR email
        VARCHAR phone_number
        TEXT message
        consultation_status status
    }

    pages ||--o{ consultation_requests : generates_lead
    pages ||--o{ services : lists
    pages ||--o{ testimonials : displays
    pages ||--o{ disclaimers : includes
```

### 2. Table Schemas

**pages** - Stores content for static website pages (e.g., Homepage, How It Works, Services, About).
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| slug | VARCHAR(255) | UNIQUE, NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| hero_headline | VARCHAR(500) | |
| hero_subheadline | TEXT | |
| main_content_json | JSONB | |
| cta_text | VARCHAR(255) | |
| cta_link | VARCHAR(2048) | |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |

**services** - Lists Top Tier's core credit repair offerings.
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | UNIQUE, NOT NULL |
| description | TEXT | NOT NULL |
| order_index | INTEGER | DEFAULT 0 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |

**testimonials** - Stores client testimonials for social proof.
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| author_name | VARCHAR(255) | NOT NULL |
| author_location | VARCHAR(255) | |
| quote | TEXT | NOT NULL |
| order_index | INTEGER | DEFAULT 0 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |

**disclaimers** - Contains legal disclaimers (e.g., "no guarantees").
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | UNIQUE, NOT NULL |
| content | TEXT | NOT NULL |
| display_hint | VARCHAR(255) | (e.g., 'footer', 'homepage-bottom') |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |

**consultation_requests** - Captures lead information from consultation booking forms.
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| first_name | VARCHAR(255) | NOT NULL |
| last_name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| phone_number | VARCHAR(50) | |
| message | TEXT | |
| source_page_slug | VARCHAR(255) | (e.g., 'homepage', 'services') |
| status | consultation_status | NOT NULL, DEFAULT 'new' |
| requested_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() |

### 3. Key Indexes

- `idx_pages_slug` on `pages(slug)`
- `idx_services_name` on `services(name)`
- `idx_testimonials_order` on `testimonials(order_index)`
- `idx_disclaimers_name` on `disclaimers(name)`
- `idx_consultation_requests_email` on `consultation_requests(email)`
- `idx_consultation_requests_status` on `consultation_requests(status)`

### 4. Enums

```sql
CREATE TYPE consultation_status AS ENUM ('new', 'contacted', 'qualified', 'archived');
```