"""
Saved history of transcripts, summaries, and document chats.

There are no user accounts: every request must carry an X-Client-Id header
(an anonymous per-browser UUID) and only sees entries saved with that ID.
"""
import uuid

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HistoryEntry
from .serializers import HistoryEntrySerializer, HistoryListSerializer

# Oldest entries beyond this count are deleted for each client.
MAX_ENTRIES_PER_CLIENT = 200


def _client_id(request):
    """Return the validated client ID from the X-Client-Id header, or None."""
    raw = request.headers.get("X-Client-Id", "")
    try:
        return str(uuid.UUID(raw))
    except ValueError:
        return None


def _first_error(errors):
    """Turn DRF serializer errors into one readable message."""
    field, messages = next(iter(errors.items()))
    message = messages[0] if isinstance(messages, list) and messages else messages
    return f"{field}: {message}"


def _missing_client_response():
    return Response(
        {"error": "Missing or invalid X-Client-Id header.", "status": "failed"},
        status=status.HTTP_400_BAD_REQUEST,
    )


class HistoryListView(APIView):
    """
    GET  /api/history/  list this browser's entries (newest first)
    POST /api/history/  save a new entry
    """
    throttle_scope = "history"

    def get(self, request):
        client_id = _client_id(request)
        if not client_id:
            return _missing_client_response()
        entries = HistoryEntry.objects.filter(client_id=client_id)
        kind = request.query_params.get("kind")
        if kind:
            entries = entries.filter(kind=kind)
        return Response({"entries": HistoryListSerializer(entries, many=True).data, "status": "success"})

    def post(self, request):
        client_id = _client_id(request)
        if not client_id:
            return _missing_client_response()

        serializer = HistoryEntrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": _first_error(serializer.errors), "status": "failed"}, status=status.HTTP_400_BAD_REQUEST)
        entry = serializer.save(client_id=client_id)

        stale_ids = HistoryEntry.objects.filter(client_id=client_id).values_list("id", flat=True)[MAX_ENTRIES_PER_CLIENT:]
        HistoryEntry.objects.filter(id__in=list(stale_ids)).delete()

        return Response({"entry": HistoryEntrySerializer(entry).data, "status": "success"}, status=status.HTTP_201_CREATED)


class HistoryDetailView(APIView):
    """
    GET    /api/history/<id>/  full entry
    PATCH  /api/history/<id>/  update fields (e.g. new chat messages)
    DELETE /api/history/<id>/  remove entry
    """
    throttle_scope = "history"

    def _get_entry(self, request, entry_id):
        client_id = _client_id(request)
        if not client_id:
            return None, _missing_client_response()
        entry = HistoryEntry.objects.filter(id=entry_id, client_id=client_id).first()
        if not entry:
            return None, Response({"error": "Entry not found.", "status": "failed"}, status=status.HTTP_404_NOT_FOUND)
        return entry, None

    def get(self, request, entry_id):
        entry, error = self._get_entry(request, entry_id)
        if error:
            return error
        return Response({"entry": HistoryEntrySerializer(entry).data, "status": "success"})

    def patch(self, request, entry_id):
        entry, error = self._get_entry(request, entry_id)
        if error:
            return error
        serializer = HistoryEntrySerializer(entry, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"error": _first_error(serializer.errors), "status": "failed"}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"entry": serializer.data, "status": "success"})

    def delete(self, request, entry_id):
        entry, error = self._get_entry(request, entry_id)
        if error:
            return error
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
