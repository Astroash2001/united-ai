"""
Lightweight retrieval helpers for long documents.

Splits text into overlapping chunks and ranks them against a question with
BM25, so document chat can answer from any part of a long document instead
of only its first few thousand characters. Pure Python, no external API.
"""
import math
import re
from collections import Counter
from typing import List

# Latin/digit word characters plus the full Devanagari block (includes Hindi vowel signs).
_TOKEN_RE = re.compile(r"[\wऀ-ॿ]+", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return [token.lower() for token in _TOKEN_RE.findall(text)]


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks, preferring paragraph or sentence boundaries."""
    text = text.strip()
    if len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            window = text[start:end]
            # Break at the last paragraph, sentence, or word boundary in the back half of the window.
            for separator in ("\n\n", "\n", "। ", ". ", " "):
                cut = window.rfind(separator)
                if cut > chunk_size // 2:
                    end = start + cut + len(separator)
                    break
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [chunk for chunk in chunks if chunk]


def rank_chunks(chunks: List[str], query: str, k1: float = 1.5, b: float = 0.75) -> List[int]:
    """Return chunk indices ordered by BM25 relevance to the query (best first)."""
    query_terms = set(tokenize(query))
    chunk_tokens = [tokenize(chunk) for chunk in chunks]
    if not chunks or not query_terms:
        return list(range(len(chunks)))

    doc_count = len(chunks)
    avg_len = sum(len(tokens) for tokens in chunk_tokens) / doc_count or 1
    doc_freq = Counter(term for tokens in chunk_tokens for term in set(tokens) & query_terms)

    scores = []
    for index, tokens in enumerate(chunk_tokens):
        term_freq = Counter(tokens)
        score = 0.0
        for term in query_terms:
            freq = term_freq.get(term, 0)
            if not freq:
                continue
            idf = math.log(1 + (doc_count - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            score += idf * freq * (k1 + 1) / (freq + k1 * (1 - b + b * len(tokens) / avg_len))
        scores.append((score, index))

    scores.sort(key=lambda item: (-item[0], item[1]))
    return [index for _, index in scores]


def select_relevant_context(text: str, query: str, max_chars: int = 8000) -> str:
    """
    Return the parts of text most relevant to the query, within max_chars.
    Short documents are returned whole. Selected chunks keep document order.
    """
    if len(text) <= max_chars:
        return text

    chunks = chunk_text(text)
    selected = []
    total = 0
    for index in rank_chunks(chunks, query):
        size = len(chunks[index]) + 7  # room for the "\n[...]\n" separator
        if total + size > max_chars:
            continue
        selected.append(index)
        total += size

    return "\n[...]\n".join(chunks[index] for index in sorted(selected))
