"""Bare-mirror storage and the freshness poller.

The fetcher is the write side of the git-backed content split: it keeps
local bare mirrors current so the server (read side) can serve the latest
objects without ever touching a working tree. It is meant to run as its own
job (cron or sidecar) — see `vyasa-fetch` / `python -m vyasa.git_fetcher`.

Mirrors are maintained with the `git` binary (robust `--prune` and auth);
reads elsewhere go through dulwich.
"""

from __future__ import annotations

import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from .logging import logger


@dataclass(frozen=True)
class MirrorSpec:
    """One upstream repo mirrored locally. `name` becomes the mount alias."""

    name: str
    url: str

    def mirror_path(self, mirror_root: Path) -> Path:
        return (Path(mirror_root) / f"{self.name}.git").resolve()


def _run_git(*args, timeout: float = 120.0) -> tuple[bool, str]:
    try:
        proc = subprocess.run(["git", *args], capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    return proc.returncode == 0, (proc.stderr or proc.stdout).strip()


def ensure_mirror(spec: MirrorSpec, mirror_root: Path) -> bool:
    """Create the bare mirror if missing. Idempotent."""
    path = spec.mirror_path(mirror_root)
    if (path / "HEAD").exists():
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, msg = _run_git("clone", "--mirror", spec.url, str(path))
    if not ok:
        logger.warning("git mirror clone failed for {}: {}", spec.name, msg)
    return ok


def fetch_mirror(spec: MirrorSpec, mirror_root: Path) -> bool:
    """Fetch latest objects and prune deleted refs for one mirror.

    Isolated: any failure (auth, network) is logged and reported, never
    raised, so one bad repo cannot stall the cycle."""
    path = spec.mirror_path(mirror_root)
    if not (path / "HEAD").exists():
        return ensure_mirror(spec, mirror_root)
    ok, msg = _run_git("-C", str(path), "fetch", "--prune", "origin")
    if not ok:
        logger.warning("git fetch failed for {}: {}", spec.name, msg)
    return ok


def fetch_clone_remotes(root: Path) -> bool:
    """Fetch all remotes for a working clone used as a content root."""
    ok_remotes, remotes = _run_git("-C", str(root), "remote")
    if ok_remotes and not remotes:
        return True
    ok, msg = _run_git("-C", str(root), "fetch", "--all", "--prune")
    if not ok:
        logger.warning("git fetch --all failed for {}: {}", root, msg)
    return ok


def fetch_all(specs: list[MirrorSpec], mirror_root: Path, *, max_workers: int = 4) -> dict[str, bool]:
    """Fetch every mirror concurrently in a bounded pool. Returns name->ok."""
    mirror_root = Path(mirror_root)
    if not specs:
        return {}
    with ThreadPoolExecutor(max_workers=max(1, min(max_workers, len(specs)))) as pool:
        results = pool.map(lambda s: (s.name, fetch_mirror(s, mirror_root)), specs)
        return dict(results)


def poll_forever(specs: list[MirrorSpec], mirror_root: Path, *, interval: float = 30.0, max_workers: int = 4) -> None:
    """Run non-overlapping fetch cycles. The next cycle starts `interval`
    seconds after the previous one *finishes*, so slow fetches never stack."""
    logger.info("git fetcher polling {} mirror(s) every {}s -> {}", len(specs), interval, mirror_root)
    while True:
        started = time.time()
        results = fetch_all(specs, mirror_root, max_workers=max_workers)
        failed = [name for name, ok in results.items() if not ok]
        logger.info("fetch cycle done in {:.1f}s ({} ok, {} failed)", time.time() - started, len(results) - len(failed), len(failed))
        time.sleep(interval)


def specs_from_config() -> tuple[list[MirrorSpec], Path]:
    from .config import get_config

    cfg = get_config()
    specs = [MirrorSpec(name, url) for name, url in cfg.get_git_repos()]
    return specs, cfg.get_git_mirror_root()


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(prog="vyasa-fetch", description="Maintain bare mirrors of configured git content repos.")
    parser.add_argument("--once", action="store_true", help="Run a single fetch cycle and exit.")
    parser.add_argument("--interval", type=float, default=30.0, help="Seconds between fetch cycles (default 30).")
    parser.add_argument("--workers", type=int, default=4, help="Max concurrent fetches.")
    args = parser.parse_args(argv)

    specs, mirror_root = specs_from_config()
    if not specs:
        logger.warning("No git_repos configured; nothing to fetch.")
        return 0
    if args.once:
        results = fetch_all(specs, mirror_root, max_workers=args.workers)
        return 0 if all(results.values()) else 1
    poll_forever(specs, mirror_root, interval=args.interval, max_workers=args.workers)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
