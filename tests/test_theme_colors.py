from vyasa.theme_colors import normalize_theme_primary
from vyasa.theme_extensions.base import load_theme_toml


def test_normalize_theme_primary_sets_constant_lightness_band():
    warm = normalize_theme_primary("#feb300")
    cool = normalize_theme_primary("#0053db")

    assert warm["theme_primary"].startswith("oklch(0.560 ")
    assert cool["theme_primary"].startswith("oklch(0.560 ")


def test_normalize_theme_primary_derives_dim_and_text_tokens():
    theme = normalize_theme_primary("#a1faff")

    assert theme["theme_primary_dim"].startswith("oklch(0.480 ")
    assert theme["theme_primary_text"] in {"#101718", "#f2f4f3"}
    assert theme["theme_dark_primary_text"] == theme["theme_primary_text"]


def test_normalize_theme_primary_picks_higher_contrast_text_for_muted_green():
    theme = normalize_theme_primary("#45655b")

    assert theme["theme_primary_text"] == "#f2f4f3"


def test_true_amoled_black_preserves_explicit_black_dark_surfaces():
    theme = load_theme_toml("true-amoled-black")

    assert theme["theme_dark_paper"] == "#000000"
    assert theme["theme_dark_paper_low"] == "#000000"
    assert theme["theme_dark_code_bg"] == "#000000"


def test_libertine_manuscript_uses_bundled_font_families():
    theme = load_theme_toml("libertine-manuscript")

    assert theme["theme_body_font"].startswith('"Linux Libertine O"')
    assert theme["theme_ui_font"].startswith('"Linux Biolinum O"')


def test_gentium_charter_uses_gentium_plus():
    theme = load_theme_toml("gentium-charter")

    assert theme["theme_body_font"].startswith('"Gentium Plus"')


def test_quattrocento_folio_uses_quattrocento():
    theme = load_theme_toml("quattrocento-folio")

    assert theme["theme_body_font"].startswith("Quattrocento")


def test_libertinus_register_uses_display_family_for_headings():
    theme = load_theme_toml("libertinus-register")

    assert theme["theme_heading_font"].startswith('"Libertinus Serif Display"')
