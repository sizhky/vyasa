from __future__ import annotations

import re
from .config import get_config

def _coerce_config_str(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    return str(value)

def _width_class_and_style(value, kind):
    if not value:
        return "", ""
    val = value.strip()
    lowered = val.lower()
    if lowered in ("default", "auto", "none"):
        return "", ""
    if kind == "max":
        if val.startswith("max-w-"):
            return val, ""
        if re.match(r'^\d+(\.\d+)?$', val):
            val = f"{val}px"
        return "", f"--layout-max-width: {val};"
    return "", ""

def _style_attr(style_value):
    if not style_value:
        return {}
    return {"style": style_value}

def _resolve_layout_config(current_path):
    config = get_config()
    return {
        "layout_max_width": _coerce_config_str(config.get("layout_max_width", "BLOGGY_LAYOUT_MAX_WIDTH", "75vw")),
    }
