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

from ...markdown_fence import escape_attr

SPEC_SUFFIXES = frozenset({".json", ".yaml", ".yml"})


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
