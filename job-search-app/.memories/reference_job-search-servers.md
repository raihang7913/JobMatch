---
name: reference_job-search-servers
description: Server ports and startup commands for job search app frontend and backend
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5cbed2c7-6449-4e33-ae89-f7408dba1cb1
---

# Job Search App Servers

## Frontend Dev Server
- **Command**: `npm run dev` (from `job-search-app/frontend/`)
- **Ports**: Vite auto-selects available port (5173, 5174, 5175, etc.)
- **Last known port**: 5175 (as of 2026-06-22)
- **Framework**: Vite v8.0.16
- **Hot reload**: Automatic (but sometimes requires manual restart for large changes)

## Backend Server  
- **Command**: `uvicorn main:app --reload` (from `job-search-app/backend/`)
- **Port**: 8000
- **API docs**: http://localhost:8000/docs (FastAPI auto-generated)

## Port Selection Pattern
When starting frontend, Vite will try ports in sequence:
1. 5173 (default)
2. 5174 (if 5173 in use)
3. 5175 (if 5174 in use)
4. etc.

**How to apply:** 
- Always check Vite output for actual port when starting frontend
- If user says "restart frontend", stop existing process and start fresh
- Tell user the actual port number after successful start
- Related: [[project_job-search-app]]
