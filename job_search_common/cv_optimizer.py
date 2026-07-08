"""
CV Optimizer Module
Analyzes job requirements and suggests CV improvements
"""

import re
from typing import Dict, List, Tuple, Set
from difflib import SequenceMatcher


class CVOptimizer:
    """Optimize CV for specific job postings"""
    
    def __init__(self, cv_data: Dict):
        """Initialize with parsed CV data"""
        self.cv_data = cv_data
        self.cv_skills = set(s.lower() for s in cv_data.get('skills', []))
        # ponytail: build cv_text from parsed fields since raw_text may not exist
        parts = [
            cv_data.get('name', ''),
            cv_data.get('location', ''),
            ' '.join(cv_data.get('skills', [])),
            ' '.join(exp.get('description', '') for exp in cv_data.get('experience', [])),
            ' '.join(proj.get('description', '') for proj in cv_data.get('projects', [])),
        ]
        self.cv_text = ' '.join(parts).lower()
        
    def analyze_job_fit(self, job: Dict) -> Dict:
        """
        Analyze how well CV fits a specific job
        
        Returns detailed analysis with strengths, gaps, and recommendations
        """
        job_text = self._get_job_text(job).lower()
        
        # Extract job requirements
        required_skills = self._extract_job_skills(job_text)
        required_keywords = self._extract_job_keywords(job_text)
        
        # Identify matches and gaps
        matched_skills = self.cv_skills & required_skills
        missing_skills = required_skills - self.cv_skills
        
        # Calculate overall fit
        if required_skills:
            skills_match_pct = (len(matched_skills) / len(required_skills)) * 100
        else:
            skills_match_pct = 50.0
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            matched_skills, missing_skills, required_keywords
        )
        
        return {
            'job_title': job.get('title', 'N/A'),
            'company': job.get('company', 'N/A'),
            'overall_fit': self._categorize_fit(skills_match_pct),
            'skills_match_percentage': round(skills_match_pct, 1),
            'matched_skills': list(matched_skills),
            'missing_skills': list(missing_skills),
            'recommendations': recommendations,
            'job_url': job.get('url', '')
        }
    
    def optimize_cv_for_job(self, job: Dict) -> Dict:
        """
        Generate optimized CV suggestions for specific job
        
        Returns optimized content suggestions
        """
        analysis = self.analyze_job_fit(job)
        job_text = self._get_job_text(job).lower()
        
        # Generate optimized sections
        optimized = {
            'summary': self._optimize_summary(job, analysis),
            'skills': self._optimize_skills(analysis),
            'experience': self._optimize_experience(job_text),
            'keywords_to_add': self._suggest_keywords(job_text),
            'formatting_tips': self._formatting_tips(analysis)
        }
        
        return {
            'job_title': job.get('title', 'N/A'),
            'analysis': analysis,
            'optimizations': optimized
        }
    
    def _get_job_text(self, job: Dict) -> str:
        """Get all text from job for analysis"""
        parts = [
            job.get('title', ''),
            job.get('company', ''),
            job.get('summary', ''),
            job.get('description', '')
        ]
        return ' '.join(str(p) for p in parts if p)
    
    def _extract_job_skills(self, job_text: str) -> Set[str]:
        """Extract required skills from job posting"""
        # Common tech skills to look for
        skill_patterns = [
            'python', 'java', 'javascript', 'typescript', 'c\\+\\+', 'c#', 'php', 'ruby', 'go',
            'react', 'vue', 'angular', 'node\\.?js', 'express', 'django', 'flask', 'spring',
            'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'nosql',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'jenkins',
            'git', 'github', 'gitlab', 'ci/cd',
            'machine learning', 'deep learning', 'nlp', 'data science', 'ai',
            'rest api', 'graphql', 'microservices', 'agile', 'scrum'
        ]
        
        found_skills = set()
        for pattern in skill_patterns:
            if re.search(r'\b' + pattern + r'\b', job_text, re.IGNORECASE):
                # Normalize skill name
                skill_name = pattern.replace('\\', '').replace('.?', '.').replace('\\+\\+', '++')
                found_skills.add(skill_name.lower())
        
        return found_skills
    
    def _extract_job_keywords(self, job_text: str) -> List[str]:
        """Extract important keywords from job description"""
        # Remove common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 
                     'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'will'}
        
        words = re.findall(r'\b[a-z]{4,}\b', job_text.lower())
        keywords = [w for w in words if w not in stop_words]
        
        # Count frequency
        keyword_freq = {}
        for kw in keywords:
            keyword_freq[kw] = keyword_freq.get(kw, 0) + 1
        
        # Return top keywords
        sorted_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)
        return [kw for kw, freq in sorted_keywords[:20]]
    

    def _detect_cv_language(self) -> str:
        """Detect CV language by checking for common Indonesian words"""
        id_words = {'dan', 'di', 'untuk', 'dengan', 'pada', 'dari', 'adalah', 'yang',
                    'ini', 'itu', 'dalam', 'tidak', 'bisa', 'telah', 'sudah', 'akan',
                    'serta', 'juga', 'lebih', 'agar', 'oleh', 'karena', 'sebagai',
                    'manajemen', 'kepemimpinan', 'pengalaman', 'pendidikan', 'proyek'}
        cv_lower = self.cv_text.lower()
        matches = sum(1 for w in id_words if w in cv_lower)
        return 'id' if matches >= 3 else 'en'

    def _categorize_fit(self, percentage: float) -> str:
        """Categorize fit level"""
        lang = self._detect_cv_language()
        if percentage >= 80:
            return "Sangat Cocok" if lang == "id" else "Excellent Match"
        elif percentage >= 60:
            return "Cocok" if lang == "id" else "Good Match"
        elif percentage >= 40:
            return "Cukup Cocok" if lang == "id" else "Fair Match"
        else:
            return "Kurang Cocok" if lang == "id" else "Low Match"
    
    def _generate_recommendations(self, matched: Set, missing: Set, keywords: List) -> List[str]:
        """Generate actionable recommendations"""
        lang = self._detect_cv_language()
        recommendations = []
        
        if len(matched) > 0:
            if lang == "id":
                recommendations.append(f"✅ Tonjolkan {len(matched)} skill yang cocok ini di CV Anda")
            else:
                recommendations.append(f"✅ Highlight these {len(matched)} matching skills prominently in your CV")
        
        if len(missing) > 0:
            if len(missing) <= 3:
                if lang == "id":
                    recommendations.append(f"📚 Pertimbangkan untuk mempelajari skill ini: {', '.join(list(missing)[:3])}")
                else:
                    recommendations.append(f"📚 Consider learning these skills: {', '.join(list(missing)[:3])}")
            else:
                if lang == "id":
                    recommendations.append(f"📚 {len(missing)} skill belum dimiliki - prioritaskan belajar yang paling relevan")
                else:
                    recommendations.append(f"📚 {len(missing)} skills missing - prioritize learning the most relevant ones")
        
        cv_words = set(self.cv_text.split())
        missing_keywords = [kw for kw in keywords[:10] if kw not in cv_words]
        
        if missing_keywords:
            if lang == "id":
                recommendations.append(f"🔑 Tambahkan keyword ini: {', '.join(missing_keywords[:5])}")
            else:
                recommendations.append(f"🔑 Add these keywords: {', '.join(missing_keywords[:5])}")
        
        if lang == "id":
            recommendations.append("✏️ Sesuaikan summary untuk menyebutkan perusahaan dan posisi")
            recommendations.append("📊 Kuantifikasi pencapaian dengan angka dan metrik")
        else:
            recommendations.append("✏️ Tailor your summary to mention the company and position")
            recommendations.append("📊 Quantify achievements with numbers and metrics")
        
        return recommendations
    
    def _optimize_summary(self, job: Dict, analysis: Dict) -> str:
        """Generate optimized professional summary using actual CV data"""
        job_title = job.get('title', 'posisi ini')
        company = job.get('company', 'perusahaan ini')
        all_skills = list(self.cv_data.get('skills', []))
        experience = self.cv_data.get('experience', [])
        exp_count = len(experience)
        lang = self._detect_cv_language()
        skill_text = ', '.join(all_skills[:5]) if all_skills else 'teknologi relevan'
        if lang == "id":
            exp_line = f"Dengan pengalaman {exp_count} tahun di bidang terkait" if exp_count > 0 else "Lulusan baru dengan semangat tinggi"
            return f"Profesional di bidang teknologi dengan keahlian dalam {skill_text}. {exp_line}, siap berkontribusi di posisi {job_title} di {company}. Terbukti mampu mengembangkan solusi digital yang efektif dan berorientasi pada hasil."
        else:
            exp_line = f"With {exp_count} years of experience in relevant fields" if exp_count > 0 else "Recent graduate with strong motivation"
            return f"Technology professional with expertise in {skill_text}. {exp_line}, ready to contribute as {job_title} at {company}. Proven ability to develop effective digital solutions focused on results."
    
    def _optimize_skills(self, analysis: Dict) -> List[str]:
        """Provide actual skill reordering based on job match"""
        all_skills = self.cv_data.get('skills', [])
        matched = analysis.get('matched_skills', [])
        missing = analysis.get('missing_skills', [])
        lang = self._detect_cv_language()
        matched_list = [s for s in all_skills if s.lower() in [m.lower() for m in matched]]
        other_list = [s for s in all_skills if s.lower() not in [m.lower() for m in matched]]
        reordered = matched_list + other_list
        suggestions = []
        if lang == "id":
            suggestions.append(f"Urutan skills yang disarankan: {', '.join(reordered)}")
            if missing:
                suggestions.append(f"Skill yang perlu dipelajari: {', '.join(missing[:3])}")
        else:
            suggestions.append(f"Suggested skill order: {', '.join(reordered)}")
            if missing:
                suggestions.append(f"Skills to learn: {', '.join(missing[:3])}")
        return suggestions
    
    def _optimize_experience(self, job_text: str) -> List[str]:
        """Rewrite experience descriptions to be more impactful"""
        experience = self.cv_data.get('experience', [])
        lang = self._detect_cv_language()
        job_skills = self._extract_job_skills(job_text)
        matched = self.cv_skills & job_skills
        rewritten = []
        for exp in experience:
            title = exp.get('title', '')
            company = exp.get('company', '')
            desc = exp.get('description', '')
            if not desc:
                continue
            enhanced = desc
            for skill in list(matched)[:3]:
                if skill.lower() not in desc.lower():
                    enhanced += f" menggunakan {skill}" if lang == "id" else f" using {skill}"
            if lang == "id":
                action_verbs = ['Mengembangkan', 'Menerapkan', 'Merancang', 'Membangun', 'Mengelola', 'Mengoptimasi']
            else:
                action_verbs = ['Developed', 'Implemented', 'Designed', 'Built', 'Managed', 'Optimized']
            if not any(desc.startswith(v) for v in action_verbs):
                prefix = "Mengembangkan " if lang == "id" else "Developed "
                enhanced = prefix + enhanced[0].lower() + enhanced[1:] if enhanced else desc
            rewritten.append(f"[{title} @ {company}] {enhanced}")
        return rewritten if rewritten else ["Tidak ada experience untuk dioptimasi" if lang == "id" else "No experience to optimize"]
    
    def _suggest_keywords(self, job_text: str) -> List[str]:
        """Suggest keywords to naturally incorporate"""
        job_keywords = self._extract_job_keywords(job_text)
        cv_words = set(self.cv_text.split())
        
        # Find keywords in job but not in CV
        missing = [kw for kw in job_keywords[:15] if kw not in cv_words]
        
        return missing[:8]  # Top 8 keywords to add
    
    def _formatting_tips(self, analysis: Dict) -> List[str]:
        """Provide actionable formatting tips based on CV analysis"""
        lang = self._detect_cv_language()
        tips = []
        if not self.cv_data.get('education'):
            tips.append("Tambahkan bagian pendidikan" if lang == "id" else "Add education section")
        if not self.cv_data.get('projects'):
            tips.append("Tambahkan bagian proyek untuk menunjukkan portofolio" if lang == "id" else "Add projects section to showcase portfolio")
        if not self.cv_data.get('experience'):
            tips.append("Tambahkan pengalaman kerja atau magang" if lang == "id" else "Add work experience or internship")
        for exp in self.cv_data.get('experience', []):
            desc = exp.get('description', '')
            if desc and len(desc.split()) < 10:
                tips.append(f"Perpanjang deskripsi '{exp.get('title', '')}' dengan detail pencapaian" if lang == "id" else f"Expand '{exp.get('title', '')}' description with achievement details")
        if not tips:
            tips.append("CV sudah cukup lengkap" if lang == "id" else "CV is fairly complete")
        return tips


def analyze_job_fit(cv_data: Dict, job: Dict) -> Dict:
    """Convenience function to analyze job fit"""
    optimizer = CVOptimizer(cv_data)
    return optimizer.analyze_job_fit(job)


def optimize_cv_for_job(cv_data: Dict, job: Dict) -> Dict:
    """Convenience function to optimize CV for job"""
    optimizer = CVOptimizer(cv_data)
    return optimizer.optimize_cv_for_job(job)
