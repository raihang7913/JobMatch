#!/usr/bin/env python3
"""
HTML CV Optimizer Module
Handles HTML CV parsing and optimization while preserving exact template layout
"""
from bs4 import BeautifulSoup
import re
from typing import Dict, List, Optional


class HTMLCVOptimizer:
    """Optimize HTML CV content while preserving template styling"""
    
    def __init__(self, html_path: str):
        """Load HTML CV file"""
        self.html_path = html_path
        with open(html_path, 'r', encoding='utf-8') as f:
            self.soup = BeautifulSoup(f.read(), 'html.parser')
        
        self.text_elements = self._extract_text_elements()
    
    def _extract_text_elements(self) -> List[Dict]:
        """Extract all text spans with their positions"""
        results = []
        divs = self.soup.find_all('div', class_='pdf24_01')
        
        for i, div in enumerate(divs):
            span = div.find('span')
            if span:
                text = span.get_text()
                classes = ' '.join(span.get('class', []))
                style = div.get('style', '')
                
                results.append({
                    'index': i,
                    'text': text,
                    'classes': classes,
                    'style': style,
                    'span': span,
                    'div': div
                })
        
        return results
    
    def get_summary(self) -> Dict:
        """Get summary of CV structure"""
        return {
            'total_elements': len(self.text_elements),
            'elements': [
                {
                    'index': elem['index'],
                    'text_preview': elem['text'][:60] + '...' if len(elem['text']) > 60 else elem['text'],
                    'is_bold': 'pdf24_07' in elem['classes'] or 'pdf24_13' in elem['classes'] or 'pdf24_22' in elem['classes']
                }
                for elem in self.text_elements[:20]  # Show first 20
            ]
        }
    
    def add_job_title(self, company_name: str, job_title: str) -> bool:
        """
        Add job title below company name in work experience
        
        Args:
            company_name: Name of company to find
            job_title: Job title to add below company
        
        Returns:
            True if successful, False if company not found
        """
        # Find company div
        company_div = None
        for elem in self.text_elements:
            if company_name in elem['text']:
                company_div = elem['div']
                break
        
        if not company_div:
            return False
        
        # Extract position from company div
        style = company_div.get('style', '')
        top_match = re.search(r'top:\s*([0-9.]+)em', style)
        if not top_match:
            return False
        
        company_top = float(top_match.group(1))
        job_title_top = company_top + 1.2  # 1.2em spacing below company
        job_title_left = 4.4675  # Indented like bullet points
        
        # Create new div for job title
        new_div = self.soup.new_tag('div', **{
            'class': 'pdf24_01',
            'style': f'left:{job_title_left}em;top:{job_title_top}em;'
        })
        
        # Create span with regular text style
        new_span = self.soup.new_tag('span', **{
            'class': 'pdf24_15 pdf24_11 pdf24_25'
        })
        new_span.string = f"{job_title} \xa0"
        
        new_div.append(new_span)
        company_div.insert_after(new_div)
        
        return True
    
    def modify_text(self, search_text: str, new_text: str) -> bool:
        """
        Find and replace text content
        
        Args:
            search_text: Text to find (can be partial match)
            new_text: New text to replace with
        
        Returns:
            True if found and replaced, False otherwise
        """
        for elem in self.text_elements:
            if search_text in elem['text']:
                elem['span'].string = new_text
                return True
        return False
    
    def add_skill(self, skill: str, section_keyword: str = "Keahlian") -> bool:
        """
        Add skill to skills section
        
        Args:
            skill: Skill name to add
            section_keyword: Keyword to find skills section (default: "Keahlian")
        
        Returns:
            True if successful
        """
        # Find skills section
        skills_elem = None
        for elem in self.text_elements:
            if section_keyword in elem['text'] and ':' in elem['text']:
                skills_elem = elem
                break
        
        if not skills_elem:
            return False
        
        # Add skill to existing skills list
        current_text = skills_elem['text']
        # Append skill before the &nbsp; at the end
        new_text = current_text.rstrip(' \xa0') + f", {skill} \xa0"
        skills_elem['span'].string = new_text
        
        return True
    
    def enhance_description(self, keyword: str, enhancement: str) -> bool:
        """
        Enhance a description by adding text
        
        Args:
            keyword: Keyword to find the description
            enhancement: Text to add/enhance
        
        Returns:
            True if successful
        """
        for elem in self.text_elements:
            if keyword in elem['text']:
                current_text = elem['text'].rstrip(' \xa0')
                new_text = f"{current_text} {enhancement} \xa0"
                elem['span'].string = new_text
                return True
        return False
    
    def save(self, output_path: Optional[str] = None) -> str:
        """
        Save optimized HTML
        
        Args:
            output_path: Output file path (default: overwrite original)
        
        Returns:
            Path to saved file
        """
        if output_path is None:
            output_path = self.html_path
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(str(self.soup))
        
        return output_path


def optimize_html_cv(
    html_path: str,
    optimizations: Dict,
    output_path: Optional[str] = None
) -> Dict:
    """
    High-level function to optimize HTML CV
    
    Args:
        html_path: Path to HTML CV file
        optimizations: Dict of optimization instructions
            {
                'add_job_titles': [{'company': 'X', 'title': 'Y'}],
                'add_skills': ['skill1', 'skill2'],
                'modify_texts': [{'search': 'old', 'new': 'new'}],
                'enhance_descriptions': [{'keyword': 'X', 'enhancement': 'Y'}]
            }
        output_path: Optional output path
    
    Returns:
        Dict with status and output path
    """
    try:
        optimizer = HTMLCVOptimizer(html_path)
        
        # Apply job titles
        if 'add_job_titles' in optimizations:
            for job_info in optimizations['add_job_titles']:
                success = optimizer.add_job_title(
                    job_info['company'],
                    job_info['title']
                )
                if not success:
                    print(f"Warning: Could not add job title for {job_info['company']}")
        
        # Add skills
        if 'add_skills' in optimizations:
            for skill in optimizations['add_skills']:
                optimizer.add_skill(skill)
        
        # Modify texts
        if 'modify_texts' in optimizations:
            for mod in optimizations['modify_texts']:
                optimizer.modify_text(mod['search'], mod['new'])
        
        # Enhance descriptions
        if 'enhance_descriptions' in optimizations:
            for enh in optimizations['enhance_descriptions']:
                optimizer.enhance_description(enh['keyword'], enh['enhancement'])
        
        # Save
        output = optimizer.save(output_path)
        
        return {
            'success': True,
            'output_path': output,
            'message': 'HTML CV optimized successfully'
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to optimize HTML CV: {e}'
        }


if __name__ == '__main__':
    # Test
    import sys
    if len(sys.argv) > 1:
        html_path = sys.argv[1]
        optimizer = HTMLCVOptimizer(html_path)
        print(optimizer.get_summary())
