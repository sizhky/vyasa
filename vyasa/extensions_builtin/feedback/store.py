from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from threading import Lock
from typing import Iterator


@dataclass(frozen=True)
class FeedbackEvent:
    cursor: int
    id: str
    document: str
    kind: str
    payload: dict
    created_at: str


class FeedbackStore:
    def __init__(self, root: Path):
        self.path = root / ".vyasa-feedback.db"
        self._initialized = False
        self._init_lock = Lock()

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        if not self._initialized:
            with self._init_lock:
                if not self._initialized:
                    connection.execute("PRAGMA journal_mode=WAL")
                    connection.execute(
                        """CREATE TABLE IF NOT EXISTS feedback_events (
                            cursor INTEGER PRIMARY KEY AUTOINCREMENT,
                            id TEXT NOT NULL UNIQUE,
                            document TEXT NOT NULL,
                            kind TEXT NOT NULL,
                            payload TEXT NOT NULL,
                            created_at TEXT NOT NULL
                        )"""
                    )
                    connection.execute(
                        """CREATE TABLE IF NOT EXISTS feedback_state (
                            document TEXT PRIMARY KEY,
                            ack_cursor INTEGER NOT NULL DEFAULT 0,
                            delivered_cursor INTEGER NOT NULL DEFAULT 0
                        )"""
                    )
                    columns = {
                        row[1] for row in connection.execute("PRAGMA table_info(feedback_state)").fetchall()
                    }
                    if "delivered_cursor" not in columns:
                        connection.execute(
                            "ALTER TABLE feedback_state ADD COLUMN delivered_cursor INTEGER NOT NULL DEFAULT 0"
                        )
                    connection.execute(
                        "CREATE INDEX IF NOT EXISTS feedback_events_document_cursor ON feedback_events(document, cursor)"
                    )
                    connection.commit()
                    self._initialized = True
        return connection

    def append(self, *, event_id: str, document: str, kind: str, payload: dict) -> FeedbackEvent:
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                "INSERT INTO feedback_events(id, document, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)",
                (event_id, document, kind, json.dumps(payload, separators=(",", ":")), created_at),
            ).lastrowid
        return FeedbackEvent(int(cursor or 0), event_id, document, kind, payload, created_at)

    def after(self, document: str, cursor: int, *, kinds: tuple[str, ...] = ()) -> list[FeedbackEvent]:
        params: list[object] = [document, max(0, cursor)]
        where = "document = ? AND cursor > ?"
        if kinds:
            where += f" AND kind IN ({','.join('?' for _ in kinds)})"
            params.extend(kinds)
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT cursor, id, document, kind, payload, created_at FROM feedback_events WHERE {where} ORDER BY cursor",
                params,
            ).fetchall()
        return [_event(row) for row in rows]

    def recent(self, document: str, *, limit: int = 100) -> list[FeedbackEvent]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT cursor, id, document, kind, payload, created_at
                   FROM feedback_events WHERE document = ? ORDER BY cursor DESC LIMIT ?""",
                (document, max(1, min(limit, 500))),
            ).fetchall()
        return [_event(row) for row in reversed(rows)]

    def acknowledge(self, document: str, cursor: int) -> int:
        cursor = max(0, cursor)
        with self._connect() as connection:
            latest = connection.execute(
                "SELECT COALESCE(MAX(cursor), 0) AS cursor FROM feedback_events WHERE document = ? AND kind = 'feedback'",
                (document,),
            ).fetchone()
            cursor = min(cursor, int(latest["cursor"] if latest else 0))
            connection.execute(
                """INSERT INTO feedback_state(document, ack_cursor) VALUES (?, ?)
                   ON CONFLICT(document) DO UPDATE SET ack_cursor = MAX(ack_cursor, excluded.ack_cursor)""",
                (document, cursor),
            )
            row = connection.execute(
                "SELECT ack_cursor FROM feedback_state WHERE document = ?", (document,)
            ).fetchone()
        return int(row["ack_cursor"] if row else 0)

    def acknowledged_cursor(self, document: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT ack_cursor FROM feedback_state WHERE document = ?", (document,)
            ).fetchone()
        return int(row["ack_cursor"] if row else 0)

    def mark_delivered(self, document: str, cursor: int) -> int:
        cursor = max(0, cursor)
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO feedback_state(document, ack_cursor, delivered_cursor) VALUES (?, 0, ?)
                   ON CONFLICT(document) DO UPDATE SET delivered_cursor = MAX(delivered_cursor, excluded.delivered_cursor)""",
                (document, cursor),
            )
            row = connection.execute(
                "SELECT delivered_cursor FROM feedback_state WHERE document = ?", (document,)
            ).fetchone()
        return int(row["delivered_cursor"] if row else 0)

    def delivered_cursor(self, document: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT delivered_cursor FROM feedback_state WHERE document = ?", (document,)
            ).fetchone()
        return int(row["delivered_cursor"] if row else 0)

    def latest_feedback_cursor(self, document: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT COALESCE(MAX(cursor), 0) AS cursor FROM feedback_events WHERE document = ? AND kind = 'feedback'",
                (document,),
            ).fetchone()
        return int(row["cursor"] if row else 0)


class PresenceRegistry:
    def __init__(self):
        self._active: dict[str, int] = {}
        self._lock = Lock()

    @contextmanager
    def polling(self, document: str) -> Iterator[None]:
        with self._lock:
            self._active[document] = self._active.get(document, 0) + 1
        try:
            yield
        finally:
            with self._lock:
                count = self._active.get(document, 1) - 1
                if count > 0:
                    self._active[document] = count
                else:
                    self._active.pop(document, None)

    def is_listening(self, document: str) -> bool:
        with self._lock:
            return self._active.get(document, 0) > 0


def event_payload(event: FeedbackEvent) -> dict:
    return {
        "cursor": event.cursor,
        "id": event.id,
        "kind": event.kind,
        "created_at": event.created_at,
        **event.payload,
    }


def _event(row: sqlite3.Row) -> FeedbackEvent:
    return FeedbackEvent(
        cursor=int(row["cursor"]),
        id=str(row["id"]),
        document=str(row["document"]),
        kind=str(row["kind"]),
        payload=json.loads(row["payload"]),
        created_at=str(row["created_at"]),
    )
