"""Remote `code_source` support for KG packs.

A pack states one `code_source` in its `@sources` block. A local value stays a
path. A remote value names a repository, and this module keeps a shallow clone
of it in one shared cache, so every later step reads plain files on disk.

Pros: `resolve_items_node_href`, the content routes, and the code-reference
resolver need no remote branch, and two packs on the same repository and ref
share one clone.
Cons: the first page render pays the clone; every file under the cache is
readable through the content routes that code links use; and the clone is
shallow, so a `change=` reference finds no history to diff and reports its
own diagnostic. Deepen the clone before relying on `change=` here.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

from loguru import logger

CLONE_TIMEOUT_SECONDS = 120
# The cache sits in the user's home, not in a content root and not in /tmp. A
# world-writable cache would let another local account plant files that the
# content routes then serve.
CACHE_ROOT = Path.home() / ".cache" / "vyasa" / "code"
# Code links name the cache by this slug prefix. It is not a mount alias.
CACHE_SLUG_PREFIX = "vyasa-code"

# `git+` marks intent when the URL alone is ambiguous; both forms are accepted.
_URL_RE = re.compile(r"^(?:git\+)?(?:(?:https?|ssh|git)://\S+|git@[^:\s]+:\S+)$")


def _split_ref(spec: str) -> tuple[str, str]:
    """Split `<url>@<ref>` at the separator, leaving other `@` signs alone.

    Three `@` signs compete: SSH user info, the scp-form separator, and the
    ref. The ref is the tail after the last `@` when that tail carries no
    `:` (which would make it a host and port) and the head still names a
    path (which a bare `user@host` does not).

    >>> _split_ref("https://github.com/a/b@v1.0.1")
    ('https://github.com/a/b', 'v1.0.1')
    >>> _split_ref("https://github.com/a/b@release/1.0")
    ('https://github.com/a/b', 'release/1.0')
    >>> _split_ref("git@github.com:a/b.git")
    ('git@github.com:a/b.git', '')
    >>> _split_ref("ssh://git@host/a/b")
    ('ssh://git@host/a/b', '')
    """
    head, sep, tail = spec.rpartition("@")
    if not sep or ":" in tail:
        return spec, ""
    if "/" not in head.partition("://")[2] or not tail:
        return spec, ""
    return head, tail


def parse_remote_code_source(spec: str) -> tuple[str, str] | None:
    """Split one remote `code_source` into its clone URL and ref.

    Returns None for a local path, so the caller keeps its existing behaviour.

    >>> parse_remote_code_source("git+https://github.com/theskumar/python-dotenv@v1.0.1")
    ('https://github.com/theskumar/python-dotenv', 'v1.0.1')
    >>> parse_remote_code_source("https://github.com/theskumar/python-dotenv")
    ('https://github.com/theskumar/python-dotenv', '')
    >>> parse_remote_code_source("../../") is None
    True
    """
    spec = str(spec or "").strip()
    url, ref = _split_ref(spec)
    if not _URL_RE.match(url):
        return None
    return url.partition("git+")[2] or url, ref


def origin_slug(url: str, ref: str) -> str:
    """The `host/owner/repo@ref` label for one source.

    The ref sits in the last segment and carries no `/`, so
    `split_origin_slug` can find where the origin ends and the file path
    begins. A slash in a branch name becomes `-`, which means two refs that
    differ only there would share a folder.

    >>> origin_slug("https://github.com/a/b", "v1")
    'github.com/a/b@v1'
    >>> origin_slug("git@github.com:a/b.git", "")
    'github.com/a/b@HEAD'
    >>> origin_slug("https://gitlab.com/group/sub/proj", "release/1.0")
    'gitlab.com/group/sub/proj@release-1.0'
    """
    if "://" in url:
        split = urlsplit(url)
        host, trail = split.hostname or "", split.path or ""
    else:
        # scp form, as in `git@github.com:owner/repo.git`.
        location, _, trail = url.partition(":")
        host = location.rpartition("@")[2]
    owner, _, repo = trail.strip("/").rpartition("/")
    repo = re.sub(r"\.git$", "", repo) or "repo"
    tail = f"{repo}@{(ref or 'HEAD').replace('/', '-')}"
    return "/".join(part for part in (host or "unknown-host", owner, tail) if part)


def split_origin_slug(slug: str) -> tuple[str, str] | None:
    """Split a cache slug into its origin label and the path inside the repo.

    Display wants the two apart: the origin repeats on every reference in a
    pack, so showing it beside a short file path reads better than one long
    slug. The address stays whole; only the label splits.

    >>> split_origin_slug("vyasa-code/github.com/a/b@v1/src/main.py")
    ('github.com/a/b@v1', 'src/main.py')
    >>> split_origin_slug("vyasa/helpers.py") is None
    True
    """
    parts = str(slug or "").strip("/").split("/")
    if not parts or parts[0] != CACHE_SLUG_PREFIX:
        return None
    for index, part in enumerate(parts[1:], 1):
        if "@" in part:
            return "/".join(parts[1:index + 1]), "/".join(parts[index + 1:])
    return None


def clone_directory(url: str, ref: str) -> Path:
    """Where one repository at one ref is kept inside the cache.

    >>> clone_directory("https://github.com/a/b", "v1").relative_to(CACHE_ROOT).as_posix()
    'github.com/a/b@v1'
    """
    return CACHE_ROOT / origin_slug(url, ref)


def ensure_shallow_clone(url: str, ref: str) -> Path | None:
    """Clone the repository once, then reuse it.

    Returns None when the clone cannot be made, so the pack falls back to the
    attribute text it already carries instead of breaking the page.
    """
    target = clone_directory(url, ref)
    if (target / ".git").exists():
        return target
    command = ["git", "clone", "--depth", "1"]
    if ref:
        command += ["--branch", ref]
    command += [url, str(target)]
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=CLONE_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        detail = getattr(exc, "stderr", b"") or b""
        logger.warning(
            "code_source clone failed url={} ref={} error={} detail={}",
            url, ref or "-", exc, detail.decode("utf-8", "replace").strip()[:400],
        )
        return None
    logger.info("code_source cloned url={} ref={} path={}", url, ref or "-", target)
    return target
