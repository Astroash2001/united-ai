from django.db import models


class HistoryEntry(models.Model):
    """
    A saved result (transcript, summary, or document chat) for one browser.

    There are no user accounts: entries are scoped by an anonymous client ID
    that the frontend generates and sends in the X-Client-Id header.
    """

    KIND_CHOICES = [
        ("document", "Document summary"),
        ("chat", "Document chat"),
        ("audio", "Audio file"),
        ("video", "Video file"),
        ("youtube", "YouTube video"),
        ("live", "Live recording"),
    ]

    client_id = models.CharField(max_length=64, db_index=True)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    title = models.CharField(max_length=255)
    # Transcript text, or extracted document text for summaries and chats.
    transcript = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    chapters = models.JSONField(default=list, blank=True)
    # Document chat messages: [{"role": "user" | "assistant", "content": "..."}]
    messages = models.JSONField(default=list, blank=True)
    source_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.title}"
