from vyasa.theme_colors import normalize_theme_primary


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
