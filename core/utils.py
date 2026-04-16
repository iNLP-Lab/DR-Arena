# core/utils.py

import logging
import re
import json
import sys

def setup_logging(log_filename):
    """Sets up logging to both file and console."""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    if logger.handlers:
        logger.handlers.clear()

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    # File Handler
    file_handler = logging.FileHandler(log_filename, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Stream Handler (Console)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)

def parse_citations(text):
    """
    Parses the citation count strictly from the '## References list' section.
    """
    if not text:
        return {"citation_count": 0, "unique_sources": []}
    
    url_pattern = r'(https?://[a-zA-Z0-9./\-_%?&=+#]+)'
    found_urls = re.findall(url_pattern, text)
    unique_sources = list(set(found_urls))

    header_match = re.search(r'##\s*(References|Reference|Sources)', text, re.IGNORECASE)
    
    count = 0
    if header_match:
        ref_section = text[header_match.end():].strip()
        matches = re.findall(r'^(\[\d+\]|\d+\.)', ref_section, re.MULTILINE)
        count = len(matches)
    
    return {
        "citation_count": count, 
        "unique_sources": unique_sources
    }