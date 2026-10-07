"""Material icon shortcodes, emoji shortcodes, and pymdownx.keys labels.

Implements vyasa manual/mkdocs-compatibility.md#icons-and-emoji. Icons load from
the same npm packages Material bundles, through jsDelivr, as CSS masks so they
take the surrounding text colour.
"""

from __future__ import annotations

import html
from functools import lru_cache

ICON_SETS = (
    ("material-", "https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/{name}.svg"),
    ("fontawesome-brands-", "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/brands/{name}.svg"),
    ("fontawesome-regular-", "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/regular/{name}.svg"),
    ("fontawesome-solid-", "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/svgs/solid/{name}.svg"),
    ("octicons-", "https://cdn.jsdelivr.net/npm/@primer/octicons@19.15.1/build/svg/{name}.svg"),
    ("simple-", "https://cdn.jsdelivr.net/npm/simple-icons@14.4.0/icons/{name}.svg"),
)

KEY_LABELS = {
    "ctrl": "Ctrl", "control": "Ctrl", "alt": "Alt", "option": "Option", "shift": "Shift", "cmd": "Cmd",
    "command": "Cmd", "meta": "Meta", "win": "Win", "windows": "Win", "super": "Super", "fn": "Fn",
    "enter": "Enter", "return": "Return", "tab": "Tab", "esc": "Esc", "escape": "Esc", "space": "Space",
    "spacebar": "Space", "backspace": "Backspace", "del": "Del", "delete": "Del", "insert": "Ins", "ins": "Ins",
    "home": "Home", "end": "End", "page-up": "Page Up", "pgup": "Page Up", "page-down": "Page Down",
    "pgdn": "Page Down", "arrow-up": "↑", "up": "↑", "arrow-down": "↓", "down": "↓", "arrow-left": "←",
    "left": "←", "arrow-right": "→", "right": "→", "caps-lock": "Caps Lock", "print-screen": "Print Screen",
}


def icon_url(shortcode: str) -> str | None:
    """CDN URL for a Material icon shortcode name.

    >>> icon_url("material-robot-outline")
    'https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/robot-outline.svg'
    >>> icon_url("octicons-heart-16")
    'https://cdn.jsdelivr.net/npm/@primer/octicons@19.15.1/build/svg/heart-16.svg'
    >>> icon_url("smile") is None
    True
    """
    for prefix, template in ICON_SETS:
        if shortcode.startswith(prefix) and len(shortcode) > len(prefix):
            return template.format(name=shortcode[len(prefix):])
    return None


def icon_html(shortcode: str, attrs: dict[str, str] | None = None) -> str | None:
    url = icon_url(shortcode)
    if url is None:
        return None
    attrs = dict(attrs or {})
    classes = " ".join(filter(None, ("twemoji vyasa-mkdocs-icon", attrs.pop("class", ""))))
    extra = "".join(f' {html.escape(k)}="{html.escape(v)}"' for k, v in attrs.items())
    return f'<span class="{classes}" style="--vyasa-mkdocs-icon: url(\'{url}\')" role="img" aria-label="{html.escape(shortcode)}"{extra}></span>'


@lru_cache(maxsize=1)
def _emoji_index() -> tuple[dict, dict]:
    try:
        from pymdownx import twemoji_db
    except ImportError:
        return {}, {}
    return twemoji_db.emoji, twemoji_db.aliases


def emoji_html(name: str) -> str | None:
    """Unicode emoji for a `:shortcode:`; None when pymdownx is absent or the name is unknown."""
    emoji, aliases = _emoji_index()
    key = f":{name}:"
    entry = emoji.get(aliases.get(key, key))
    if not entry:
        return None
    char = "".join(chr(int(code, 16)) for code in entry["unicode"].split("-"))
    return f'<span class="twemoji" title="{html.escape(key)}">{char}</span>'


def key_label(key: str) -> str:
    """Display label for one pymdownx.keys key.

    >>> key_label("ctrl"), key_label('"My Key"'), key_label("f5")
    ('Ctrl', 'My Key', 'F5')
    """
    if key[:1] in "\"'" and key[-1:] == key[:1]:
        return key[1:-1]
    return KEY_LABELS.get(key.lower(), key.upper() if len(key) <= 3 else key.replace("-", " ").title())
