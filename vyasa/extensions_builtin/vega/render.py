"""Render a Vega-Lite spec block.

The spec is data, not markup: it is parsed here to fail loudly on a typo, then
handed to the browser inside a JSON script tag. Nothing about the spec is
interpolated into HTML, so a spec cannot inject markup.

Pro: the full Vega-Lite grammar is available for charts the visuals registry
cannot express — layered, faceted, or bound to a live data URL.
Con: it needs a browser and a CDN module, so it renders nothing in a plain
markdown reader. Reach for `bar` or `stack` first.
"""

from __future__ import annotations

import json
import re
from typing import Any, Mapping

from pathlib import Path

from ...markdown_fence import escape_attr, parse_fence_attrs

SPEC_SUFFIXES = frozenset({".json", ".yaml", ".yml"})
CODE_SUFFIXES = frozenset({".py"})

# Where captured `altair-data` blocks live inside the render's shared state.
DATA_BLOCKS = "vega.altair_data"

DATA_FENCE = re.compile(
    r"^(?P<indent> {0,3})(?P<ticks>`{3,})[ \t]*(?P<info>altair-data[^\n]*)\n(?P<body>.*?)\n?^\1(?P=ticks)[ \t]*$",
    re.DOTALL | re.MULTILINE,
)


CSS_LENGTH = re.compile(r"^\d{1,5}(?:\.\d{1,3})?(?:px|%|vw|vh|vmin|vmax|rem|em|ch)?$")


def css_length(value: object) -> str:
    """Accept a CSS length for `width=` / `height=`, or nothing at all.

    A bare number means pixels, so `height=220` keeps working. Anything that is
    not a plain number with a known unit is dropped rather than escaped: this
    string lands in a style attribute, and a permissive filter there is a CSS
    injection.

    >>> css_length("55vw")
    '55vw'
    >>> css_length(220)
    '220px'
    >>> css_length("red; background:url(x)")
    ''
    >>> css_length(None)
    ''
    """
    text = str(value or "").strip()
    if not CSS_LENGTH.match(text):
        return ""
    return f"{text}px" if text.replace(".", "", 1).isdigit() else text


def _error(message: str) -> str:
    return (
        '<figure class="vyasa-visual vyasa-visual--error">'
        '<figcaption class="vyasa-visual__title">vega block</figcaption>'
        f'<div class="vyasa-visual__error">{escape_attr(message)}</div>'
        "</figure>"
    )


def load_spec(code: str, attrs: Mapping[str, Any], current_path: object) -> dict:
    """Read the spec from the fence body, or from `src=` when given.

    >>> load_spec('{"mark": "bar"}', {}, None)["mark"]
    'bar'
    """
    if attrs.get("src"):
        from ...markdown_fence import resolve_fence_data_path

        path = resolve_fence_data_path(str(attrs["src"]), current_path, SPEC_SUFFIXES)
        text = path.read_text(encoding="utf-8")
        if path.suffix != ".json":
            import yaml

            return yaml.safe_load(text)
        return json.loads(text)
    body = (code or "").strip()
    if not body:
        raise ValueError("empty spec")
    return json.loads(body)


def render_vega_block(code: str, attrs: Mapping[str, Any], current_path: object) -> str:
    try:
        spec = load_spec(code, attrs, current_path)
    except ValueError as error:  # JSONDecodeError subclasses ValueError
        return _error(f"{type(error).__name__}: {error}")
    except Exception as error:
        return _error(f"{type(error).__name__}: {error}")
    return render_spec(spec, attrs)


def collect_data_blocks(content: str, context: object, state: dict) -> str:
    r"""Capture every `altair-data` block before any fence renders.

    Running as a preprocessor buys two things a fence handler cannot: an
    `altair` block may sit above the data it uses, and each render starts from
    an empty capture, so a block the author deleted cannot linger.

    A block marked `hide` is removed here. One left visible stays in the
    document and renders as Python source through the fence handler.

    >>> state = {}
    >>> md = "```altair-data id=curve hide\nrows = []\n```\ntext\n"
    >>> collect_data_blocks(md, None, state).strip()
    'text'
    >>> state["vega.altair_data"]
    {'curve': 'rows = []'}
    """
    blocks: dict[str, str] = {}

    def capture(match: re.Match) -> str:
        _, attrs = parse_fence_attrs(match.group("info"))
        name = str(attrs.get("id") or "").strip()
        if name:
            blocks[name] = match.group("body")
        return "" if attrs.get("hide") else match.group(0)

    rewritten = DATA_FENCE.sub(capture, content)
    if blocks:
        state[DATA_BLOCKS] = blocks
    return rewritten


def render_altair_data_block(code: str, attrs: Mapping[str, Any], current_path: object) -> str:
    """Render a visible `altair-data` block as the Python source it is.

    The chart it feeds is drawn by the `altair` block that names it, so this
    only has to show the derivation. A `hide` block never reaches here: the
    preprocessor already removed it from the document.
    """
    from ..markdown.renderer import render_code_shell

    return render_code_shell(
        (code or "").rstrip(),
        "python",
        start=1,
        title=str(attrs.get("title") or ""),
    )


def load_code(code: str, attrs: Mapping[str, Any], current_path: object, state: object = None) -> str:
    r"""Read the fence body, with the `src=` code placed in front of it.

    `src=` keeps its meaning from the `vega` fence -- the chart's source lives
    there -- and the suffix says where "there" is. `src=recency.py` is a file
    beside the document; `src=recency` is an `altair-data` block in it. Either
    way the shared code runs first, in the same sandbox, under the same guard
    as the body, so two charts state one derivation once.

    >>> load_code("alt.Chart(rows)", {}, None)
    'alt.Chart(rows)'
    >>> load_code("curve", {"src": "d"}, None, {DATA_BLOCKS: {"d": "curve = 1"}})
    'curve = 1\ncurve'
    >>> load_code("curve", {"src": "d"}, None, {})
    Traceback (most recent call last):
    ...
    ValueError: no altair-data block named 'd'
    """
    body = (code or "").strip()
    src = str(attrs.get("src") or "").strip()
    if not src:
        if not body:
            raise ValueError("empty altair block")
        return body
    if Path(src).suffix:
        from ...markdown_fence import resolve_fence_data_path

        path = resolve_fence_data_path(src, current_path, CODE_SUFFIXES)
        shared = path.read_text(encoding="utf-8").strip()
    else:
        blocks = (state or {}).get(DATA_BLOCKS) or {}
        if src not in blocks:
            raise ValueError(f"no altair-data block named {src!r}")
        shared = blocks[src].strip()
    return f"{shared}\n{body}" if body else shared


def render_altair_block(code: str, attrs: Mapping[str, Any], current_path: object, state: object = None) -> str:
    """Render an Altair fence: Python in, the same Vega-Lite figure out.

    A spec the author can derive should stay derived, so this fence takes the
    code rather than the numbers it would produce. `chart.to_dict()` is already
    a Vega-Lite spec, so the browser side is shared with `vega` unchanged.
    """
    try:
        from .altair_run import altair_spec
    except ImportError as error:
        return _error(f"altair blocks need the extra: pip install 'vyasa[altair]' ({error})")
    try:
        spec = altair_spec(load_code(code, attrs, current_path, state))
    except Exception as error:
        return _error(f"{type(error).__name__}: {error}")
    return render_spec(spec, attrs)


def render_spec(spec: object, attrs: Mapping[str, Any]) -> str:
    """Emit the figure both fences share, so one theme serves both."""
    if not isinstance(spec, dict):
        return _error("spec must be an object")
    # `</` cannot appear inside a JSON script tag or it closes the tag early.
    payload = json.dumps(spec, separators=(",", ":")).replace("</", "<\\/")
    title = escape_attr(str(attrs.get("title") or ""))
    caption = f'<figcaption class="vyasa-visual__title">{title}</figcaption>' if title else ""
    actions = "true" if attrs.get("actions") else "false"
    declared = [
        f"min-height:{css_length(attrs.get('height'))}" if css_length(attrs.get("height")) else "",
        f"width:{css_length(attrs.get('width'))}" if css_length(attrs.get("width")) else "",
    ]
    rules = ";".join(rule for rule in declared if rule)
    style = f' style="{rules}"' if rules else ""
    return (
        '<figure class="vyasa-visual vyasa-visual--vega">'
        f"{caption}"
        f'<div class="vyasa-vega" data-vyasa-vega data-actions="{actions}"{style}>'
        f'<script type="application/json" class="vyasa-vega__spec">{payload}</script>'
        '<div class="vyasa-vega__mount"></div>'
        "</div></figure>"
    )
