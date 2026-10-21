from __future__ import annotations

from pathlib import Path

from .base import (
    ThemeExtension,
    list_local_theme_files,
    resolve_theme_extension,
    theme_extension_meta,
    theme_extension_payloads,
    theme_from_toml,
)
from .dice import THEME as DICE_THEME
from .selector import SELECTOR, builtin_theme_registry

BUILTIN_THEME_EXTENSIONS = (SELECTOR, DICE_THEME)


def theme_registry(base_dir: Path | None = None) -> dict[str, ThemeExtension]:
    registry = builtin_theme_registry()
    registry[DICE_THEME.id] = DICE_THEME
    for theme_name in list_local_theme_files(base_dir):
        # A local theme lives in base_dir/.vyasa-themes, so its loader needs base_dir too.
        registry[theme_name] = theme_from_toml(theme_name, base_dir)
    return registry
