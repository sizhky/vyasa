from datetime import datetime, timedelta

from vyasa.helpers import format_last_modified_label


def test_format_last_modified_label_uses_relative_text_for_recent_files(tmp_path):
    path = tmp_path / "recent.md"
    path.write_text("hello", encoding="utf-8")
    modified_at = datetime.now() - timedelta(minutes=5)
    timestamp = modified_at.timestamp()
    path.touch()
    import os
    os.utime(path, (timestamp, timestamp))

    assert format_last_modified_label(path) == "Updated 5 min ago"


def test_format_last_modified_label_uses_date_after_a_week(tmp_path):
    path = tmp_path / "older.md"
    path.write_text("hello", encoding="utf-8")
    modified_at = datetime.now() - timedelta(days=8)
    timestamp = modified_at.timestamp()
    path.touch()
    import os
    os.utime(path, (timestamp, timestamp))

    assert format_last_modified_label(path) == f"Updated {modified_at.strftime('%b %d, %Y')}"
