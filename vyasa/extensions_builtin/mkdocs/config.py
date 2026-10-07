"""Read an `mkdocs.yml` and translate it into Vyasa configuration keys.

Implements vyasa manual/mkdocs-compatibility.md#configuration.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

MKDOCS_CONFIG_NAMES = ("mkdocs.yml", "mkdocs.yaml")

# Material's named palette colours (material/templates/assets/stylesheets/palette).
MATERIAL_COLORS = {
    "red": "#ef5552", "pink": "#e92063", "purple": "#ab47bd", "deep purple": "#7e56c2",
    "indigo": "#4051b5", "blue": "#2094f3", "light blue": "#02a6f2", "cyan": "#00bdd6",
    "teal": "#009485", "green": "#4cae4f", "light green": "#8bc34b", "lime": "#cbdc38",
    "yellow": "#ffec3d", "amber": "#ffc105", "orange": "#ffa724", "deep orange": "#ff6e42",
    "brown": "#795649", "grey": "#757575", "blue grey": "#546d78", "black": "#000000", "white": "#ffffff",
}


def find_mkdocs_config(folder: Path) -> Path | None:
    """First MkDocs config file in `folder`, or None.

    >>> find_mkdocs_config(Path("/nonexistent")) is None
    True
    """
    for name in MKDOCS_CONFIG_NAMES:
        candidate = Path(folder) / name
        if candidate.is_file():
            return candidate
    return None


def _yaml_loader():
    import yaml

    class Loader(yaml.SafeLoader):
        pass

    def python_tag(loader, suffix, node):
        # `!!python/name:pkg.fn` names a Python object MkDocs would import; keep the name.
        return f"!!python/{suffix}"

    def env_tag(loader, node):
        values = loader.construct_scalar(node) if isinstance(node, yaml.ScalarNode) else loader.construct_sequence(node)
        names = [values] if isinstance(values, str) else list(values)
        default = names.pop() if len(names) > 1 else None
        for name in names:
            if name in os.environ:
                return os.environ[name]
        return default

    def relative_tag(loader, node):
        return loader.construct_scalar(node) or ""

    Loader.add_multi_constructor("tag:yaml.org,2002:python/", python_tag)
    Loader.add_constructor("!ENV", env_tag)
    Loader.add_constructor("!relative", relative_tag)
    return Loader


def _deep_merge(parent: dict, child: dict) -> dict:
    """Merge like MkDocs INHERIT: nested dicts merge, every other value is replaced.

    >>> _deep_merge({"a": {"x": 1, "y": 2}, "l": [1]}, {"a": {"y": 3}, "l": [2]})
    {'a': {'x': 1, 'y': 3}, 'l': [2]}
    """
    merged = dict(parent)
    for key, value in child.items():
        merged[key] = _deep_merge(merged[key], value) if isinstance(value, dict) and isinstance(merged.get(key), dict) else value
    return merged


def load_mkdocs_yaml(path: Path) -> dict[str, Any]:
    import yaml

    path = Path(path)
    data = yaml.load(path.read_text(encoding="utf-8"), Loader=_yaml_loader()) or {}
    if not isinstance(data, dict):
        return {}
    inherit = data.pop("INHERIT", None)
    if inherit:
        parent_path = (path.parent / str(inherit)).resolve()
        if parent_path.is_file():
            data = _deep_merge(load_mkdocs_yaml(parent_path), data)
    return data


def markdown_extension_names(raw: Any) -> dict[str, dict]:
    """Normalise `markdown_extensions` into {name: options}.

    >>> markdown_extension_names(["toc", {"pymdownx.tabbed": {"alternate_style": True}}])
    {'toc': {}, 'pymdownx.tabbed': {'alternate_style': True}}
    >>> markdown_extension_names({"admonition": None})
    {'admonition': {}}
    """
    items = raw.items() if isinstance(raw, dict) else ((next(iter(i.items())) if isinstance(i, dict) else (i, {})) for i in raw or [])
    return {str(name): (options if isinstance(options, dict) else {}) for name, options in items}


def _theme(data: dict) -> dict:
    theme = data.get("theme") or {}
    return {"name": theme} if isinstance(theme, str) else dict(theme)


def _css_variable(css_paths: list[Path], name: str) -> str | None:
    pattern = re.compile(rf"{re.escape(name)}\s*:\s*([^;]+);")
    for css in css_paths:
        try:
            match = pattern.search(css.read_text(encoding="utf-8"))
        except OSError:
            continue
        if match:
            return match.group(1).strip()
    return None


def _palette(theme: dict) -> dict:
    palette = theme.get("palette") or {}
    if isinstance(palette, list):
        palette = palette[0] if palette and isinstance(palette[0], dict) else {}
    return palette if isinstance(palette, dict) else {}


def theme_primary(data: dict, docs_dir: Path) -> str | None:
    """Link colour: an `extra_css` override wins, then the palette colour.

    Material uses `--md-typeset-a-color` for links; black or white primaries
    colour the header, so the accent colour is the closer link colour then.
    """
    css_paths = [docs_dir / str(item) for item in data.get("extra_css") or [] if isinstance(item, str)]
    palette = _palette(_theme(data))
    primary = str(palette.get("primary") or "").strip().lower()
    accent = str(palette.get("accent") or "").strip().lower()
    for value in (
        _css_variable(css_paths, "--md-typeset-a-color"),
        None if primary in {"black", "white"} else (MATERIAL_COLORS.get(primary) if primary != "custom" else _css_variable(css_paths, "--md-primary-fg-color")),
        MATERIAL_COLORS.get(accent) if accent != "custom" else _css_variable(css_paths, "--md-accent-fg-color"),
        MATERIAL_COLORS.get(primary),
    ):
        if value and value.startswith("#") and value.lower() not in {"#000", "#000000", "#fff", "#ffffff"}:
            return value
    return None


def vyasa_config_from_mkdocs(path: Path) -> dict[str, Any]:
    """Vyasa config dict for an MkDocs project; raw MkDocs data sits under `mkdocs`."""
    path = Path(path).resolve()
    data = load_mkdocs_yaml(path)
    docs_dir = (path.parent / str(data.get("docs_dir") or "docs")).resolve()
    theme = _theme(data)
    font_value = theme.get("font")
    font: dict = font_value if isinstance(font_value, dict) else {}
    config: dict[str, Any] = {
        "root": str(docs_dir),
        "extensions": {"render_add": ["mkdocs"]},
        "mkdocs": {**data, "config_file": str(path), "docs_dir_path": str(docs_dir)},
    }
    if data.get("site_name"):
        config["title"] = str(data["site_name"])
    if font.get("text"):
        config["theme_body_font"] = f'"{font["text"]}", sans-serif'
        config["theme_heading_font"] = f'"{font["text"]}", sans-serif'
        config["theme_ui_font"] = f'"{font["text"]}", sans-serif'
    if font.get("code"):
        config["theme_mono_font"] = f'"{font["code"]}", monospace'
    primary = theme_primary(data, docs_dir)
    if primary:
        config["theme_primary"] = primary
    return config
