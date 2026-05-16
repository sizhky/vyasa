from __future__ import annotations

import random
import tomllib
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class ThemeExtension:
    id: str
    theme: dict[str, str] | None = None
    choices: tuple[str, ...] = ()
    randomizable: bool = False


def load_theme_toml(theme_name: str, base_dir: Path | None = None) -> dict[str, str]:
    name = str(theme_name or "").strip()
    if not name:
        return {}
    if base_dir:
        preset_file = base_dir / ".vyasa-themes" / f"{name}.toml"
        if preset_file.exists():
            with open(preset_file, "rb") as f:
                return tomllib.load(f)
    package_file = resources.files("vyasa.themes").joinpath(f"{name}.toml")
    if package_file.is_file():
        with package_file.open("rb") as f:
            return tomllib.load(f)
    return {}


def theme_from_toml(theme_name: str) -> ThemeExtension:
    return ThemeExtension(id=theme_name, theme=load_theme_toml(theme_name))


def resolve_theme_extension(theme_id: str, registry: dict[str, ThemeExtension], *, rng: random.Random | None = None, _seen: set[str] | None = None) -> tuple[dict[str, str], str]:
    if theme_id not in registry:
        return {}, ""
    seen = _seen or set()
    if theme_id in seen:
        return {}, ""
    seen.add(theme_id)
    entry = registry[theme_id]
    if entry.theme is not None:
        return dict(entry.theme), entry.id
    if entry.randomizable and entry.choices:
        return resolve_theme_extension((rng or random).choice(list(entry.choices)), registry, rng=rng, _seen=seen)
    if entry.choices:
        return resolve_theme_extension(entry.choices[0], registry, rng=rng, _seen=seen)
    return {}, ""


def theme_extension_payloads(registry: dict[str, ThemeExtension], *, rng: random.Random | None = None) -> dict[str, dict[str, str]]:
    return {theme_id: resolve_theme_extension(theme_id, registry, rng=rng)[0] for theme_id in registry}


def theme_extension_meta(registry: dict[str, ThemeExtension]) -> dict[str, dict]:
    return {theme_id: {"choices": list(entry.choices), "randomizable": entry.randomizable} for theme_id, entry in registry.items()}


def list_local_theme_files(base_dir: Path | None = None) -> Iterable[str]:
    if not base_dir:
        return ()
    theme_dir = base_dir / ".vyasa-themes"
    if not theme_dir.exists():
        return ()
    return sorted(path.stem for path in theme_dir.glob("*.toml"))


def list_theme_files() -> list[str]:
    return sorted(path.name[:-5] for path in resources.files("vyasa.themes").iterdir() if path.name.endswith(".toml"))
