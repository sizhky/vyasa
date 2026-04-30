from pathlib import Path

from vyasa.sidebar_helpers import get_custom_css_links


def test_custom_css_uses_active_mounted_content_root(tmp_path, monkeypatch):
    primary = tmp_path / "primary"
    mounted = tmp_path / "vyasa"
    pokemon = mounted / "demo" / "pokemon"
    primary.mkdir()
    pokemon.mkdir(parents=True)
    (pokemon / "global.css").write_text("#site-navbar::before { content: ''; }")
    (pokemon / "custom.css").write_text(".pokemon-art { float: right; }")

    monkeypatch.setenv("VYASA_ROOT", str(primary))
    monkeypatch.setenv("VYASA_ROOTS", str(mounted))

    from vyasa import config

    config.reload_config()

    nodes = get_custom_css_links(
        primary,
        current_path="vyasa/demo/pokemon/README",
        section_class="section-vyasa-demo-pokemon-readme",
    )
    rendered = "".join(str(node) for node in nodes)

    assert "/posts/vyasa/demo/pokemon/global.css" in rendered
    assert "#main-content.section-vyasa-demo-pokemon-readme .pokemon-art" in rendered
