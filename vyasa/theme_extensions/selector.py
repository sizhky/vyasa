from __future__ import annotations

from .base import ThemeExtension, list_theme_files, theme_from_toml

SELECTOR = ThemeExtension(id="theme-selector")


def builtin_theme_registry() -> dict[str, ThemeExtension]:
    return {theme_name: theme_from_toml(theme_name) for theme_name in list_theme_files()}
