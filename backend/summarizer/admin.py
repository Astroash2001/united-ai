from django.contrib import admin

from .models import HistoryEntry


@admin.register(HistoryEntry)
class HistoryEntryAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "client_id", "updated_at")
    list_filter = ("kind",)
    search_fields = ("title",)
