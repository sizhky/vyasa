import re
from pathlib import Path

from ...helpers import (
    content_path_for_slug,
    content_slug_for_path,
    content_url_for_slug,
    find_folder_note_file,
    get_content_mounts,
    iter_visible_files,
    parse_frontmatter,
    resolve_heading_anchor,
    text_to_anchor,
)

_INDEX = {"fingerprint": None, "entries": [], "by_name": {}, "by_alias": {}, "headings": {}}


def _fingerprint():
    return tuple(
        (alias, str(root.resolve()), max((p.stat().st_mtime for p in iter_visible_files(root, (".md",), True)), default=0))
        for alias, root in get_content_mounts()
    )


def _is_folder_note(path: Path) -> bool:
    preferred = find_folder_note_file(path.parent)
    return bool(preferred and preferred.resolve() == path.resolve())


def _route_slug_for_path(path: Path, slug: str) -> str:
    return str(Path(slug).parent).replace("\\", "/").strip(".") if _is_folder_note(path) else slug


def _index():
    fp = _fingerprint()
    if _INDEX["fingerprint"] == fp:
        return _INDEX
    entries, by_name, by_alias = [], {}, {}
    for _, root in get_content_mounts():
        for path in iter_visible_files(root, (".md",), True):
            slug = content_slug_for_path(path)
            if not slug:
                continue
            route_slug = _route_slug_for_path(path, slug)
            entry = {"slug": slug, "route_slug": route_slug, "path": path}
            entries.append(entry)
            by_name.setdefault(path.stem.casefold(), []).append(entry)
            frontmatter, _ = parse_frontmatter(path)
            aliases = frontmatter.get("aliases") or []
            if isinstance(aliases, str):
                aliases = [aliases]
            for alias in aliases:
                alias_text = str(alias).strip()
                if alias_text:
                    by_alias.setdefault(alias_text.casefold(), []).append(entry)
    _INDEX.update(fingerprint=fp, entries=entries, by_name=by_name, by_alias=by_alias, headings={})
    return _INDEX


def _entry_for_slug(slug: str):
    info = _index()
    for entry in info["entries"]:
        if entry["slug"] == slug or entry["route_slug"] == slug:
            return entry
    return None


def _existing_note_entry(base: str):
    exact = content_path_for_slug(base, ".md")
    if exact and exact.exists():
        entry = _entry_for_slug(base)
        if entry:
            return entry
    folder = content_path_for_slug(base)
    if folder and folder.exists() and folder.is_dir():
        note = find_folder_note_file(folder)
        if note:
            slug = content_slug_for_path(note)
            return _entry_for_slug(slug) if slug else None
    return None


def _relative_entry(base: str, current_path: str):
    current = _existing_note_entry(current_path)
    if not current:
        direct = content_path_for_slug(current_path, ".md")
        if direct and direct.exists():
            current = {"path": direct, "slug": current_path, "route_slug": current_path}
    if not current:
        return None
    parent = current["path"].parent
    resolved = (parent / base).resolve()
    slug = content_slug_for_path(resolved)
    if slug:
        entry = _entry_for_slug(slug)
        if entry:
            return entry
    if resolved.exists() and resolved.is_dir():
        note = find_folder_note_file(resolved)
        if note:
            note_slug = content_slug_for_path(note)
            return _entry_for_slug(note_slug) if note_slug else None
    md_resolved = resolved.with_suffix(".md") if not resolved.suffix else resolved
    slug = content_slug_for_path(md_resolved)
    return _entry_for_slug(slug) if slug else None


def _resolve_note(target: str, current_path: str | None):
    base = target.strip().strip("/")
    if not base:
        return _existing_note_entry(current_path) if current_path else None
    entry = _existing_note_entry(base)
    if entry:
        return entry
    if current_path:
        entry = _relative_entry(base, current_path)
        if entry:
            return entry
    key = Path(base).name.casefold()
    matches = _index()["by_name"].get(key, [])
    if len(matches) == 1:
        return matches[0]
    alias_matches = _index()["by_alias"].get(base.casefold(), [])
    if len(alias_matches) == 1:
        return alias_matches[0]
    return None


def _heading_map_for_entry(entry):
    path = entry["path"]
    key = (entry["slug"], path.stat().st_mtime)
    if key in _INDEX["headings"]:
        return _INDEX["headings"][key]
    counts, stack, mapping, in_fence = {}, [], {}, False
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
        if not match:
            continue
        level, raw = len(match.group(1)), match.group(2).strip()
        text, anchor = resolve_heading_anchor(raw, counts)
        stack = stack[: level - 1] + [text]
        chain = "#".join(part.casefold() for part in stack)
        mapping[chain] = anchor
        mapping[anchor.casefold()] = anchor
        mapping[text.casefold()] = mapping.get(text.casefold(), anchor)
        mapping[text_to_anchor(text).casefold()] = mapping.get(text_to_anchor(text).casefold(), anchor)
    _INDEX["headings"] = {k: v for k, v in _INDEX["headings"].items() if k[0] != entry["slug"]}
    _INDEX["headings"][key] = mapping
    return mapping


def _resolve_heading_fragment(entry, parts):
    if not parts:
        return None
    heading_map = _heading_map_for_entry(entry)
    chain = "#".join(part.strip().casefold() for part in parts if part.strip())
    if not chain:
        return None
    return heading_map.get(chain) or heading_map.get(parts[-1].strip().casefold()) or heading_map.get(text_to_anchor(parts[-1].strip()).casefold())


def rewrite_wikilinks(content, current_path=None):
    protected = []
    content = re.sub(
        r"(```+|~~~+)[\s\S]*?\1|(`+)([^`]*?)\2",
        lambda m: protected.append(m.group(0)) or f"@@VYASA_WIKI_{len(protected)-1}@@",
        content,
    )

    def repl(match):
        inner = match.group(1).strip()
        target, label = (inner.split("|", 1) + [None])[:2]
        parts = [part.strip() for part in target.split("#")]
        entry = _resolve_note(parts[0], current_path)
        if not entry:
            return match.group(0)
        fragment = _resolve_heading_fragment(entry, parts[1:]) if len(parts) > 1 else None
        href = content_url_for_slug(entry["route_slug"], fragment=fragment)
        return f"[{label or inner}]({href})"

    content = re.sub(r"\[\[([^\[\]\n]+)\]\]", repl, content)
    for i, chunk in enumerate(protected):
        content = content.replace(f"@@VYASA_WIKI_{i}@@", chunk)
    return content
