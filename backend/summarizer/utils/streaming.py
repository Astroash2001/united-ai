"""
Helpers for streaming AI output to the browser as newline-delimited JSON.

Each line is one JSON object:
    {"delta": "..."}   a piece of generated text
    {"error": "..."}   generation failed (last line)
    {"done": true}     generation finished (last line)
"""
import json
from typing import Iterator, Optional, Tuple

from django.http import StreamingHttpResponse


def ndjson_response(pieces: Iterator[Tuple[str, Optional[str]]]) -> StreamingHttpResponse:
    """Wrap a (text_delta, error) generator in a streaming NDJSON response."""

    def lines():
        for delta, error in pieces:
            if error:
                yield json.dumps({"error": error}) + "\n"
                return
            if delta:
                yield json.dumps({"delta": delta}) + "\n"
        yield json.dumps({"done": True}) + "\n"

    response = StreamingHttpResponse(lines(), content_type="application/x-ndjson")
    # Stop proxies from buffering the stream.
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
