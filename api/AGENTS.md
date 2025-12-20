# Python FastAPI Backend - Agent Development Guide

## Package Identity
FastAPI backend service for public website content management, lead capture, and basic admin functionality. Uses SQLModel for ORM, async/await patterns, and Pydantic for validation.

## Setup & Run
```bash
# From project root
./venv/bin/pip install -r requirements.txt
./venv/bin/python -m uvicorn api.index:app --reload --port 8000

# Or use npm script:
npm run fastapi-dev

# Lint Python code:
npm run lint:python

# Fix Python linting:
npm run lint:python:fix
```

## Patterns & Conventions

### File Organization
- Main app: `api/index.py` - FastAPI app configuration
- Models: `api/models.py` - SQLModel database models
- Routers: `api/routers/` - Route handlers by domain
- Database: `api/database.py` - Database connection and table creation

### FastAPI App Structure
```python
# ✅ DO: Copy from api/index.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to create database tables on startup"""
    print("Creating database tables...")
    create_db_and_tables()
    print("Database tables created successfully!")
    yield

app = FastAPI(
    title="Top Tier Financial Solutions API",
    lifespan=lifespan
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Model Definition Pattern
```python
# ✅ DO: Copy from api/models.py
from sqlmodel import SQLModel, Field
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum

class ConsultationStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    archived = "archived"

class ModelName(SQLModel, table=True):
    """Model description"""
    __tablename__ = "table_name"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Router Pattern
```python
# ✅ DO: Follow pattern in api/routers/
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/some-endpoint", tags=["some"])

@router.get("/")
async def get_items():
    """Get all items"""
    return {"items": []}

@router.post("/")
async def create_item(item_data: ItemCreate):
    """Create new item"""
    return {"message": "Created"}
```

### Error Handling Pattern
Use global exception handler:
```python
# ✅ DO: Add to main app
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    print(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

## Touch Points / Key Files
- Main app: `api/index.py`
- Database models: `api/models.py`
- Database setup: `api/database.py`
- Auth routes: `api/routers/auth.py`
- Admin content: `api/routers/admin_content.py`
- Lead management: `api/routers/admin_leads.py`
- Public endpoints: `api/routers/public.py`

## JIT Index Hints
- Find all routes: `rg -n "@router\.(get|post|put|delete)" api/routers/`
- Find models: `rg -n "class.*\(SQLModel" api/models.py`
- Find endpoints: `rg -n "APIRouter|prefix=" api/routers/`
- Search for database operations: `rg -n "async.*def.*\(.*session" api/`
- Find dependencies: `rg -n "Depends\(" api/routers/`
- Search for validation: `rg -n "Field\(" api/models.py`

## Common Gotchas
- Use async/await for all database operations
- SQLModel requires manual table creation in lifespan handler
- All endpoints should have proper type hints
- Use `Field(max_length=X)` for string fields
- Include proper docstrings for all endpoints
- Use HTTP status codes appropriately
- Return consistent JSON response format
- Always validate input data with Pydantic models

## Database Integration
- Uses SQLAlchemy async sessions
- Table creation happens on app startup
- Connection pool managed by SQLAlchemy
- Models defined with SQLModel (Pydantic + SQLAlchemy)

## Pre-PR Checks
```bash
npm run lint:python
./venv/bin/python -m pytest tests/  # if tests exist
```
