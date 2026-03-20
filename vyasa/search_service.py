import re
from functools import lru_cache


def normalize_search_text(text):
    text = (text or "").lower().replace("-", " ").replace("_", " ")
    return " ".join(text.split())


def parse_search_query(query):
    trimmed = (query or "").strip()
    if len(trimmed) >= 2 and trimmed.startswith("/") and trimmed.endswith("/"):
        pattern = trimmed[1:-1].strip()
        if not pattern:
            return None, ""
        try:
            return re.compile(pattern, re.IGNORECASE), ""
        except re.error:
            return None, "Invalid regex. Showing normal matches instead."
    return None, ""


@lru_cache(maxsize=256)
def cached_search_matches(fingerprint, show_hidden, query, limit, finder):
    return finder(query, limit)


def find_search_matches(query, limit, fingerprint, show_hidden, finder):
    return cached_search_matches(fingerprint, show_hidden, query, limit, finder)
