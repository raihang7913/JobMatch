from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

DATABASE_URL = "sqlite:///./job_search.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=True, index=True)  # ponytail: nullable for migration, always set for new uploads
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    parsed_data = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    @property
    def parsed_dict(self):
        return json.loads(self.parsed_data)


class JobSearch(Base):
    __tablename__ = "job_searches"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=True, index=True)
    query = Column(String, nullable=False)
    location = Column(String, nullable=True)
    source = Column(String, nullable=False)
    results = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def results_list(self):
        return json.loads(self.results)


class Job(Base):
    """Store individual job listings scraped from Jobstreet"""
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    location = Column(String, nullable=True)
    url = Column(String, unique=True, nullable=False)  # URL as unique identifier
    description = Column(Text, nullable=True)
    source = Column(String, nullable=False, default="jobstreet")
    scraped_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
