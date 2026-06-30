#!/usr/bin/env python3
"""
PDF Converter Module
Handles PDF ↔ HTML conversions for CV optimization pipeline
"""
import os
import subprocess
from pathlib import Path
import tempfile
from typing import Optional

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except Exception as e:
    WEASYPRINT_AVAILABLE = False
    print(f"Warning: weasyprint not available ({type(e).__name__}). HTML to PDF conversion will not work.")

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False


def pdf_to_html(pdf_path: str, output_html_path: Optional[str] = None) -> str:
    """
    Convert PDF to HTML while preserving layout
    
    Args:
        pdf_path: Path to input PDF file
        output_html_path: Optional output path for HTML (auto-generated if None)
    
    Returns:
        Path to generated HTML file
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")
    
    # Generate output path if not provided
    if output_html_path is None:
        pdf_name = Path(pdf_path).stem
        output_html_path = str(Path(pdf_path).parent / f"{pdf_name}_converted.html")
    
    # Strategy 1: Try pdf2htmlEX if available
    if _pdf2htmlex_available():
        try:
            return _pdf_to_html_pdf2htmlex(pdf_path, output_html_path)
        except Exception as e:
            print(f"pdf2htmlEX failed: {e}, trying fallback...")
    
    # Strategy 2: Fallback to pdfplumber-based conversion
    if PDFPLUMBER_AVAILABLE:
        return _pdf_to_html_pdfplumber(pdf_path, output_html_path)
    
    raise RuntimeError("No PDF to HTML converter available. Install pdf2htmlEX or pdfplumber.")


def html_to_pdf(html_path: str, output_pdf_path: Optional[str] = None) -> str:
    """
    Convert HTML to PDF
    
    Args:
        html_path: Path to input HTML file
        output_pdf_path: Optional output path for PDF (auto-generated if None)
    
    Returns:
        Path to generated PDF file
    """
    if not os.path.exists(html_path):
        raise FileNotFoundError(f"HTML file not found: {html_path}")
    
    # Generate output path if not provided
    if output_pdf_path is None:
        html_name = Path(html_path).stem
        output_pdf_path = str(Path(html_path).parent / f"{html_name}_output.pdf")
    
    # Strategy 1: WeasyPrint (best CSS support)
    if WEASYPRINT_AVAILABLE:
        return _html_to_pdf_weasyprint(html_path, output_pdf_path)
    
    # Strategy 2: wkhtmltopdf if available
    if _wkhtmltopdf_available():
        return _html_to_pdf_wkhtmltopdf(html_path, output_pdf_path)
    
    raise RuntimeError("No HTML to PDF converter available. Install weasyprint or wkhtmltopdf.")


# === Internal conversion functions ===

def _pdf2htmlex_available() -> bool:
    """Check if pdf2htmlEX is installed"""
    try:
        subprocess.run(['pdf2htmlEX', '--version'], 
                      capture_output=True, 
                      check=False, 
                      timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _wkhtmltopdf_available() -> bool:
    """Check if wkhtmltopdf is installed"""
    try:
        subprocess.run(['wkhtmltopdf', '--version'], 
                      capture_output=True, 
                      check=False,
                      timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _pdf_to_html_pdf2htmlex(pdf_path: str, output_path: str) -> str:
    """Convert using pdf2htmlEX (best layout preservation)"""
    output_dir = str(Path(output_path).parent)
    output_name = Path(output_path).stem
    
    cmd = [
        'pdf2htmlEX',
        '--zoom', '1.3',
        '--dest-dir', output_dir,
        '--output-filename', f"{output_name}.html",
        pdf_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    if result.returncode != 0:
        raise RuntimeError(f"pdf2htmlEX failed: {result.stderr}")
    
    return output_path


def _pdf_to_html_pdfplumber(pdf_path: str, output_path: str) -> str:
    """Convert using pdfplumber (fallback, simpler HTML)"""
    with pdfplumber.open(pdf_path) as pdf:
        html_parts = ['<!DOCTYPE html><html><head><meta charset="utf-8">']
        html_parts.append('<style>')
        html_parts.append('body { font-family: "Times New Roman", serif; margin: 2em; }')
        html_parts.append('.page { margin-bottom: 2em; }')
        html_parts.append('h1 { font-size: 24px; margin-bottom: 0.5em; }')
        html_parts.append('p { margin: 0.5em 0; line-height: 1.6; }')
        html_parts.append('</style></head><body>')
        
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text:
                html_parts.append(f'<div class="page" id="page-{page_num}">')
                
                # Simple text to HTML conversion
                paragraphs = text.split('\n\n')
                for para in paragraphs:
                    if para.strip():
                        # Check if it's a heading (uppercase, short)
                        if para.isupper() and len(para) < 50:
                            html_parts.append(f'<h1>{para}</h1>')
                        else:
                            html_parts.append(f'<p>{para.replace(chr(10), "<br>")}</p>')
                
                html_parts.append('</div>')
        
        html_parts.append('</body></html>')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(html_parts))
    
    return output_path


def _html_to_pdf_weasyprint(html_path: str, output_path: str) -> str:
    """Convert using WeasyPrint"""
    HTML(filename=html_path).write_pdf(output_path)
    return output_path


def _html_to_pdf_wkhtmltopdf(html_path: str, output_path: str) -> str:
    """Convert using wkhtmltopdf"""
    cmd = [
        'wkhtmltopdf',
        '--enable-local-file-access',
        '--encoding', 'UTF-8',
        html_path,
        output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    if result.returncode != 0:
        raise RuntimeError(f"wkhtmltopdf failed: {result.stderr}")
    
    return output_path


def test_converters():
    """Test which converters are available"""
    print("PDF Converter Availability:")
    print(f"  pdf2htmlEX: {'✅' if _pdf2htmlex_available() else '❌'}")
    print(f"  pdfplumber: {'✅' if PDFPLUMBER_AVAILABLE else '❌'}")
    print(f"  weasyprint: {'✅' if WEASYPRINT_AVAILABLE else '❌'}")
    print(f"  wkhtmltopdf: {'✅' if _wkhtmltopdf_available() else '❌'}")


if __name__ == '__main__':
    test_converters()
