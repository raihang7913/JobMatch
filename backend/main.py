from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from typing import Optional, List
from sqlalchemy.orm import Session
import urllib.parse
import requests
from bs4 import BeautifulSoup
import os
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime
import sys

# ponytail: add parent dir to path for shared lib
sys.path.insert(0, str(Path(__file__).parent.parent))  # job-search-app/

from database import init_db, get_db, CV, JobSearch, Job
from job_search_common import parse_cv, match_jobs_with_cv, analyze_job_fit, optimize_cv_for_job

logger = logging.getLogger("jobsearch")

app = FastAPI(title="Job Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def get_session_id(x_session_id: str = Header(...)) -> str:
    """Validate session UUID. Client must send X-Session-Id header."""
    try:
        uuid.UUID(x_session_id, version=4)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid session")
    return x_session_id


def safe_filename(original: str) -> str:
    """UUID + sanitized extension. Prevents path traversal and name collision."""
    suffix = Path(original).suffix.lower()
    if suffix not in (".pdf", ".docx"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    return f"{uuid.uuid4().hex}{suffix}"


def sanitize_text(text: str) -> str:
    """Strip HTML/script tags from scraped or parsed text. bleach preferred, fallback to strip."""
    try:
        import bleach
        return bleach.clean(text, tags=[], strip=True)
    except ImportError:
        import re
        return re.sub(r'<[^>]+>', '', text)


class RateLimiter:
    """In-memory sliding window rate limiter. ponytail: swap for Redis in production."""
    def __init__(self):
        from collections import defaultdict
        self._hits = defaultdict(list)

    def is_limited(self, key: str, limit: int, window: int) -> bool:
        import time
        now = time.time()
        self._hits[key] = [t for t in self._hits[key] if now - t < window]
        if len(self._hits[key]) >= limit:
            return True
        self._hits[key].append(now)
        return False


_limiter = RateLimiter()


init_db()


class SearchJobsRequest(BaseModel):
    query: str
    location: str = ""
    source: str = "both"
    limit: int = 10

    @field_validator('query')
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError('query must be 2-100 characters')
        return v

    @field_validator('source')
    @classmethod
    def validate_source(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ('jobstreet', 'indeed', 'both'):
            raise ValueError('source must be one of: jobstreet, indeed, both')
        return v

    @field_validator('limit')
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if not 1 <= v <= 50:
            raise ValueError('limit must be between 1 and 50')
        return v






class MatchJobsRequest(BaseModel):
    query: str
    location: str = ""
    source: str = "jobstreet"
    top_n: int = 10
    offset: int = 0
    match_mode: str = "skills"
    sort_by: str = "relevance"

    @field_validator('query')
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError('query must be 2-100 characters')
        return v

    @field_validator('source')
    @classmethod
    def validate_source(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ('jobstreet', 'indeed', 'both'):
            raise ValueError('source must be one of: jobstreet, indeed, both')
        return v

    @field_validator('top_n')
    @classmethod
    def validate_top_n(cls, v: int) -> int:
        if not 1 <= v <= 50:
            raise ValueError('top_n must be between 1 and 50')
        return v

    @field_validator('offset')
    @classmethod
    def validate_offset(cls, v: int) -> int:
        if v < 0:
            raise ValueError('offset must be >= 0')
        return v

    @field_validator('match_mode')
    @classmethod
    def validate_match_mode(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ('skills', 'semantic', 'hybrid'):
            raise ValueError('match_mode must be one of: skills, semantic, hybrid')
        return v

    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ('relevance', 'date'):
            raise ValueError('sort_by must be one of: relevance, date')
        return v


class AnalyzeJobFitRequest(BaseModel):
    job_url: str

    @field_validator('job_url')
    @classmethod
    def validate_job_url(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 2000:
            raise ValueError('job_url must be at most 2000 characters')
        parsed = urllib.parse.urlparse(v)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('job_url must be a valid HTTP or HTTPS URL')
        return v


class OptimizeCVRequest(BaseModel):
    job_title: str = ""
    job_description: str = ""
    company: str = ""
    job_url: str = ""

    @field_validator('job_title')
    @classmethod
    def validate_job_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 200:
            raise ValueError('job_title must be at most 200 characters')
        return v


def search_indeed(query: str, location: str = "", limit: int = 10) -> list[dict]:
    """Search for jobs on Indeed Indonesia"""
    base_url = "https://id.indeed.com/jobs"
    params = {"q": query, "l": location, "radius": "25", "limit": limit}
    url = f"{base_url}?{urllib.parse.urlencode(params)}"

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        jobs = []
        job_cards = soup.find_all('div', class_='job_seen_beacon')

        for card in job_cards[:limit]:
            try:
                title_elem = card.find('h2', class_='jobTitle')
                company_elem = card.find('span', class_='companyName')
                location_elem = card.find('div', class_='companyLocation')
                summary_elem = card.find('div', class_='job-snippet')

                job_link = title_elem.find('a') if title_elem else None
                job_id = job_link.get('data-jk', '') if job_link else ''

                job = {
                    "title": sanitize_text(title_elem.get_text(strip=True)) if title_elem else "N/A",
                    "company": sanitize_text(company_elem.get_text(strip=True)) if company_elem else "N/A",
                    "location": sanitize_text(location_elem.get_text(strip=True)) if location_elem else "N/A",
                    "summary": sanitize_text(summary_elem.get_text(strip=True)) if summary_elem else "N/A",
                    "url": f"https://www.indeed.com/viewjob?jk={job_id}" if job_id else url,
                    "source": "Indeed"
                }
                jobs.append(job)
            except Exception:
                continue

        return jobs if jobs else [{"error": "No jobs found", "url": url}]

    except Exception as e:
        logger.error(f"Indeed search failed: {e}")
        return [{"error": "Search failed"}]


def get_jobstreet_total_count() -> int:
    """Scrape total job count from Jobstreet Indonesia"""
    try:
        # Use search page with generic keywords to get total count
        url = "https://id.jobstreet.com/id/jobs"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Debug: Look for text containing numbers
        print(f"[DEBUG] Searching for job count in page...")
        
        # Try multiple selectors that might contain job count
        # Method 1: Look for any text containing "job" or "lowongan" with numbers
        all_text = soup.get_text()
        import re
        
        # Pattern: "10,249 jobs" or "10.249 lowongan" etc
        patterns = [
            r'([\d,\.]+)\s*(?:jobs|lowongan|pekerjaan)',
            r'(?:jobs|lowongan|pekerjaan)\s*([\d,\.]+)',
            r'Showing\s*([\d,\.]+)',
            r'([\d,\.]+)\s*results'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            if matches:
                # Get first match and clean it
                count_str = matches[0].replace(',', '').replace('.', '')
                if count_str.isdigit():
                    count = int(count_str)
                    # Better sanity checks:
                    # - Should be > 1000 (job counts are in thousands)
                    # - Should NOT be a year (avoid 2024, 2025, 2026, etc.)
                    if count > 1000 and not (2020 <= count <= 2030):
                        print(f"[DEBUG] Found count: {count}")
                        return count
                    else:
                        print(f"[DEBUG] Rejected {count} (likely year or invalid)")
        
        print(f"[DEBUG] No count found, using fallback")
        return 10249  # Fallback if can't find
    except Exception as e:
        print(f"[DEBUG] Error scraping: {e}")
        return 10249  # Fallback on error


def scrape_job_detail(job_url: str) -> dict:
    """Fetch job detail page and extract description, skills, salary, etc."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        resp = requests.get(job_url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        title_el = soup.find(attrs={'data-automation': 'job-detail-title'})
        company_el = soup.find(attrs={'data-automation': 'advertiser-name'})
        desc_el = soup.find(attrs={'data-automation': 'jobAdDetails'})
        salary_el = soup.find(attrs={'data-automation': 'job-detail-salary'})
        classif_el = soup.find(attrs={'data-automation': 'job-detail-classifications'})

        return {
            'title': sanitize_text(title_el.get_text(strip=True)) if title_el else '',
            'company': sanitize_text(company_el.get_text(strip=True)) if company_el else '',
            'description': sanitize_text(desc_el.get_text(separator='\n', strip=True)) if desc_el else '',
            'salary': sanitize_text(salary_el.get_text(strip=True)) if salary_el else '',
            'classifications': sanitize_text(classif_el.get_text(strip=True)) if classif_el else '',
        }
    except Exception as e:
        logger.warning(f"Failed to scrape job detail: {e}")
        return {}


def search_jobstreet(query: str, location: str = "", limit: int = 10) -> list[dict]:
    """Search for jobs on Jobstreet Indonesia with multi-page support"""
    query_formatted = query.replace(" ", "-")
    location_param = f"in-{location}" if location else ""
    base_url = f"https://id.jobstreet.com/id/{query_formatted}-jobs/{location_param}"

    jobs = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    # Scrape multiple pages to get more results (up to 3 pages = ~90 jobs)
    max_pages = 3
    jobs_per_page = 30  # Jobstreet typically shows 30 jobs per page
    
    for page_num in range(1, max_pages + 1):
        # Stop if we already have enough jobs
        if len(jobs) >= limit:
            break
        
        # Construct URL for current page
        if page_num == 1:
            url = base_url
        else:
            # Jobstreet pagination: ?page=2, ?page=3, etc.
            separator = "&" if "?" in base_url else "?"
            url = f"{base_url}{separator}page={page_num}"
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            job_cards = soup.find_all('article', attrs={'data-automation': 'normalJob'})
            
            # If no jobs found on this page, stop paginating
            if not job_cards:
                break

            for card in job_cards:
                try:
                    title_elem = card.find('a', attrs={'data-automation': 'jobTitle'})
                    company_elem = card.find('a', attrs={'data-automation': 'jobCompany'})
                    location_elem = card.find('a', attrs={'data-automation': 'jobLocation'})
                    
                    # Try to extract posting date - Jobstreet doesn't use data-automation for dates
                    # Look for date patterns in span elements
                    posted_date = None
                    date_elem = None
                    
                    # Search for date patterns in all spans
                    for span in card.find_all('span'):
                        text = span.get_text(strip=True)
                        text_lower = text.lower()
                        
                        # Skip if this is a classification or other metadata
                        if span.get('data-automation') in ['jobClassification', 'jobSubClassification', 'jobCardLocation', 'jobSalary']:
                            continue
                        
                        # Look for specific date patterns (more strict)
                        # Must contain: number + time unit OR specific keywords
                        has_time_pattern = False
                        
                        # Check for "X jam/hari/minggu/bulan yang lalu" or "X hours/days/weeks/months ago"
                        time_patterns = [
                            r'\d+\s*(jam|hari|minggu|bulan|hour|day|week|month)',  # "4 hari", "11 jam"
                            r'(today|yesterday|hari ini|kemarin)',  # today/yesterday
                            r'\d+\s*(jam|hari|minggu|bulan)\s*(yang lalu)',  # "4 hari yang lalu"
                            r'\d+\s*(hour|day|week|month)s?\s*ago'  # "4 days ago"
                        ]
                        
                        import re
                        for pattern in time_patterns:
                            if re.search(pattern, text_lower):
                                has_time_pattern = True
                                break
                        
                        # Only accept if it matches time pattern AND is short
                        if has_time_pattern and len(text) < 30:
                            posted_date = text
                            break
                    
                    # Parse relative date to days ago (for sorting)
                    days_ago = 999  # Default: very old
                    if posted_date:
                        posted_lower = posted_date.lower()
                        if 'hour' in posted_lower or 'jam' in posted_lower or 'today' in posted_lower or 'hari ini' in posted_lower:
                            days_ago = 0
                        elif '1 day' in posted_lower or '1 hari' in posted_lower or 'yesterday' in posted_lower or 'kemarin' in posted_lower:
                            days_ago = 1
                        elif 'day' in posted_lower or 'hari' in posted_lower:
                            # Extract number: "3 days ago" -> 3
                            import re
                            match = re.search(r'(\d+)', posted_lower)
                            if match:
                                days_ago = int(match.group(1))
                        elif 'week' in posted_lower or 'minggu' in posted_lower:
                            match = re.search(r'(\d+)', posted_lower)
                            weeks = int(match.group(1)) if match else 1
                            days_ago = weeks * 7
                        elif 'month' in posted_lower or 'bulan' in posted_lower:
                            match = re.search(r'(\d+)', posted_lower)
                            months = int(match.group(1)) if match else 1
                            days_ago = months * 30

                    job_url = title_elem.get('href', '') if title_elem else ''
                    if job_url and not job_url.startswith('http'):
                        job_url = f"https://id.jobstreet.com{job_url}"

                    job = {
                        "title": sanitize_text(title_elem.get_text(strip=True)) if title_elem else "N/A",
                        "company": sanitize_text(company_elem.get_text(strip=True)) if company_elem else "N/A",
                        "location": sanitize_text(location_elem.get_text(strip=True)) if location_elem else "N/A",
                        "url": job_url if job_url else url,
                        "source": "Jobstreet",
                        "posted_date": sanitize_text(posted_date or "N/A"),
                        "days_ago": days_ago
                    }
                    jobs.append(job)
                except Exception:
                    continue
        
        except Exception as e:
            # If a page fails, continue to next page
            print(f"Failed to scrape page {page_num}: {str(e)}")
            continue
    
    return jobs if jobs else [{"error": "No jobs found", "url": base_url}]



@app.post("/api/session")
def create_session():
    """Create anonymous session. No auth needed — this IS the auth bootstrap."""
    return {"session_id": str(uuid.uuid4())}


@app.get("/")
def root():
    return {"message": "Job Search API", "version": "1.0.0"}


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get real-time statistics from Jobstreet data"""
    try:
        # Scrape actual job count from Jobstreet website
        total_jobs = get_jobstreet_total_count()
        
        # Calculate growth (TODO: track historical data for real growth)
        growth_percentage = 12  # Mock growth for now
        
        return {
            "total_jobs": total_jobs,
            "growth_percentage": growth_percentage,
            "platforms": ["jobstreet"],
            "scraper_status": "operational"
        }
    except Exception as e:
        # Fallback to mock data if scraping fails
        return {
            "total_jobs": 10249,
            "growth_percentage": 12,
            "platforms": ["jobstreet"],
            "scraper_status": "operational"
        }


@app.post("/api/search-jobs")
def search_jobs(request: SearchJobsRequest, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    # Rate limit: 10 searches per minute per session
    if _limiter.is_limited(f"search:{session_id}", limit=10, window=60):
        raise HTTPException(status_code=429, detail="Too many searches. Try again in a minute.")

    all_jobs = []

    if request.source in ["indeed", "both"]:
        indeed_jobs = search_indeed(request.query, request.location, request.limit)
        all_jobs.extend(indeed_jobs)

    if request.source in ["jobstreet", "both"]:
        jobstreet_jobs = search_jobstreet(request.query, request.location, request.limit)
        all_jobs.extend(jobstreet_jobs)

    job_search = JobSearch(
        query=request.query,
        location=request.location,
        source=request.source,
        results=json.dumps(all_jobs)
    )
    db.add(job_search)
    db.commit()

    return {"jobs": all_jobs, "total": len(all_jobs)}


@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...), session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    # Validate MIME via magic bytes, not client Content-Type header
    content = await file.read()
    file.seek(0)  # Reset for later save

    magic = content[:8]
    is_pdf = magic[:4] == b'%PDF'
    # DOCX: ZIP signature (PK) + OOXML-specific bytes
    is_docx = (magic[:4] == b'PK\x03\x04' and b'word' in content[:2048].lower())

    if not is_pdf and not is_docx:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    # Rate limit: 5 uploads per minute per session
    if _limiter.is_limited(f"upload:{session_id}", limit=5, window=60):
        raise HTTPException(status_code=429, detail="Too many uploads. Try again in a minute.")

    try:
        filename = safe_filename(file.filename)
        file_path = uploads_dir / filename

        # content already read above for magic bytes validation
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large (max 10MB)")
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        with open(file_path, "wb") as f:
            f.write(content)

        cv_data = parse_cv(str(file_path))

        cv_record = CV(
            session_id=session_id,
            filename=filename,
            file_path=str(file_path),
            parsed_data=json.dumps(cv_data)
        )
        db.add(cv_record)
        db.commit()
        db.refresh(cv_record)

        return {
            "cv_id": cv_record.id,
            "filename": filename,
            "name": cv_data.get('name', 'N/A'),
            "email": cv_data.get('email', 'N/A'),
            "phone": cv_data.get('phone', 'N/A'),
            "location": cv_data.get('location', 'N/A'),
            "skills": cv_data.get('skills', []),
            "experience_count": len(cv_data.get('experience', [])),
            "projects": cv_data.get('projects', []),
            "projects_count": len(cv_data.get('projects', [])),
            "education": cv_data.get('education', []),
            "education_count": len(cv_data.get('education', []))
        }
    except HTTPException:
        raise  # re-raise our own validation errors
    except Exception as e:
        logger.error(f"CV parse failed: {e}")
        # ponytail: log real error server-side, send generic message to client
        raise HTTPException(status_code=500, detail="Failed to parse CV")






@app.get("/api/cvs")
def get_cvs(session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cvs = db.query(CV).filter(CV.session_id == session_id).order_by(CV.uploaded_at.desc()).all()
    return {
        "cvs": [
            {
                "id": cv.id,
                "filename": Path(cv.file_path).name,
                "uploaded_at": cv.uploaded_at.isoformat(),
                "parsed_data": cv.parsed_dict
            }
            for cv in cvs
        ]
    }


@app.get("/api/cvs/{cv_id}")
def get_cv(cv_id: int, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")

    return {
        "id": cv.id,
        "filename": Path(cv.file_path).name,
        "uploaded_at": cv.uploaded_at.isoformat(),
        "parsed_data": cv.parsed_dict
    }


@app.post("/api/match-jobs/{cv_id}")
def match_jobs(cv_id: int, request: MatchJobsRequest, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")

    cv_data = cv.parsed_dict

    # Scrape more jobs to support pagination
    scrape_limit = 50  # Increased from 20 to support pagination
    jobs = []
    if request.source in ["indeed", "both"]:
        indeed_jobs = search_indeed(request.query, request.location, scrape_limit)
        jobs.extend(indeed_jobs)
    if request.source in ["jobstreet", "both"]:
        jobstreet_jobs = search_jobstreet(request.query, request.location, scrape_limit)
        jobs.extend(jobstreet_jobs)

    # Match and filter jobs
    matched_jobs = match_jobs_with_cv(cv_data, jobs, request.match_mode)
    matched_jobs_filtered = [j for j in matched_jobs if 'match_score' in j]
    
    # Sort jobs based on sort_by parameter
    if request.sort_by == "date":
        # Sort by posting date (newest first = lowest days_ago first)
        matched_jobs_filtered.sort(key=lambda x: x.get('days_ago', 999))
    else:  # "relevance" (default)
        # Already sorted by match_score in match_jobs_with_cv, but re-sort to ensure
        matched_jobs_filtered.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    # Apply pagination with offset and limit
    total_count = len(matched_jobs_filtered)
    start_idx = request.offset
    end_idx = start_idx + request.top_n
    paginated_jobs = matched_jobs_filtered[start_idx:end_idx]

    return {"matched_jobs": paginated_jobs, "total": total_count, "offset": request.offset, "limit": request.top_n}


@app.post("/api/analyze-job-fit/{cv_id}")
def analyze_fit(cv_id: int, request: AnalyzeJobFitRequest, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")

    cv_data = cv.parsed_dict

    # Fetch real job content from URL
    detail = scrape_job_detail(request.job_url)
    job = {
        'title': detail.get('title') or request.job_url,
        'company': detail.get('company') or 'Target Company',
        'summary': detail.get('description', '')[:500],
        'description': detail.get('description', ''),
        'salary': detail.get('salary', ''),
        'classifications': detail.get('classifications', ''),
        'url': request.job_url,
    }

    analysis = analyze_job_fit(cv_data, job)
    return analysis


@app.post("/api/optimize-cv/{cv_id}")
def optimize_cv(cv_id: int, request: OptimizeCVRequest, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")

    cv_data = cv.parsed_dict

    # Fetch real job data from URL if provided, else use request fields
    if request.job_url:
        detail = scrape_job_detail(request.job_url)
        job = {
            'title': detail.get('title') or request.job_title,
            'company': detail.get('company') or request.company or 'Target Company',
            'summary': detail.get('description', '')[:500],
            'description': detail.get('description', ''),
            'salary': detail.get('salary', ''),
            'classifications': detail.get('classifications', ''),
            'url': request.job_url,
        }
    else:
        job = {
            'title': request.job_title,
            'company': request.company or 'Target Company',
            'summary': request.job_description or request.job_title,
            'description': request.job_description or ''
        }

    optimization = optimize_cv_for_job(cv_data, job)
    return optimization


@app.post("/api/demo")
def load_demo(session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    demo_data = {
        'name': 'John Doe',
        'email': 'john.doe@email.com',
        'phone': '+62 812-3456-7890',
        'location': 'Jakarta, Indonesia',
        'skills': ['Python', 'JavaScript', 'React', 'Node.js', 'FastAPI', 'SQL', 'Git', 'Docker', 'AWS', 'REST API'],
        'experience': [
            {'title': 'Full Stack Developer', 'company': 'Tech Corp', 'dates': '2022 - Present', 'description': 'Developed web applications using React and FastAPI. Managed PostgreSQL databases and deployed on AWS.'},
            {'title': 'Junior Developer', 'company': 'StartupXYZ', 'dates': '2020 - 2022', 'description': 'Built REST APIs with Node.js and Express. Worked with MongoDB and Redis for data storage.'}
        ],
        'projects': [
            {'name': 'E-Commerce Platform', 'description': 'Full-stack e-commerce with React frontend and FastAPI backend'},
            {'name': 'Job Search App', 'description': 'AI-powered job matching application'}
        ],
        'education': [
            {'degree': 'Bachelor of Computer Science', 'institution': 'University of Indonesia', 'year': '2020'}
        ]
    }
    
    cv_record = CV(
        session_id=session_id,
        filename='demo-cv.pdf',
        file_path='demo',
        parsed_data=json.dumps(demo_data)
    )
    db.add(cv_record)
    db.commit()
    db.refresh(cv_record)
    
    return {
        'cv_id': cv_record.id,
        'filename': 'demo-cv.pdf',
        'name': demo_data['name'],
        'email': demo_data['email'],
        'phone': demo_data['phone'],
        'location': demo_data['location'],
        'skills': demo_data['skills'],
        'experience_count': len(demo_data['experience']),
        'projects': demo_data['projects'],
        'projects_count': len(demo_data['projects']),
        'education': demo_data['education'],
        'education_count': len(demo_data['education'])
    }


@app.get("/api/download-cv/{cv_id}")
def download_cv(cv_id: int, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    file_path = Path(cv.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = 'application/pdf' if str(file_path).endswith('.pdf') else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    return FileResponse(path=str(file_path), media_type=media_type, filename=cv.filename)


@app.get("/api/demo-jobs")
def get_demo_jobs():
    """Return sample job listings for demo/testing."""
    return {
        "jobs": [
            {
                "title": "Senior Frontend Developer",
                "company": "Gojek Indonesia",
                "location": "Jakarta",
                "description": "Build and maintain high-performance React applications serving millions of users. Experience with TypeScript and design systems preferred.",
                "url": "https://id.jobstreet.com/id/senior-frontend-developer-jobs",
                "source": "Jobstreet",
                "posted_date": "2 days ago"
            },
            {
                "title": "Full Stack Engineer",
                "company": "Tokopedia",
                "location": "Jakarta",
                "description": "Develop end-to-end features using React and Node.js. Work on payment integration and merchant dashboards.",
                "url": "https://id.jobstreet.com/id/full-stack-engineer-jobs",
                "source": "Jobstreet",
                "posted_date": "3 days ago"
            },
            {
                "title": "Backend Developer (Python)",
                "company": "Traveloka",
                "location": "Jakarta",
                "description": "Design and implement REST APIs with FastAPI/Django. PostgreSQL, Redis, and Docker experience required.",
                "url": "https://id.jobstreet.com/id/backend-developer-jobs",
                "source": "Jobstreet",
                "posted_date": "1 week ago"
            },
            {
                "title": "DevOps Engineer",
                "company": "Bukalapak",
                "location": "Bandung",
                "description": "Manage CI/CD pipelines, Kubernetes clusters, and cloud infrastructure on AWS. Terraform and monitoring experience preferred.",
                "url": "https://id.jobstreet.com/id/devops-engineer-jobs",
                "source": "Jobstreet",
                "posted_date": "4 days ago"
            },
            {
                "title": "React Native Developer",
                "company": "Shopee Indonesia",
                "location": "Jakarta",
                "description": "Build cross-platform mobile apps with React Native. Experience with Redux, native modules, and app store deployment.",
                "url": "https://id.jobstreet.com/id/react-native-developer-jobs",
                "source": "Jobstreet",
                "posted_date": "5 days ago"
            },
            {
                "title": "Data Engineer",
                "company": "OVO (GoPay)",
                "location": "Jakarta",
                "description": "Build data pipelines using Python, Spark, and Airflow. Work on real-time analytics for financial products.",
                "url": "https://id.jobstreet.com/id/data-engineer-jobs",
                "source": "Jobstreet",
                "posted_date": "1 week ago"
            },
            {
                "title": "Full Stack Developer",
                "company": "DANA Indonesia",
                "location": "Jakarta",
                "description": "Develop payment gateway features with React frontend and Python backend. Microservices architecture experience preferred.",
                "url": "https://id.jobstreet.com/id/full-stack-developer-jobs",
                "source": "Jobstreet",
                "posted_date": "3 days ago"
            },
            {
                "title": "Frontend Engineer (Vue.js)",
                "company": "Ruangguru",
                "location": "Jakarta",
                "description": "Build interactive learning platforms using Vue.js and TypeScript. Accessibility and performance optimization skills valued.",
                "url": "https://id.jobstreet.com/id/frontend-engineer-jobs",
                "source": "Jobstreet",
                "posted_date": "2 days ago"
            },
            {
                "title": "Cloud Solutions Architect",
                "company": "Telkomsel",
                "location": "Jakarta",
                "description": "Design scalable cloud architectures on GCP/AWS. Docker, Kubernetes, and infrastructure-as-code expertise required.",
                "url": "https://id.jobstreet.com/id/cloud-solutions-architect-jobs",
                "source": "Jobstreet",
                "posted_date": "1 week ago"
            },
            {
                "title": "Mobile Developer (Flutter)",
                "company": "Blibli",
                "location": "Jakarta",
                "description": "Create beautiful mobile experiences with Flutter and Dart. Firebase integration and CI/CD knowledge preferred.",
                "url": "https://id.jobstreet.com/id/mobile-developer-jobs",
                "source": "Jobstreet",
                "posted_date": "4 days ago"
            }
        ],
        "total": 10
    }
