"""
CV Parser Module
Parses PDF/DOCX CVs and extracts structured information
"""

import re
import pdfplumber
from docx import Document
from pathlib import Path
from typing import Dict, List, Optional


class CVParser:
    """Parse CV from PDF or DOCX format"""
    
    # Common skill keywords
    TECH_SKILLS = {
        'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'php', 'ruby', 'go', 'rust',
        'html', 'css', 'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
        'spring', 'fastapi', 'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
        'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'jenkins', 'git', 'github',
        'machine learning', 'deep learning', 'nlp', 'computer vision', 'data science',
        'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras',
        'rest api', 'graphql', 'microservices', 'agile', 'scrum', 'jira', 'confluence',
        'mql5', 'nginx', 'devsecops', 'fintech', 'algorithmic trading',
        'project management', 'team leadership', 'vm deployment', 'cybersecurity'
    }
    
    def __init__(self, cv_path: str):
        """Initialize parser with CV file path"""
        self.cv_path = Path(cv_path)
        self.text = ""
        self.bold_lines = set()  # Track line numbers that contain bold text
        self.structured_data = {}
        
    def parse(self) -> Dict:
        """Main parsing method"""
        # Extract text based on file type
        if self.cv_path.suffix.lower() == '.pdf':
            self.text = self._extract_from_pdf()
        elif self.cv_path.suffix.lower() in ['.docx', '.doc']:
            self.text = self._extract_from_docx()
        else:
            raise ValueError(f"Unsupported file format: {self.cv_path.suffix}")
        
        # Parse sections
        self.structured_data = {
            'name': self._extract_name(),
            'email': self._extract_email(),
            'phone': self._extract_phone(),
            'location': self._extract_location(),
            'skills': self._extract_skills(),
            'experience': self._extract_experience(),
            'projects': self._extract_projects(),
            'education': self._extract_education(),
            'summary': self._extract_summary(),
            'raw_text': self.text
        }
        
        return self.structured_data
    
    def _extract_from_pdf(self) -> str:
        """Extract text from PDF, tracking bold formatting via font names.

        Groups words into visual lines using Y-coordinate tolerance clustering
        so that words on the same visual line with slightly different y-coordinates
        (e.g. 336.0 vs 336.5) stay together.
        """
        text = ""
        line_num = 0
        Y_TOLERANCE = 2.0  # ponytail: 2pt tolerance covers sub/superscript jitter; increase if wider baselines appear

        try:
            with pdfplumber.open(self.cv_path) as pdf:
                for page in pdf.pages:
                    words = page.extract_words(extra_attrs=["fontname", "size"]) or []
                    if not words:
                        continue

                    # Sort by y then x
                    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))

                    # Greedy cluster: merge words within Y_TOLERANCE of the cluster's top
                    lines: list[list[dict]] = []
                    for w in sorted_words:
                        if lines and abs(w["top"] - lines[-1][0]["top"]) <= Y_TOLERANCE:
                            lines[-1].append(w)
                        else:
                            lines.append([w])

                    for cluster in lines:
                        line_words = sorted(cluster, key=lambda w: w["x0"])
                        line_text = " ".join(w["text"] for w in line_words)
                        if not line_text.strip():
                            continue

                        has_bold = any("bold" in w["fontname"].lower() for w in line_words)
                        if has_bold:
                            self.bold_lines.add(line_num)

                        text += line_text + "\n"
                        line_num += 1
        except Exception as e:
            raise Exception(f"Failed to parse PDF: {str(e)}")
        return text
    
    def _extract_from_docx(self) -> str:
        """Extract text from DOCX and track bold formatting"""
        text = ""
        line_num = 0
        try:
            doc = Document(self.cv_path)
            for paragraph in doc.paragraphs:
                para_text = paragraph.text.strip()
                if para_text:  # Only process non-empty paragraphs
                    # Check if paragraph contains bold text (run-level or style-level)
                    has_bold_run = any(run.bold == True for run in paragraph.runs if run.text.strip())
                    
                    # Check paragraph style for bold formatting
                    has_bold_style = False
                    try:
                        if paragraph.style and paragraph.style.font:
                            has_bold_style = paragraph.style.font.bold == True
                    except:
                        pass
                    
                    # Mark as bold if either run or style is bold
                    if has_bold_run or has_bold_style:
                        self.bold_lines.add(line_num)
                    
                    text += para_text + "\n"
                    line_num += 1
        except Exception as e:
            raise Exception(f"Failed to parse DOCX: {str(e)}")
        return text
    
    def _extract_name(self) -> Optional[str]:
        """Extract candidate name (usually first line or prominent text)"""
        lines = [l.strip() for l in self.text.split('\n') if l.strip()]
        if not lines:
            return None
        
        # Name is often the first non-empty line or largest font text
        # For simplicity, take first line that looks like a name
        for line in lines[:5]:  # Check first 5 lines
            # Name is typically short (2-4 words) and capitalized
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
                return line
        
        return lines[0] if lines else None
    
    def _extract_email(self) -> Optional[str]:
        """Extract email address"""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        matches = re.findall(email_pattern, self.text)
        return matches[0] if matches else None
    
    def _extract_phone(self) -> Optional[str]:
        """Extract phone number"""
        # Indonesian phone patterns with flexible spacing
        phone_patterns = [
            r'\+62[\s\-]?\d{2,3}[\s\-]?\d{3,4}[\s\-]?\d{3,4}',  # +62 81 1234 5678 or +628112345678
            r'\(\+62\)[\s\-]?\d{2,3}[\s\-]?\d{3,4}[\s\-]?\d{3,4}',  # (+62) 81 1234 5678
            r'08\d{2}[\s\-]?\d{3,4}[\s\-]?\d{3,4}',  # 0812 3456 7890
            r'\d{3}[\s\-]?\d{3}[\s\-]?\d{4}'  # 123-456-7890
        ]
        
        for pattern in phone_patterns:
            matches = re.findall(pattern, self.text)
            if matches:
                return matches[0]
        return None
    
    def _extract_location(self) -> Optional[str]:
        """Extract location/address"""
        # Path 1: section-based extraction (most reliable)
        loc_section = self._extract_section(['location', 'address', 'alamat', 'domisili'])
        if loc_section:
            first_line = loc_section.split('\n')[0].strip()
            if first_line and len(first_line) < 100:
                return first_line

        # Path 2: keyword fallback — skip lines that look like education or language entries
        location_keywords = ['jakarta', 'bandung', 'surabaya', 'medan', 'semarang',
                            'yogyakarta', 'bali', 'indonesia']
        edu_words = ['university', 'universitas', 'institute', 'institut', 'college',
                    'sekolah', 'akademi', 'fakultas', 'kampus', 'campus', 'degree']
        lang_words = ['bahasa', 'penutur', 'native', 'fluent', 'language', 'speak']

        lines = self.text.split('\n')
        lines_lower = self.text.lower().split('\n')
        date_re = re.compile(r'\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|'
                            r'jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[\s\-–]+\d{4}\b', re.IGNORECASE)

        for i, line in enumerate(lines_lower):
            if any(w in line for w in edu_words):
                continue
            if any(w in line for w in lang_words):
                continue
            if date_re.search(line) or len(line.strip()) > 80:
                continue
            for keyword in location_keywords:
                if keyword in line:
                    return lines[i].strip()

        # Path 3: extract city name from any line (e.g. "Company - Bandung Juni 2025")
        city_re = re.compile(r'\b(' + '|'.join(location_keywords) + r')\b', re.IGNORECASE)
        for line in lines:
            m = city_re.search(line)
            if m:
                return m.group(0).title()
        return None
    
    def _extract_skills(self) -> List[str]:
        """Extract technical skills from comma-separated or line-by-line format"""
        seen = set()
        skills = []

        def _norm(s: str) -> str:
            """Normalize for dedup"""
            return re.sub(r'\s+', ' ', re.sub(r'[./]', ' ', s.lower())).strip()

        def _add(skill: str):
            """Add skill if not duplicate"""
            n = _norm(skill)
            if n in seen:
                return
            for existing_n in seen:
                if n in existing_n or existing_n in n:
                    if len(n) < len(existing_n):
                        return
                    else:
                        skills[:] = [s for s in skills if _norm(s) != existing_n]
                        seen.discard(existing_n)
                        break
            seen.add(n)
            skills.append(skill)

        # Get skills section
        skills_section = self._extract_section([
            'skills', 'technical skills', 'expertise', 'competencies',
            'keahlian', 'keahlian, minat', 'keahlian, minat & bahasa'
        ])

        if skills_section:
            # Remove interests/minat part
            skills_only = re.split(r'\b(?:interests?|minat)[\s:]*', skills_section.lower())[0]
            
            # Try comma-separated first
            if ',' in skills_only:
                first_line = re.split(r'\n', skills_only, maxsplit=1)[0]
                first_line = re.sub(r'^\s*(?:skills?|keahlian)[\s:]*', '', first_line)
                skills_text = re.sub(r'\s+', ' ', first_line).strip()
                
                for item in skills_text.split(','):
                    cleaned = item.strip().rstrip('.')
                    if cleaned and len(cleaned) < 50:
                        _add(cleaned.title())
            else:
                # Line-by-line format (ATS CVs)
                lines = skills_only.split('\n')
                for line in lines:
                    line = line.strip()
                    # Skip section header
                    if re.match(r'^\s*(?:skills?|keahlian)[\s:]*$', line.lower()):
                        continue
                    # Add non-empty lines as skills
                    if line and len(line) > 2 and len(line) < 50:
                        _add(line.title())

        return skills

    def _extract_experience(self) -> List[Dict]:
        """Extract work experience using dynamic section-bounded bold detection"""
        experience = []
        
        # Detect all sections dynamically
        sections = self._detect_all_sections()
        
        # Check if work_experience section exists
        if 'work_experience' not in sections:
            return []
        
        work_start, work_end = sections['work_experience']
        
        # Get work experience section text
        text_lines = self.text.split('\n')
        work_lines = text_lines[work_start:work_end]
        
        current_job = None
        current_line_num = work_start - 1  # increment before check, so first line maps to work_start

        for line in work_lines:
            line_stripped = line.strip()
            current_line_num += 1
            
            if not line_stripped:
                continue
            
            # Check if this line is bold (indicates job title)
            is_bold = current_line_num in self.bold_lines
            
            if is_bold and len(line_stripped.split()) >= 3:  # Bold + at least 3 words = job title
                # Save previous job
                if current_job:
                    experience.append(current_job)
                
                # Start new job
                current_job = {
                    'title': line_stripped,
                    'dates': 'N/A',
                    'description': ''
                }
            else:
                # Non-bold line = description or date
                if current_job:
                    if current_job['description']:
                        current_job['description'] += '\n'
                    current_job['description'] += line_stripped
        
        # Save last job
        if current_job:
            experience.append(current_job)
        
        return experience[:10]
    
    
    def _extract_projects(self) -> List[Dict]:
        """Extract projects using dynamic section-bounded bold detection"""
        projects = []
        
        # Detect all sections dynamically
        sections = self._detect_all_sections()
        
        # Check if projects section exists
        if 'projects' not in sections:
            return []
        
        proj_start, proj_end = sections['projects']
        
        # Get projects section text
        text_lines = self.text.split('\n')
        proj_lines = text_lines[proj_start:proj_end]
        
        current_project = None
        current_line_num = proj_start - 1  # increment before check, so first line maps to proj_start

        for line in proj_lines:
            line_stripped = line.strip()
            current_line_num += 1
            
            if not line_stripped:
                continue
            
            # Check if this line is bold (indicates project title)
            is_bold = current_line_num in self.bold_lines
            
            if is_bold and len(line_stripped.split()) >= 3:  # Bold + at least 3 words = project title
                # Save previous project
                if current_project:
                    projects.append(current_project)
                
                # Start new project
                current_project = {
                    'title': line_stripped,
                    'dates': 'N/A',
                    'description': ''
                }
            else:
                # Non-bold line = description
                if current_project:
                    if current_project['description']:
                        current_project['description'] += '\n'
                    current_project['description'] += line_stripped
        
        # Save last project
        if current_project:
            projects.append(current_project)
        
        return projects[:10]
    
    def _get_section_line_number(self, section_headers: List[str]) -> Optional[int]:
        """Find the starting line number of a section"""
        text_lines = self.text.split('\n')
        for i, line in enumerate(text_lines):
            line_lower = line.lower().strip()
            for header in section_headers:
                if header.lower() in line_lower:
                    return i
        return None
    
    def _detect_all_sections(self) -> Dict[str, tuple]:
        """
        Detect all sections in CV and return their boundaries (start_line, end_line).
        Returns: {section_name: (start_line, end_line)}
        """
        sections = {}
        text_lines = self.text.split('\n')
        
        # Define section keywords (order-independent)
        section_patterns = {
            'work_experience': ['experience', 'work experience', 'employment', 'professional experience', 
                               'work history', 'pengalaman kerja'],
            'projects': ['project experience', 'projects', 'personal projects', 
                        'pengalaman project', 'project'],
            'education': ['education', 'academic', 'qualification', 'pendidikan'],
            'skills': ['skills', 'technical skills', 'expertise', 'competencies', 
                      'keahlian'],
            'summary': ['summary', 'profile', 'about', 'objective', 'profil']
        }
        
        # Find all section headers
        detected = []
        for i, line in enumerate(text_lines):
            line_lower = line.lower().strip()
            
            # Try each section type
            best_match = None
            best_match_len = 0
            
            for section_name, keywords in section_patterns.items():
                # Sort keywords by length (longest first) to prioritize specific matches
                sorted_keywords = sorted(keywords, key=len, reverse=True)
                
                for keyword in sorted_keywords:
                    # Check if keyword matches (with word boundaries)
                    if keyword.lower() in line_lower and len(line_lower) < 50:
                        # Prioritize longer keyword matches
                        if len(keyword) > best_match_len:
                            best_match = section_name
                            best_match_len = len(keyword)
                        break
            
            if best_match:
                detected.append((best_match, i))
        
        # Build boundaries: each section ends where next section starts
        detected.sort(key=lambda x: x[1])  # Sort by line number
        for i, (section_name, start_line) in enumerate(detected):
            # End line is start of next section, or end of document
            end_line = detected[i + 1][1] if i + 1 < len(detected) else len(text_lines)
            sections[section_name] = (start_line, end_line)
        
        return sections
    
    def _extract_education(self) -> List[Dict]:
        """Extract education using section boundaries and line-by-line analysis"""
        education = []
        seen = set()
        
        sections = self._detect_all_sections()
        if 'education' not in sections:
            return []
        
        edu_start, edu_end = sections['education']
        text_lines = self.text.split('\n')
        edu_lines = text_lines[edu_start:edu_end]
        
        for line in edu_lines:
            line = line.strip()
            if not line:
                continue
            # Skip the section header itself
            if re.match(r'^(?:education|academic|qualification|pendidikan)$', line, re.IGNORECASE):
                continue
            # Skip capstone/project lines that ended up in education section
            if re.match(r'capstone|project|thesis|skripsi|tugas akhir', line, re.IGNORECASE):
                continue
            
            # Look for year in this line
            year_match = re.search(r'(?:20\d{2}|19\d{2})', line)
            year = year_match.group(0) if year_match else 'N/A'
            
            # Normalize for dedup
            norm = line.lower().strip()
            if norm in seen:
                continue
            seen.add(norm)
            
            education.append({
                'degree': line.strip(),
                'year': year
            })
        
        return education[:5]
    
    def _extract_summary(self) -> Optional[str]:
        """Extract professional summary/objective"""
        summary_section = self._extract_section(['summary', 'profile', 'about', 'objective',
                                                 'professional summary', 'career objective',
                                                 'profil', 'ringkasan', 'tentang'])
        
        if summary_section:
            # Return first paragraph (usually the summary)
            paragraphs = [p.strip() for p in summary_section.split('\n\n') if p.strip()]
            return paragraphs[0] if paragraphs else summary_section[:500]
        
        return None
    
    def _extract_section(self, section_headers: List[str]) -> Optional[str]:
        """Extract text from a specific section"""
        text_lower = self.text.lower()
        
        # Find section start
        section_start = -1
        matched_header = None
        
        for header in section_headers:
            pattern = r'\n\s*' + re.escape(header.lower()) + r'\s*[\n:]'
            match = re.search(pattern, text_lower)
            if match:
                section_start = match.end()
                matched_header = header
                break
        
        if section_start == -1:
            return None
        
        # Find section end (next major header or end of document)
        common_headers = ['experience', 'education', 'skills', 'projects', 'certifications',
                         'awards', 'publications', 'references', 'languages',
                         'pengalaman', 'pendidikan', 'keahlian', 'proyek', 'sertifikasi',
                         'penghargaan', 'bahasa', 'keahlian, minat']
        
        text_after_start = text_lower[section_start:]
        section_end = len(text_lower)
        
        for header in common_headers:
            if header == matched_header.lower():
                continue  # Skip the current section header
            
            pattern = r'\n\s*' + re.escape(header) + r'\s*[\n:]'
            match = re.search(pattern, text_after_start)
            if match:
                potential_end = section_start + match.start()
                if potential_end < section_end:
                    section_end = potential_end
        
        return self.text[section_start:section_end].strip()


def parse_cv(cv_path: str) -> Dict:
    """Convenience function to parse a CV"""
    parser = CVParser(cv_path)
    return parser.parse()
