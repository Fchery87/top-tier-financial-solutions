from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import create_db_and_tables
from .routers import admin_content, admin_leads, auth, public


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to create database tables on startup"""
    print("Creating database tables...")
    create_db_and_tables()
    print("Database tables created successfully!")
    yield


app = FastAPI(
    title="Top Tier Financial Solutions API",
    version="1.0.0",
    description="API for Top Tier Financial Solutions website",
    lifespan=lifespan
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(admin_content.router, prefix="/api/v1")
app.include_router(admin_leads.router, prefix="/api/v1")


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    print(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


@app.get("/api/hello")
def hello_world():
    """Health check endpoint"""
    return {"message": "Hello from FastAPI"}


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Top Tier Financial Solutions API",
        "version": "1.0.0",
        "docs": "/docs"
    }
