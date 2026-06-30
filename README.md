# 🎯 JOBMATCH.ID

> AI-powered job search platform with CV matching for the Indonesian job market.

## Features

- **Job Search** — Search jobs from Jobstreet Indonesia and Indeed with real-time web scraping
- **CV Parser** — Upload PDF or DOCX resumes with AI-powered skill extraction
- **Smart Matching** — Score and rank jobs against your CV using skill-based matching (supports `skills`, `semantic`, and `hybrid` modes)
- **CV Optimizer** — Get tailored CV suggestions for a target job title (dual backend: cloud API + local 9Router)
- **Job Fit Analyzer** — Analyze how well your CV fits a specific job posting
- **Demo Mode** — Load sample CV and job data instantly without uploading anything
- **Dark / Light Mode** — Automatic theme toggle that respects your system preference
- **Anonymous Sessions** — No login required; every session is isolated via a UUID

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy, SQLite, BeautifulSoup, Pydantic |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router, Axios, Phosphor Icons |
| **Security** | Anonymous UUID sessions, magic-byte MIME validation, in-memory rate limiting, Pydantic input validation |

## Architecture

```
┌─────────────────────┐         HTTP/JSON          ┌──────────────────────┐
│   React Frontend    │ ◄────────────────────────► │   FastAPI Backend    │
│   (Vite, port 5173) │   X-Session-Id header      │   (port 8000)        │
└─────────────────────┘                            └──────────┬───────────┘
                                                              │
                                         ┌────────────────────┼────────────────────┐
                                         ▼                    ▼                    ▼
                                    SQLite DB           Web Scrapers        CV Parser
                               (SQLAlchemy ORM)    (Jobstreet, Indeed)   (PDF & DOCX)
```

The frontend generates a UUID session ID on first visit (stored in `localStorage`) and sends it as an `X-Session-Id` header on every request. The backend validates this UUID, isolates data per session, and scrapes job listings on-demand from Jobstreet and Indeed Indonesia.

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+

### Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd job-search-app

# Start both servers at once
bash start-dev.sh
```

Backend runs at `http://localhost:8000` | Frontend runs at `http://localhost:5173`

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
job-search-app/
├── backend/
│   ├── main.py                 # FastAPI app: routes, scrapers, validation
│   ├── database.py             # SQLAlchemy models (CV, JobSearch, Job)
│   ├── job_search_common.py    # CV parsing, matching, optimization logic
│   ├── requirements.txt        # Python dependencies
│   └── uploads/                # Uploaded CV files (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Router, theme toggle, layout
│   │   ├── api/
│   │   │   ├── client.js       # Axios instance with session injection
│   │   │   └── llmClient.js    # LLM API client for CV optimization
│   │   └── pages/
│   │       ├── SearchPage.jsx   # Job search interface
│   │       ├── CVPage.jsx       # CV upload & parsing
│   │       ├── MatchPage.jsx    # CV ↔ job matching
│   │       └── OptimizePage.jsx # CV optimization
│   └── package.json
├── start-dev.sh               # Launch both servers
├── start.bat / stop.bat       # Windows convenience scripts
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search-jobs` | Search jobs from Jobstreet/Indeed |
| `POST` | `/api/upload-cv` | Upload & parse a CV (PDF/DOCX) |
| `GET`  | `/api/cvs` | List all CVs for current session |
| `GET`  | `/api/cvs/{id}` | Get a specific CV's parsed data |
| `POST` | `/api/match-jobs/{id}` | Match jobs against a CV |
| `POST` | `/api/analyze-job-fit/{id}` | Analyze CV fit for a job URL |
| `POST` | `/api/optimize-cv/{id}` | Get CV optimization suggestions |
| `POST` | `/api/demo` | Load a sample CV |
| `POST` | `/api/demo-jobs` | Get sample job listings |
| `GET`  | `/api/stats` | Platform statistics |
| `GET`  | `/api/download-cv/{id}` | Download original CV file |

## Security Features

- **Magic-byte MIME validation** — Validates actual file content (`%PDF` / ZIP+OOXML signature), not the `Content-Type` header
- **Rate limiting** — 5 searches/min and 10 uploads/min per session (in-memory sliding window)
- **Input validation** — All inputs validated via Pydantic (query length, URL format, enum constraints)
- **Safe filenames** — Uploaded files renamed to random UUID + extension, preventing path traversal
- **HTML sanitization** — Scraped text cleaned of HTML/script tags via `bleach` (regex fallback)
- **Session isolation** — All data (CVs, searches) scoped to the caller's session UUID
- **Global exception handler** — Unhandled errors return generic messages, real errors logged server-side
- **CORS policy** — Locked to `localhost:5173` during development

## What I Learned

- **Web scraping at scale** — Jobstreet's HTML structure changes frequently; building resilient selectors with fallbacks was essential. Multi-page pagination adds complexity since you don't know total pages upfront.
- **Anonymous auth is underrated** — UUID sessions with header injection give strong data isolation without the UX friction of login/signup. Good enough for a tool; the upgrade path to JWT is straightforward.
- **MIME validation matters** — Relying on `Content-Type` headers is a security risk. Checking magic bytes at the protocol level catches spoofed uploads that would otherwise pass validation.

## Future Improvements

- **Semantic matching** — Move from pure skill-keyword matching to embeddings-based semantic similarity for better job recommendations
- **User authentication** — Add optional login to persist data across sessions and devices
- **Redis-backed rate limiter** — Replace in-memory rate limiting with Redis for production scalability
- **PDF generation** — Let users download an optimized version of their CV directly from the app
