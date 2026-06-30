# Job Search App - Local Development Setup

## Overview
A full-stack job search platform with AI-powered CV matching for the Indonesian job market.

**Stack:** React 18 + Vite + Tailwind (frontend) | Python 3.11 + FastAPI + SQLite (backend)

## Prerequisites
- Python 3.11+
- Node.js 18+
- Git

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows
# or: source .venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
```

Start backend (runs on http://localhost:8000):
```bash
python main.py
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

### 3. Run Both (from root)

```bash
npm run dev
```

This starts both backend and frontend concurrently.

## Project Structure

```
job-search-app/
├── backend/
│   ├── .venv/              # Python virtual environment
│   ├── main.py             # FastAPI entry point
│   ├── database.py         # SQLAlchemy models
│   ├── requirements.txt    # Python dependencies
│   └── uploads/            # File upload storage
├── frontend/
│   ├── src/                # React components
│   ├── package.json        # NPM dependencies
│   ├── vite.config.js      # Vite configuration
│   └── tailwind.config.js  # Tailwind CSS config
├── job_search_common/      # Shared Python utilities
└── SETUP.md                # This file
```

## Key Features

- **Job Search** — Real-time scraping from Jobstreet Indonesia & Indeed
- **CV Parser** — Upload PDF/DOCX resumes with AI skill extraction
- **Smart Matching** — Score jobs against your CV (skills, semantic, hybrid modes)
- **CV Optimizer** — Get tailored suggestions for target job titles
- **Job Fit Analyzer** — Analyze how well your CV fits specific postings
- **Demo Mode** — Load sample data instantly
- **Dark/Light Mode** — Automatic theme based on system preference
- **Anonymous Sessions** — No login required; UUID-based isolation

## Tech Stack Details

| Component | Technology |
|-----------|------------|
| Backend | FastAPI 0.120.0, SQLAlchemy 2.0.35, SQLite |
| Frontend | React 18.3.1, Vite 8.0.16, Tailwind CSS 3.4 |
| CV Parsing | PyPDF2, pdfplumber, python-docx |
| Web Scraping | BeautifulSoup4, requests |
| ML/Embeddings | sentence-transformers |
| Security | Pydantic validation, magic-byte MIME checks, rate limiting |

## API Endpoints

- `POST /api/upload` — Upload CV (PDF/DOCX)
- `GET /api/demo` — Load demo CV and jobs
- `POST /api/search-jobs` — Search jobs from web
- `POST /api/match-jobs` — Score jobs against CV
- `POST /api/analyze-fit` — Analyze job fit for CV
- `POST /api/optimize-cv` — Get CV optimization suggestions

## Development Notes

- Backend CORS is configured for `http://localhost:5173`
- Sessions use UUID header: `X-Session-Id`
- Database auto-initializes on first run
- Uploads stored in `backend/uploads/` (10 MB limit)
- Frontend hot-reloads on file changes (Vite)

## Troubleshooting

**Backend won't start:**
- Ensure Python 3.11+ is installed
- Activate venv: `source .venv/Scripts/activate` (Windows)
- Check port 8000 is free

**Frontend won't start:**
- Delete `node_modules/` and `package-lock.json`, then `npm install`
- Check Node.js version: `node --version` (need 18+)
- Port 5173 must be free

**Missing dependencies:**
- Backend: `pip install -r requirements.txt`
- Frontend: `npm install`

## Testing

Run backend tests:
```bash
cd backend
source .venv/Scripts/activate
pytest test_basic.py -v
```

## Environment Variables

See `.env.example` for available config options.
