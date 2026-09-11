import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from vyasa.extensions_builtin.mdx.astro import AstroMdxError, _result_from_output, astro_project_for, astro_source_fingerprint, render_astro_mdx_body
from vyasa.extensions_builtin.mdx.render import render_mdx_body


def test_astro_project_for_finds_nearest_config(tmp_path):
    project = tmp_path / "site"
    document = project / "src" / "content" / "guide.mdx"
    document.parent.mkdir(parents=True)
    document.write_text("# Guide\n", encoding="utf-8")
    (project / "astro.config.mjs").write_text("export default {};\n", encoding="utf-8")

    assert astro_project_for(document) == project


def test_render_astro_mdx_requires_project_config(tmp_path):
    document = tmp_path / "guide.mdx"
    document.write_text("# Guide\n", encoding="utf-8")

    with pytest.raises(AstroMdxError, match="astro.config"):
        render_astro_mdx_body(document)


def test_astro_source_fingerprint_includes_project_files_without_src(tmp_path):
    config = tmp_path / "astro.config.mjs"
    config.write_text("export default {};\n", encoding="utf-8")

    newest_mtime, count = astro_source_fingerprint(tmp_path)

    assert newest_mtime == config.stat().st_mtime_ns
    assert count == 1


def test_render_astro_mdx_runs_project_runner(monkeypatch, tmp_path):
    project = tmp_path / "site"
    document = project / "src" / "content" / "guide.mdx"
    document.parent.mkdir(parents=True)
    document.write_text("# Guide\n", encoding="utf-8")
    (project / "astro.config.mjs").write_text("export default {};\n", encoding="utf-8")
    captured = {}

    def run(*args, **kwargs):
        captured.update(kwargs)
        return SimpleNamespace(returncode=0, stdout=json.dumps({"html": "<svg>Diagram</svg>"}), stderr="")

    monkeypatch.setattr("vyasa.extensions_builtin.mdx.astro.subprocess.run", run)

    assert render_astro_mdx_body(document) == "<svg>Diagram</svg>"
    assert json.loads(captured["input"])["document"] == str(document)
    assert captured["cwd"] == project


def test_astro_runner_result_ignores_compiler_messages():
    output = "[astro] A compiler warning\n{\"html\": \"<p>Guide</p>\"}\n"

    assert _result_from_output(output) == {"html": "<p>Guide</p>"}


def test_astro_runner_imports_project_global_styles():
    runner = Path("vyasa/extensions_builtin/mdx/static/astro_render.mjs").read_text(encoding="utf-8")

    assert "src/styles/globals.css" in runner
    assert "globalStyleImport" in runner


def test_mdx_renderer_uses_astro_for_astro_imports(monkeypatch, tmp_path):
    document = tmp_path / "guide.mdx"
    document.write_text("import Diagram from './Diagram.astro'\n\n# Guide\n\n<Diagram />\n", encoding="utf-8")
    monkeypatch.setattr("vyasa.extensions_builtin.mdx.render.render_astro_mdx_body", lambda path: "<svg>Diagram</svg>")

    title, html, toc_source = render_mdx_body(document, "guide")

    assert title == "Guide"
    assert html == "<svg>Diagram</svg>"
    assert "<Diagram />" in toc_source


def test_mdx_renderer_escapes_astro_errors(monkeypatch, tmp_path):
    document = tmp_path / "guide.mdx"
    document.write_text("import Diagram from './Diagram.astro'\n\n# Guide\n", encoding="utf-8")
    monkeypatch.setattr(
        "vyasa.extensions_builtin.mdx.render.render_astro_mdx_body",
        lambda path: (_ for _ in ()).throw(AstroMdxError("<unsafe>")),
    )

    _, html, _ = render_mdx_body(document, "guide")

    assert "&lt;unsafe&gt;" in html
