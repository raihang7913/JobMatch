"""
Job Matcher Module
Matches job listings with CV and ranks them by fit score
"""

import re
from typing import Dict, List, Tuple, Optional
from difflib import SequenceMatcher
import numpy as np

# Lazy import for embedding model to avoid startup delay
_embedding_model = None

def get_embedding_model():
    """Lazy load embedding model"""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model


class JobMatcher:
    """Match and rank jobs based on CV fit"""
    
    def __init__(self, cv_data: Dict):
        """Initialize with parsed CV data"""
        self.cv_data = cv_data
        self.cv_skills = set(s.lower() for s in cv_data.get('skills', []))
        self.cv_text = cv_data.get('raw_text', '').lower()
        
    def match_jobs(self, jobs: List[Dict], match_mode: str = 'skills') -> List[Dict]:
        """
        Match and rank jobs by fit score
        
        Args:
            jobs: List of job dicts with keys: title, company, location, url, description (optional)
            match_mode: 'skills' (keyword-based), 'semantic' (embedding-based), or 'hybrid' (both)
            
        Returns:
            List of jobs with added 'match_score' and 'match_details' keys, sorted by score
        """
        scored_jobs = []
        
        for job in jobs:
            if 'error' in job:
                # Skip error entries
                scored_jobs.append(job)
                continue
            
            # Choose matching algorithm based on mode
            if match_mode == 'semantic':
                score, details = self._calculate_semantic_match(job)
            elif match_mode == 'hybrid':
                # Hybrid: combine skills (60%) and semantic (40%)
                skills_score, skills_details = self._calculate_match_score(job)
                semantic_score, semantic_details = self._calculate_semantic_match(job)
                
                score = (skills_score * 0.6) + (semantic_score * 0.4)
                details = {
                    'hybrid_score': f"{score:.0f}%",
                    'skills_component': f"{skills_score:.0f}% (60%)",
                    'semantic_component': f"{semantic_score:.0f}% (40%)",
                    'matched_skills': skills_details.get('matched_skills', [])
                }
            else:  # 'skills' mode (default)
                score, details = self._calculate_match_score(job)
            
            job_with_score = job.copy()
            job_with_score['match_score'] = score
            job_with_score['match_details'] = details
            scored_jobs.append(job_with_score)
        
        # Sort by score (highest first)
        scored_jobs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
        
        return scored_jobs
    
    def _calculate_match_score(self, job: Dict) -> Tuple[float, Dict]:
        """
        Calculate match score for a single job
        
        Returns:
            (score, details) where score is 0-100 and details explain the score
        """
        scores = {}
        weights = {
            'skills': 0.5,      # 50% - Most important
            'title': 0.3,       # 30% - Job title relevance
            'location': 0.1,    # 10% - Location preference
            'keywords': 0.1     # 10% - General keyword match
        }
        
        # 1. Skills match
        job_text = self._get_job_text(job).lower()
        skills_score = self._match_skills(job_text)
        scores['skills'] = skills_score
        
        # 2. Title match
        title_score = self._match_title(job.get('title', ''))
        scores['title'] = title_score
        
        # 3. Location match
        location_score = self._match_location(job.get('location', ''))
        scores['location'] = location_score
        
        # 4. General keyword match
        keywords_score = self._match_keywords(job_text)
        scores['keywords'] = keywords_score
        
        # Calculate weighted total
        total_score = sum(scores[key] * weights[key] for key in weights)
        
        # Create detailed breakdown
        details = {
            'skills_match': f"{scores['skills']:.0f}%",
            'title_match': f"{scores['title']:.0f}%",
            'location_match': f"{scores['location']:.0f}%",
            'keywords_match': f"{scores['keywords']:.0f}%",
            'matched_skills': self._get_matched_skills(job_text)
        }
        
        return round(total_score, 1), details
    
    def _get_job_text(self, job: Dict) -> str:
        """Get all text from job for analysis"""
        parts = [
            job.get('title', ''),
            job.get('company', ''),
            job.get('location', ''),
            job.get('summary', ''),
            job.get('description', '')
        ]
        return ' '.join(str(p) for p in parts if p)
    
    def _match_skills(self, job_text: str) -> float:
        """Calculate skills match percentage"""
        if not self.cv_skills:
            return 50.0  # Neutral score if no skills in CV
        
        matched_skills = 0
        for skill in self.cv_skills:
            # Check for skill or variations
            if skill in job_text or skill.replace(' ', '') in job_text:
                matched_skills += 1
        
        # Calculate percentage
        match_percentage = (matched_skills / len(self.cv_skills)) * 100
        
        # Bonus for having more matched skills
        if matched_skills >= 3:
            match_percentage = min(100, match_percentage + 10)
        
        return match_percentage
    
    def _get_matched_skills(self, job_text: str) -> List[str]:
        """Get list of matched skills"""
        matched = []
        for skill in self.cv_skills:
            if skill in job_text or skill.replace(' ', '') in job_text:
                matched.append(skill.title())
        return matched
    
    def _match_title(self, job_title: str) -> float:
        """Calculate job title relevance"""
        job_title_lower = job_title.lower()
        
        # Extract experience level from CV
        cv_text_lower = self.cv_text
        
        # Check for seniority match
        seniority_keywords = {
            'junior': ['junior', 'fresh', 'entry', 'graduate'],
            'mid': ['mid', 'intermediate', '2-3 years', '3-5 years'],
            'senior': ['senior', 'lead', 'principal', 'staff', '5+ years'],
            'manager': ['manager', 'head', 'director', 'vp']
        }
        
        # Detect CV seniority (simple heuristic)
        cv_seniority = 'junior'  # Default
        if 'senior' in cv_text_lower or 'lead' in cv_text_lower:
            cv_seniority = 'senior'
        elif any(year in cv_text_lower for year in ['3 years', '4 years', '5 years']):
            cv_seniority = 'mid'
        
        # Check if job title seniority matches
        job_seniority = 'mid'  # Default
        for level, keywords in seniority_keywords.items():
            if any(kw in job_title_lower for kw in keywords):
                job_seniority = level
                break
        
        # Score based on seniority match
        seniority_levels = ['junior', 'mid', 'senior', 'manager']
        
        # Calculate base score
        if cv_seniority == job_seniority:
            base_score = 80
        else:
            # Calculate distance between levels
            try:
                cv_idx = seniority_levels.index(cv_seniority)
                job_idx = seniority_levels.index(job_seniority)
                level_distance = abs(cv_idx - job_idx)
                
                if level_distance == 1:
                    base_score = 60  # One level off
                elif level_distance == 2:
                    base_score = 40  # Two levels off
                else:
                    base_score = 30  # Three+ levels off
            except ValueError:
                # If seniority not in list, use neutral score
                base_score = 50
        
        # Bonus for keyword match in title
        cv_keywords = set(self.cv_text.lower().split())
        title_keywords = set(job_title_lower.split())
        common_keywords = cv_keywords & title_keywords
        
        if len(common_keywords) > 0:
            base_score += min(20, len(common_keywords) * 5)
        
        return min(100, base_score)
    
    def _match_location(self, job_location: str) -> float:
        """Calculate location match"""
        cv_location = self.cv_data.get('location', '').lower()
        job_location_lower = job_location.lower()
        
        if not cv_location or not job_location:
            return 50.0  # Neutral if no location data
        
        # Check for city/region match
        common_locations = ['jakarta', 'bandung', 'surabaya', 'yogyakarta', 'bali', 'remote']
        
        cv_city = None
        job_city = None
        
        for city in common_locations:
            if city in cv_location:
                cv_city = city
            if city in job_location_lower:
                job_city = city
        
        if cv_city and job_city:
            if cv_city == job_city:
                return 100.0
            elif 'remote' in [cv_city, job_city]:
                return 80.0  # Remote is flexible
            else:
                return 30.0  # Different cities
        
        return 50.0  # Unknown, neutral score
    
    def _match_keywords(self, job_text: str) -> float:
        """Calculate general keyword match"""
        # Extract important words from CV (nouns, tech terms)
        cv_words = set(self.cv_text.lower().split())
        
        # Common stop words to ignore
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 
                     'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is'}
        
        cv_keywords = {w for w in cv_words if len(w) > 3 and w not in stop_words}
        
        # Count matches in job text
        job_words = set(job_text.lower().split())
        matches = cv_keywords & job_words
        
        if not cv_keywords:
            return 50.0
        
        match_percentage = (len(matches) / min(len(cv_keywords), 50)) * 100
        return min(100, match_percentage)
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(dot_product / (norm1 * norm2))
    
    def _calculate_semantic_match(self, job: Dict) -> Tuple[float, Dict]:
        """
        Calculate semantic match using embeddings
        
        Returns:
            (score, details) where score is 0-100 and details explain the score
        """
        try:
            model = get_embedding_model()
            
            # Prepare CV text (combine skills + experience summary)
            cv_text = f"{' '.join(self.cv_skills)} {self.cv_text[:500]}"
            
            # Prepare job text
            job_text = self._get_job_text(job)
            
            # Generate embeddings
            cv_embedding = model.encode(cv_text, convert_to_numpy=True)
            job_embedding = model.encode(job_text, convert_to_numpy=True)
            
            # Calculate similarity
            similarity = self._cosine_similarity(cv_embedding, job_embedding)
            
            # Convert to 0-100 score (cosine similarity is -1 to 1, but typically 0 to 1)
            base_score = max(0, similarity) * 100
            
            # Bonus for skill overlap (semantic + keyword hybrid signal)
            job_text_lower = job_text.lower()
            matched_skills = [s for s in self.cv_skills if s in job_text_lower]
            skill_bonus = min(15, len(matched_skills) * 3)
            
            total_score = min(100, base_score + skill_bonus)
            
            details = {
                'semantic_similarity': f"{similarity:.2f}",
                'base_score': f"{base_score:.0f}%",
                'skill_bonus': f"+{skill_bonus}",
                'matched_skills': [s.title() for s in matched_skills[:10]]
            }
            
            return round(total_score, 1), details
            
        except Exception as e:
            # Fallback to skills matching if semantic fails
            print(f"Semantic matching failed: {e}, falling back to skills matching")
            return self._calculate_match_score(job)



def match_jobs_with_cv(cv_data: Dict, jobs: List[Dict], match_mode: str = 'skills') -> List[Dict]:
    """Convenience function to match jobs with CV"""
    matcher = JobMatcher(cv_data)
    return matcher.match_jobs(jobs, match_mode)
