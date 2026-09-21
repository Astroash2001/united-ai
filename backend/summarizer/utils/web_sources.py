"""
External web sources for document chat:
  - Jina Reader turns a web page into clean text (works without a key, at a lower rate limit).
  - Tavily web search adds live web results to an answer (needs TAVILY_API_KEY).
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_PAGE_CHARS = 2_000_000


def fetch_url_text(url: str) -> Tuple[str, str, Optional[str]]:
    """
    Read a web page as plain text via Jina Reader.

    Returns:
        Tuple of (text, page_title, error_message)
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return "", "", "Please enter a full web address starting with http:// or https://"

    headers = {"Accept": "application/json", "X-Return-Format": "text"}
    api_key = getattr(settings, "JINA_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request = urllib.request.Request(f"https://r.jina.ai/{url}", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as e:
        logger.error(f"Jina Reader failed: HTTP {e.code} {e.read()[:200]!r}")
        if e.code == 429:
            return "", "", "Web page reader is busy. Please try again in a minute."
        return "", "", "Could not read this web page. Check the address and try again."
    except Exception as e:
        logger.error(f"Jina Reader error: {e}")
        return "", "", "Could not reach the web page reader."

    data = payload.get("data") or {}
    text = (data.get("content") or data.get("text") or "").strip()
    if not text:
        return "", "", "This web page has no readable text."
    return text[:MAX_PAGE_CHARS], (data.get("title") or url)[:255], None


def web_search(query: str, max_results: int = 3) -> Tuple[List[Dict[str, str]], Optional[str]]:
    """
    Search the web with Tavily.

    Returns:
        Tuple of ([{"title", "url", "content"}, ...], error_message)
    """
    api_key = getattr(settings, "TAVILY_API_KEY", "")
    if not api_key:
        return [], "Web search is not configured. Please add TAVILY_API_KEY to environment."

    request = urllib.request.Request(
        "https://api.tavily.com/search",
        data=json.dumps({"query": query[:400], "max_results": max_results, "search_depth": "basic"}).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as e:
        logger.error(f"Tavily search failed: HTTP {e.code} {e.read()[:200]!r}")
        if e.code in (429, 432, 433):
            return [], "Web search usage limit reached. Try again later or turn off web search."
        return [], "Web search failed. Please try again."
    except Exception as e:
        logger.error(f"Tavily search error: {e}")
        return [], "Could not reach web search."

    results = [
        {"title": item.get("title", ""), "url": item.get("url", ""), "content": (item.get("content") or "")[:1500]}
        for item in payload.get("results", [])
    ]
    return results, None
