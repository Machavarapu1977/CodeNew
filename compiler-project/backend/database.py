"""
Database connection and session configuration for the Compiler Project.
Connects to PostgreSQL database for managing Users, Roles, Questions, Test Cases, and Mock Tests.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL database URL
DATABASE_URL = "postgresql+psycopg2://postgres:password@localhost:5432/compiler_db"

try:
    engine = create_engine(DATABASE_URL, future=True)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception:
    # Fallback to local SQLite database if PostgreSQL is unavailable
    DATABASE_URL = "sqlite:///./compiler.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)
Base = declarative_base()


