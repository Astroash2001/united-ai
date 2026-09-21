"""
Tests for retrieval, transcription helpers, streaming, history, throttling,
and the external-service endpoints (with network calls mocked).

Run with: python manage.py test summarizer
"""
import io
import json
import os
import tempfile
import urllib.error
import uuid
import wave
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import HistoryEntry
from .utils.audio_transcriber import (
    TranscriptionError, audio_transcriber, format_timestamp, parse_chapters, prepare_audio, utterances_to_lines,
)
from .utils.retrieval import chunk_text, rank_chunks, select_relevant_context, tokenize
from .utils.transcript_transform import _batches, transform_transcript
from .utils.youtube import is_youtube_url


class RetrievalTests(SimpleTestCase):
    def test_tokenize_keeps_hindi_words_whole(self):
        self.assertEqual(tokenize("Budget बजट है"), ["budget", "बजट", "है"])

    def test_chunks_overlap_and_cover_text(self):
        text = " ".join(f"word{i}" for i in range(2000))
        chunks = chunk_text(text, chunk_size=500, overlap=100)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 500 for chunk in chunks))
        self.assertIn("word0", chunks[0])
        self.assertIn("word1999", chunks[-1])

    def test_rank_puts_matching_chunk_first(self):
        chunks = ["cats and dogs", "the budget was forty crore", "weather report"]
        self.assertEqual(rank_chunks(chunks, "what was the budget?")[0], 1)

    def test_short_document_returned_whole(self):
        self.assertEqual(select_relevant_context("short text", "anything"), "short text")

    def test_long_document_finds_passage_beyond_first_8000_chars(self):
        filler = "Lorem ipsum dolor sit amet. " * 1000
        text = filler + "The secret launch code is PINEAPPLE-42. " + filler
        context = select_relevant_context(text, "What is the secret launch code?", max_chars=3000)
        self.assertLessEqual(len(context), 3000)
        self.assertIn("PINEAPPLE-42", context)


class TranscriptionHelperTests(SimpleTestCase):
    def test_format_timestamp(self):
        self.assertEqual(format_timestamp(75.9), "01:15")
        self.assertEqual(format_timestamp(3723), "01:02:03")

    def test_parse_chapters_only_reads_chapter_section(self):
        summary = (
            "## 🚩 Video/Audio Chapter Flags & Timestamps\n"
            "- [00:00] Intro\n"
            "- [01:15] **Budget** review\n"
            "## 📌 Executive Summary\n"
            "- [02:00] not a chapter\n"
        )
        self.assertEqual(parse_chapters(summary), [
            {"timestamp": "00:00", "title": "Intro", "seconds": 0},
            {"timestamp": "01:15", "title": "Budget review", "seconds": 75},
        ])

    @staticmethod
    def _write_wav(path, seconds):
        with wave.open(path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\0" * 16000 * 2 * seconds)

    def test_small_audio_file_is_used_as_is(self):
        with tempfile.TemporaryDirectory() as work_dir:
            path = os.path.join(work_dir, "tone.wav")
            self._write_wav(path, 1)
            self.assertEqual(prepare_audio(path, work_dir), path)

    def test_video_is_converted_to_compact_mp3(self):
        with tempfile.TemporaryDirectory() as work_dir:
            path = os.path.join(work_dir, "clip.mkv")
            self._write_wav(path, 2)  # ffmpeg detects the real format from content
            result = prepare_audio(path, work_dir)
            self.assertTrue(result.endswith("compact.mp3"))
            self.assertLess(os.path.getsize(result), os.path.getsize(path))

    def test_unreadable_file_gives_friendly_error(self):
        with tempfile.TemporaryDirectory() as work_dir:
            path = os.path.join(work_dir, "broken.mp4")
            with open(path, "wb") as f:
                f.write(b"not a video")
            with self.assertRaises(TranscriptionError):
                prepare_audio(path, work_dir)

    def test_utterances_grouped_into_timestamped_lines(self):
        utterances = [
            {"start": 0.0, "end": 1.5, "speaker": 0, "transcript": "Hello team."},
            {"start": 1.8, "end": 3.0, "speaker": 0, "transcript": "आज हम launch discuss करेंगे."},
            {"start": 6.0, "end": 7.0, "speaker": 0, "transcript": "After a pause."},
            {"start": 7.2, "end": 8.0, "speaker": 1, "transcript": "ठीक है."},
        ]
        self.assertEqual(utterances_to_lines(utterances), [
            "[00:00] [Speaker 1] Hello team. आज हम launch discuss करेंगे.",
            "[00:06] [Speaker 1] After a pause.",
            "[00:07] [Speaker 2] ठीक है.",
        ])

    def test_single_speaker_has_no_labels(self):
        lines = utterances_to_lines([{"start": 65, "end": 66, "speaker": 0, "transcript": "Only me."}])
        self.assertEqual(lines, ["[01:05] Only me."])

    @override_settings(DEEPGRAM_API_KEY="dg-key")
    @patch("summarizer.utils.audio_transcriber.urllib.request.urlopen")
    def test_transcribe_path_uses_deepgram_multi_language(self, mock_urlopen):
        payload = {"results": {
            "channels": [{"alternatives": [{"transcript": "Hello. ठीक है."}]}],
            "utterances": [{"start": 0, "end": 1, "speaker": 0, "transcript": "Hello. ठीक है."}],
        }}
        mock_urlopen.return_value.__enter__.return_value = io.BytesIO(json.dumps(payload).encode())
        with tempfile.TemporaryDirectory() as work_dir:
            path = os.path.join(work_dir, "tone.wav")
            self._write_wav(path, 1)
            transcript, summary, chapters, error = audio_transcriber.transcribe_path(path, summarize=False)

        self.assertIsNone(error)
        self.assertEqual(transcript, "[00:00] Hello. ठीक है.")
        request = mock_urlopen.call_args.args[0]
        self.assertIn("language=multi", request.full_url)
        self.assertIn("diarize=true", request.full_url)
        self.assertEqual(request.get_header("Authorization"), "Token dg-key")

    @override_settings(DEEPGRAM_API_KEY="")
    def test_missing_deepgram_key_reported(self):
        with tempfile.TemporaryDirectory() as work_dir:
            path = os.path.join(work_dir, "tone.wav")
            self._write_wav(path, 1)
            error = audio_transcriber.transcribe_path(path, summarize=False)[3]
        self.assertIn("DEEPGRAM_API_KEY", error)

    def test_youtube_url_check(self):
        self.assertTrue(is_youtube_url("https://www.youtube.com/watch?v=jNQXAC9IVRw"))
        self.assertTrue(is_youtube_url("https://youtu.be/jNQXAC9IVRw"))
        self.assertFalse(is_youtube_url("https://evil.example/youtube.com/watch?v=x"))
        self.assertFalse(is_youtube_url("file:///etc/passwd"))


class TransformTests(SimpleTestCase):
    def test_batches_keep_whole_lines(self):
        text = "\n".join(f"[00:{i:02d}] line {i} " + "x" * 100 for i in range(120))
        batches = _batches(text)
        self.assertGreater(len(batches), 1)
        self.assertEqual("\n".join(batches), text)

    def test_unknown_target_rejected(self):
        self.assertEqual(transform_transcript("text", "french")[1], "Unknown target. Use 'latin' or 'english'.")

    @override_settings(LLM_API_KEY="test-key")
    @patch("summarizer.utils.llm_client.OpenAI")
    def test_transform_joins_batches_in_order(self, mock_openai):
        def echo(**kwargs):
            response = MagicMock()
            response.choices = [MagicMock()]
            response.choices[0].message.content = kwargs["messages"][1]["content"].upper()
            return response

        mock_openai.return_value.chat.completions.create.side_effect = echo
        text = "\n".join(f"line {i} " + "x" * 200 for i in range(60))
        result, error = transform_transcript(text, "english")
        self.assertIsNone(error)
        self.assertEqual(result, text.upper())


@override_settings(LLM_API_KEY="test-key")
class StreamingTests(APITestCase):
    @patch("summarizer.utils.llm_client.OpenAI")
    def test_chat_streams_ndjson(self, mock_openai):
        chunks = []
        for piece in ["The sky ", "is green."]:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = piece
            chunks.append(chunk)
        mock_openai.return_value.chat.completions.create.return_value = iter(chunks)

        # The chat view uses the module-level summarizer client; point it at the mock.
        from .utils import ai_summarizer as summarizer_module
        with patch.object(summarizer_module.ai_summarizer, "client", mock_openai.return_value):
            response = self.client.post(
                "/api/chat-document/",
                {"question": "What colour is the sky?", "context": "The sky is green.", "stream": True},
                format="json",
            )
            lines = [json.loads(line) for line in b"".join(response.streaming_content).decode().splitlines()]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(lines, [{"delta": "The sky "}, {"delta": "is green."}, {"done": True}])


class HistoryAPITests(APITestCase):
    def setUp(self):
        self.client_id = str(uuid.uuid4())
        self.headers = {"HTTP_X_CLIENT_ID": self.client_id}

    def create(self, **fields):
        data = {"kind": "audio", "title": "Meeting", "transcript": "[00:00] Hello", **fields}
        return self.client.post("/api/history/", data, format="json", **self.headers)

    def test_requires_client_id(self):
        response = self.client.get("/api/history/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_list_get_update_delete(self):
        created = self.create()
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        entry_id = created.data["entry"]["id"]

        listed = self.client.get("/api/history/", **self.headers)
        self.assertEqual([e["id"] for e in listed.data["entries"]], [entry_id])
        self.assertNotIn("transcript", listed.data["entries"][0])

        messages = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
        patched = self.client.patch(f"/api/history/{entry_id}/", {"messages": messages}, format="json", **self.headers)
        self.assertEqual(patched.data["entry"]["messages"], messages)

        deleted = self.client.delete(f"/api/history/{entry_id}/", **self.headers)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(HistoryEntry.objects.exists())

    def test_other_client_cannot_read_or_delete(self):
        entry_id = self.create().data["entry"]["id"]
        other = {"HTTP_X_CLIENT_ID": str(uuid.uuid4())}
        self.assertEqual(self.client.get(f"/api/history/{entry_id}/", **other).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(f"/api/history/{entry_id}/", **other).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get("/api/history/", **other).data["entries"], [])

    def test_invalid_messages_rejected(self):
        response = self.create(messages=[{"role": "system", "content": "x"}])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("messages", response.data["error"])

    @patch("summarizer.history_views.MAX_ENTRIES_PER_CLIENT", 2)
    def test_oldest_entries_pruned(self):
        for title in ["one", "two", "three"]:
            self.create(title=title)
        titles = [e["title"] for e in self.client.get("/api/history/", **self.headers).data["entries"]]
        self.assertEqual(titles, ["three", "two"])


class ThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_ai_text_scope_limits_requests(self):
        from rest_framework.throttling import ScopedRateThrottle
        with patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"ai_text": "2/hour"}):
            codes = [
                self.client.post("/api/chat-document/", {"question": "", "context": ""}, format="json").status_code
                for _ in range(3)
            ]
        self.assertEqual(codes, [400, 400, 429])


class DeepgramTokenTests(APITestCase):
    @override_settings(DEEPGRAM_API_KEY="")
    def test_missing_key(self):
        response = self.client.post("/api/deepgram-token/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(DEEPGRAM_API_KEY="dg-key")
    @patch("urllib.request.urlopen")
    def test_returns_short_lived_token_only(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value = io.BytesIO(b'{"access_token": "tmp", "expires_in": 60}')
        response = self.client.post("/api/deepgram-token/")
        self.assertEqual(response.data["access_token"], "tmp")
        self.assertNotIn("dg-key", json.dumps(response.data))

    @override_settings(DEEPGRAM_API_KEY="dg-key")
    @patch("urllib.request.urlopen")
    def test_grant_failure_is_reported(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError("url", 403, "Forbidden", {}, io.BytesIO(b"no"))
        response = self.client.post("/api/deepgram-token/")
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)


class WebSourceTests(APITestCase):
    def test_extract_url_rejects_non_http(self):
        response = self.client.post("/api/extract-url/", {"url": "file:///etc/passwd"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)

    @patch("urllib.request.urlopen")
    def test_extract_url_returns_page_text(self, mock_urlopen):
        payload = {"data": {"title": "Phobos", "content": "Phobos is a moon of Mars."}}
        mock_urlopen.return_value.__enter__.return_value = io.BytesIO(json.dumps(payload).encode())
        response = self.client.post("/api/extract-url/", {"url": "https://example.com/phobos"}, format="json")
        self.assertEqual(response.data["filename"], "Phobos")
        self.assertIn("moon of Mars", response.data["text"])

    @override_settings(TAVILY_API_KEY="")
    def test_web_search_requires_key(self):
        response = self.client.post(
            "/api/chat-document/",
            {"question": "q", "context": "c", "web_search": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("TAVILY_API_KEY", response.data["error"])


class MediaUploadLimitTests(APITestCase):
    @override_settings(MAX_MEDIA_FILE_SIZE=10)
    def test_oversized_media_rejected_before_transcription(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = SimpleUploadedFile("big.mp3", b"x" * 100, content_type="audio/mpeg")
        with patch("summarizer.transcription_views.transcribe_audio_video") as mock_transcribe:
            response = self.client.post("/api/transcribe-audio/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_transcribe.assert_not_called()


class LongDocumentSummaryTests(TestCase):
    @override_settings(LLM_API_KEY="test-key")
    @patch("summarizer.utils.llm_client.OpenAI")
    def test_long_document_is_summarized_by_section(self, mock_openai):
        from .utils.ai_summarizer import AISummarizer

        response = MagicMock()
        response.choices = [MagicMock()]
        response.choices[0].message.content = "notes"
        mock_openai.return_value.chat.completions.create.return_value = response

        summary, error = AISummarizer().summarize("A sentence about budgets. " * 2000)  # ~52k chars

        self.assertIsNone(error)
        calls = mock_openai.return_value.chat.completions.create.call_args_list
        # Several section calls plus one final combining call.
        self.assertGreater(len(calls), 2)
        self.assertIn("notes from every section", calls[-1].kwargs["messages"][1]["content"])
