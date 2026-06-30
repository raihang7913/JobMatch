---
name: project_job-search-app
description: "Job search web app with AI-powered CV matching for Indonesia job boards (Indeed, Jobstreet)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5cbed2c7-6449-4e33-ae89-f7408dba1cb1
---

# Job Search Application (JobMatch Indonesia)

A web application that helps job seekers in Indonesia find relevant positions through AI-powered CV analysis and smart job matching.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS v3.4.0
- **Backend**: FastAPI (Python) with SQLAlchemy
- **MCP Server**: Model Context Protocol server for Claude integration
- **Shared Library**: `job_search_common/` - consolidated modules shared between MCP server and backend

## Key Features
1. **Job Search**: Search jobs from Indeed and Jobstreet Indonesia with real-time results
2. **CV Upload & Analysis**: Upload PDF/DOCX CV, AI parses skills, experience, contact info
3. **Smart Job Matching**: AI-powered matching that compares CV skills against job requirements and provides match scores (0-100%)

## Directory Structure
```
job-search-app/
├── frontend/           # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/     # SearchPage, CVPage, MatchPage
│   │   └── api/       # API client
├── backend/           # FastAPI server
│   └── main.py
└── job-search-mcp/    # MCP server for Claude
    └── server.py

job_search_common/     # Shared library (outside app dir)
├── cv_parser.py
├── job_matcher.py
├── cv_optimizer.py
├── cv_generator.py
├── pdf_converter.py
└── html_cv_optimizer.py
```

## Recent Work (June 2026)
Complete professional frontend redesign with:
- Geist font (replaced Inter - taste-skill recommendation)
- Phosphor icons library (replaced all emojis)
- Enhanced glassmorphism design with backdrop blur effects
- Hero sections with clear value propositions on all pages
- Circular progress match score visualization
- Skeleton loading states
- Professional typography hierarchy and spacing
- Better micro-interactions and animations

## How to Start
- Backend: `cd job-search-app/backend && uvicorn main:app --reload` (port 8000)
- Frontend: `cd job-search-app/frontend && npm run dev` (auto-selects available port, usually 5173-5176)

**Why:** This is an active project the user is developing to help Indonesian job seekers. The AI matching feature differentiates it from basic job boards.

**How to apply:** When working on this project, prioritize professional, modern design that builds trust with job seekers. Indonesian context is important - job boards are Indeed and Jobstreet (not LinkedIn, Monster, etc.).
