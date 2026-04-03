import html
import json
import re
from pathlib import Path

from fasthtml.common import to_xml

_TRUE_VALUES = {"1", "true", "yes", "on"}


class SlideDeckRenderer:
    def __init__(self, *, path, title, safe_title, slides, config, asset_url):
        self.path = path
        self.title = title
        self.safe_title = safe_title
        self.slides = slides
        self.config = config
        self.asset_url = asset_url

    @classmethod
    def from_markdown(cls, *, path, title, safe_title, metadata, raw_content, from_md, asset_url):
        return cls(
            path=path,
            title=title,
            safe_title=safe_title,
            slides=build_slide_entries(raw_content, path, from_md, sanitize=True) or [{"id": "slide-1", "index": 1, "title": "Empty deck", "html": "<h2>Empty deck</h2>"}],
            config=_normalize_slides_config(path, metadata),
            asset_url=asset_url,
        )

    def page_html(self):
        deck_class = f"vyasa-deck vyasa-theme-{html.escape(self.config['theme'])}"
        if self.config["deck_class"]:
            deck_class += f" {html.escape(self.config['deck_class'])}"
        return (
            "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            f"<title>{self.safe_title}</title><link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css\">"
            f"<link rel=\"stylesheet\" href=\"{self.asset_url('/static/present.css')}\">{self._css_links_html()}</head>"
            f"<body class=\"vyasa-present vyasa-single-slide\" data-theme=\"{html.escape(self.config['theme'])}\" style=\"{html.escape(self._root_vars_style())}\">"
            f"<header class=\"vyasa-present-header\"><h1 class=\"vyasa-deck-title\">{html.escape(str(self.title))}</h1>{self._hud_html()}</header>"
            f"<main class=\"vyasa-present-shell\" data-path=\"{html.escape(self.path)}\"><section class=\"{deck_class}\" data-theme=\"{html.escape(self.config['theme'])}\" style=\"{html.escape(self._deck_vars_style())}\">"
            f"<div class=\"vyasa-progress\"><div class=\"vyasa-progress__bar\"></div></div><div class=\"vyasa-deck-track\" style=\"--vyasa-slide-count:{len(self.slides)};\">{self._slides_markup()}</div>"
            f"</section></main><script src=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js\"></script><script src=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js\"></script>"
            f"<script type=\"module\" src=\"{self.asset_url('/static/scripts.js')}\"></script><script>window.__vyasaSlidesConfig = {json.dumps(self._runtime_config(), ensure_ascii=False)};</script><script type=\"module\" src=\"{self.asset_url('/static/present.js')}\"></script></body></html>"
        )

    def single_slide_html(self, slide_number):
        idx = max(1, min(len(self.slides), slide_number)) - 1
        slide = self.slides[idx]
        prev_href = f"/slides/{self.path}/slide-{idx}" if idx > 0 else ""
        next_href = f"/slides/{self.path}/slide-{idx + 2}" if idx + 1 < len(self.slides) else ""
        overview = "".join(
            f"<a class=\"vyasa-overview-card{' is-active' if i == idx else ''}\" href=\"/slides/{self.path}/slide-{i+1}\" data-slide-target=\"{i+1}\" tabindex=\"-1\"><span class=\"vyasa-overview-kicker\">Slide {i+1}</span><strong>{html.escape(slide_item['title'])}</strong><span class=\"vyasa-overview-preview\"><span class=\"vyasa-overview-mini\"><span class=\"vyasa-overview-mini__scale\">{slide_item['html']}</span></span></span></a>"
            for i, slide_item in enumerate(self.slides)
        )
        nav = (
            f"<div class=\"vyasa-present-hud\">"
            f"{f'<a class=\"vyasa-hud-button\" data-nav=\"prev\" href=\"{prev_href}\">&larr;</a>' if prev_href else ''}"
            f"{f'<a class=\"vyasa-hud-button\" data-nav=\"next\" href=\"{next_href}\">&rarr;</a>' if next_href else ''}"
            f"<button type=\"button\" class=\"vyasa-slide__count\" data-action=\"overview-toggle\">{idx + 1} / {len(self.slides)}</button></div>"
        )
        return (
            "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            f"<title>{self.safe_title}</title><link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css\">"
            f"<link rel=\"stylesheet\" href=\"{self.asset_url('/static/present.css')}\">{self._css_links_html()}</head>"
            f"<body class=\"vyasa-present\" data-theme=\"{html.escape(self.config['theme'])}\" style=\"{html.escape(self._root_vars_style())}\">"
            f"<header class=\"vyasa-present-header\"><h1 class=\"vyasa-deck-title\">{html.escape(str(self.title))}</h1>{nav}</header>"
            f"<main class=\"vyasa-present-shell\"><section class=\"vyasa-deck\" style=\"{html.escape(self._deck_vars_style())}\"><section class=\"vyasa-slide is-active\" id=\"{slide['id']}\"><div class=\"vyasa-slide-viewport\"><article class=\"vyasa-slide-frame\">{slide['html']}</article></div></section></section></main><aside class=\"vyasa-overview\" hidden><div class=\"vyasa-overview-grid\">{overview}</div></aside>"
            f"<script src=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js\"></script><script src=\"https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js\"></script><script type=\"module\" src=\"{self.asset_url('/static/scripts.js')}\"></script><script type=\"module\" src=\"{self.asset_url('/static/present-single.js')}\"></script><script>if(typeof renderMathInElement==='function')renderMathInElement(document.body,{{delimiters:[{{left:'$$',right:'$$',display:true}},{{left:'$',right:'$',display:false}},{{left:'\\\\[',right:'\\\\]',display:true}},{{left:'\\\\(',right:'\\\\)',display:false}}],throwOnError:false}});window.dispatchEvent(new Event('resize'));</script></body></html>"
        )

    def _slides_markup(self):
        return "".join(f"<section class=\"slide vyasa-slide\" id=\"{s['id']}\" data-slide-id=\"{s['id']}\" data-slide-index=\"{s['index']}\" data-slide-title=\"{html.escape(s['title'])}\"><div class=\"slide-viewport vyasa-slide-viewport\"><article class=\"slide-frame vyasa-slide-frame\">{s['html']}</article></div></section>" for s in self.slides)

    def _hud_html(self):
        return "<div class=\"vyasa-present-hud\"><button type=\"button\" class=\"vyasa-hud-button\" data-action=\"prev\" aria-label=\"Previous slide\">&larr;</button><button type=\"button\" class=\"vyasa-hud-button\" data-action=\"next\" aria-label=\"Next slide\">&rarr;</button><button type=\"button\" class=\"vyasa-hud-button\" data-action=\"overview\" aria-label=\"Toggle overview\">Overview</button><button type=\"button\" class=\"vyasa-hud-button\" data-action=\"fullscreen\" aria-label=\"Toggle fullscreen\">Fullscreen</button><div class=\"vyasa-slide__count\" aria-live=\"polite\"></div></div>"

    def _css_links_html(self):
        return "".join(f'<link rel="stylesheet" href="{html.escape(href)}">' for href in self.config["css_links"])

    def _deck_vars_style(self):
        return ";".join(f"--{k}:{v}" for k, v in self.config["deck_vars"].items())

    def _root_vars_style(self):
        return f"--vyasa-slide-padding:{self.config['slide_padding']};--vyasa-slide-font-size:{self.config['font_size']}"

    def _runtime_config(self):
        return {"slideCount": len(self.slides), "numbers": self.config["numbers"], "progress": self.config["progress"], "overview": self.config["overview"], "allowOverflow": self.config["allow_overflow"]}


def _normalize_slides_config(path, metadata):
    slides_block = metadata.get("slides_config", {}) if isinstance(metadata.get("slides_config"), dict) else {}
    reveal_block = metadata.get("reveal", {}) if isinstance(metadata.get("reveal"), dict) else {}

    def pick(name, default=None, legacy=None):
        if name in slides_block:
            return slides_block[name]
        if f"slides_{name}" in metadata:
            return metadata[f"slides_{name}"]
        legacy = legacy or name
        if f"reveal_{legacy}" in metadata:
            return metadata[f"reveal_{legacy}"]
        return reveal_block.get(legacy, default)

    theme = str(pick("theme", "default")).strip() or "default"
    theme = "paper" if theme in {"white", "beige", "simple"} else "contrast" if theme == "black" else theme
    font_size = str(pick("fontSize", "18px", legacy="fontSize")).strip() or "18px"
    font_size = font_size if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?(?:px|rem|em|vw|vh|%)", font_size) else "18px"
    allow_overflow = str(pick("allowOverflow", "auto")).strip().lower() or "auto"
    if allow_overflow not in {"auto", "always", "never"}:
        allow_overflow = "auto"
    return {"theme": theme, "font_size": font_size, "slide_padding": str(pick("slidePadding", "1.5rem", legacy="slidePadding")).strip() or "1.5rem", "progress": _coerce_bool(pick("progress", True), True), "numbers": _coerce_bool(pick("numbers", pick("slideNumber", True, legacy="slideNumber")), True), "overview": _coerce_bool(pick("overview", True), True), "allow_overflow": allow_overflow, "deck_class": str(pick("class", "")).strip(), "deck_vars": _normalize_deck_vars(pick("vars", {}, legacy="vars")), "css_links": _resolve_css_links(path, pick("css", [], legacy="css"))}


def _coerce_bool(value, default):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in _TRUE_VALUES


def _normalize_deck_vars(deck_vars):
    return {str(k).strip(): str(v).strip() for k, v in (deck_vars.items() if isinstance(deck_vars, dict) else []) if str(k).strip() and str(v).strip()}


def _resolve_css_links(path, slides_css):
    slides_css = [slides_css] if isinstance(slides_css, str) else slides_css if isinstance(slides_css, list) else []
    base = Path(path).parent
    return [raw if raw.startswith(("http://", "https://", "/")) else f"/posts/{(base / raw).as_posix()}" for raw in [str(item).strip() for item in slides_css] if raw]


def build_slide_entries(raw_content, path, from_md, *, sanitize):
    return [{"id": f"slide-{i}", "index": i, "title": _extract_slide_title(fragment, i), "html": _render_slide_fragment(fragment, path, from_md, sanitize=sanitize)} for i, fragment in enumerate(_split_slide_blocks(raw_content), start=1)]


def _split_slide_blocks(md_text):
    groups, group, buf, in_fence, fence_char, fence_len = [], [], [], False, "", 0
    for line in md_text.splitlines():
        stripped = line.strip()
        fence = re.match(r"^(```+|~~~+)", stripped)
        if fence:
            token = fence.group(1)
            if not in_fence:
                in_fence, fence_char, fence_len = True, token[0], len(token)
            elif token[0] == fence_char and len(token) >= fence_len:
                in_fence = False
        if not in_fence and stripped == "---":
            group.append("\n".join(buf).strip()); groups.append([item for item in group if item.strip()]); group, buf = [], []; continue
        if not in_fence and stripped == "--":
            group.append("\n".join(buf).strip()); buf = []; continue
        buf.append(line)
    group.append("\n".join(buf).strip()); groups.append([item for item in group if item.strip()])
    return [item for group in groups if group for item in group]


def _render_slide_fragment(md_fragment, path, from_md, *, sanitize):
    rendered = re.sub(r"<link[^>]*sidenote\\.css[^>]*>", "", to_xml(from_md(md_fragment, current_path=path)), count=1)
    if sanitize:
        for pattern in [r"<button[^>]*>.*?Toggle child sections.*?</button>", r"<a[^>]*>.*?URL copied.*?</a>", r"<button[^>]*>.*?Copy code.*?</button>", r"<div[^>]*id=\"[^\"]*-toast\"[^>]*>.*?</div>"]:
            rendered = re.sub(pattern, "", rendered, flags=re.IGNORECASE | re.DOTALL)
    return rendered


def _extract_slide_title(md_fragment, index):
    match = re.search(r"^\s*#{1,6}\s+(.+?)\s*$", md_fragment or "", flags=re.MULTILINE)
    if not match:
        return f"Slide {index}"
    title = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", match.group(1))
    title = re.sub(r"`([^`]+)`", r"\1", title)
    return re.sub(r"\s+", " ", title).strip() or f"Slide {index}"
