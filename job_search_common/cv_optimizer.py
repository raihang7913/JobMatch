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
        self.cv_text = cv_data.get('raw_text', '').lower()
        
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
    
    def _categorize_fit(self, percentage: float) -> str:
        """Categorize fit level"""
        if percentage >= 80:
            return "Excellent Match"
        elif percentage >= 60:
            return "Good Match"
        elif percentage >= 40:
            return "Fair Match"
        else:
            return "Low Match"
    
    def _generate_recommendations(self, matched: Set, missing: Set, keywords: List) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if len(matched) > 0:
            recommendations.append(
                f"✅ Highlight these {len(matched)} matching skills prominently in your CV"
            )
        
        if len(missing) > 0:
            if len(missing) <= 3:
                recommendations.append(
                    f"📚 Consider learning these skills: {', '.join(list(missing)[:3])}"
                )
            else:
                recommendations.append(
                    f"📚 {len(missing)} skills missing - prioritize learning the most relevant ones"
                )
        
        # Check for keyword optimization
        cv_words = set(self.cv_text.split())
        missing_keywords = [kw for kw in keywords[:10] if kw not in cv_words]
        
        if missing_keywords:
            recommendations.append(
                f"🔑 Add these keywords: {', '.join(missing_keywords[:5])}"
            )
        
        # General recommendations
        recommendations.append("✏️ Tailor your summary to mention the company and position")
        recommendations.append("📊 Quantify achievements with numbers and metrics")
        
        return recommendations
    
    def _optimize_summary(self, job: Dict, analysis: Dict) -> str:
        """Generate optimized professional summary"""
        job_title = job.get('title', 'this position')
        company = job.get('company', 'your company')
        matched_skills = analysis.get('matched_skills', [])
        
        # Create a template summary
        summary_template = f"""Motivated professional with expertise in {', '.join(matched_skills[:3])} 
seeking {job_title} role at {company}. Proven track record in delivering high-quality solutions 
with strong skills in {', '.join(matched_skills[3:6]) if len(matched_skills) > 3 else 'relevant technologies'}. 
Passionate about continuous learning and contributing to team success."""
        
        return summary_template.strip()
    
    def _optimize_skills(self, analysis: Dict) -> List[str]:
        """Suggest optimized skills section"""
        matched = analysis.get('matched_skills', [])
        missing = analysis.get('missing_skills', [])
        
        suggestions = []
        
        if matched:
            suggestions.append(f"Move these to the top: {', '.join(matched[:5])}")
        
        if missing:
            suggestions.append(f"Consider adding (if you have experience): {', '.join(missing[:3])}")
        
        suggestions.append("Group skills by category (Languages, Frameworks, Tools)")
        suggestions.append("Use bullet points for better readability")
        
        return suggestions
    
    def _optimize_experience(self, job_text: str) -> List[str]:
        """Suggest experience section improvements"""
        suggestions = [
            "Start each bullet with strong action verbs (Developed, Implemented, Designed)",
            "Include quantifiable results (e.g., 'Improved performance by 40%')",
            "Mention technologies used that match job requirements",
            "Focus on achievements, not just responsibilities"
        ]
        
        # Check if job mentions specific methodologies
        if 'agile' in job_text or 'scrum' in job_text:
            suggestions.append("Mention Agile/Scrum experience if applicable")
        
        if 'team' in job_text or 'collaboration' in job_text:
            suggestions.append("Highlight teamwork and collaboration examples")
        
        return suggestions
    
    def _suggest_keywords(self, job_text: str) -> List[str]:
        """Suggest keywords to naturally incorporate"""
        job_keywords = self._extract_job_keywords(job_text)
        cv_words = set(self.cv_text.split())
        
        # Find keywords in job but not in CV
        missing = [kw for kw in job_keywords[:15] if kw not in cv_words]
        
        return missing[:8]  # Top 8 keywords to add
    
    def _formatting_tips(self, analysis: Dict) -> List[str]:
        """Provide formatting and presentation tips"""
        tips = [
            "Use a clean, ATS-friendly format (avoid tables, graphics)",
            "Keep CV to 1-2 pages maximum",
            "Use consistent font (e.g., Arial, Calibri) 10-12pt",
            "Include clear section headers",
            "Use bullet points for easy scanning"
        ]
        
        fit_level = analysis.get('overall_fit', '')
        
        if 'Low' in fit_level:
            tips.append("Consider adding a cover letter explaining your motivation")
        
        return tips


def analyze_job_fit(cv_data: Dict, job: Dict) -> Dict:
    """Convenience function to analyze job fit"""
    optimizer = CVOptimizer(cv_data)
    return optimizer.analyze_job_fit(job)


def optimize_cv_for_job(cv_data: Dict, job: Dict) -> Dict:
    """Convenience function to optimize CV for job"""
    optimizer = CVOptimizer(cv_data)
    return optimizer.optimize_cv_for_job(job)
