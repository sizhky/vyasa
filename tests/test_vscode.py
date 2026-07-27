import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from vyasa.extensions import build_extension_runtime
from vyasa.extensions_builtin.vscode import is_local_request, open_in_vscode


def test_open_in_vscode_launches_resolved_code_file(tmp_path):
    code_file = tmp_path / "src" / "app.py"
    code_file.parent.mkdir()
    code_file.write_text("print('hello')\n", encoding="utf-8")
    calls = []

    opened = open_in_vscode(
        "src/app.py",
        resolve=lambda slug: code_file if slug == "src/app.py" else None,
        launch=lambda command, **options: calls.append((command, options)),
    )

    assert opened == code_file.resolve()
    assert calls[0][0] == ["code", "--goto", str(code_file.resolve())]
    assert calls[0][1]["start_new_session"] is True


@pytest.mark.parametrize("name", ["notes.md", "photo.png", "README"])
def test_open_in_vscode_rejects_non_code_files(tmp_path, name):
    file_path = tmp_path / name
    file_path.write_text("content", encoding="utf-8")

    with pytest.raises(ValueError, match="Unsupported code file"):
        open_in_vscode(name, resolve=lambda _slug: file_path, launch=lambda *_args, **_options: None)


def test_open_in_vscode_rejects_missing_file():
    with pytest.raises(FileNotFoundError):
        open_in_vscode("missing.py", resolve=lambda _slug: None, launch=lambda *_args, **_options: None)


@pytest.mark.parametrize(
    ("hostname", "client_host", "expected"),
    [
        ("localhost", "127.0.0.1", True),
        ("127.0.0.1", "::1", True),
        ("docs.example.com", "127.0.0.1", False),
        ("localhost", "10.0.0.8", False),
    ],
)
def test_vscode_opening_is_local_only(hostname, client_host, expected):
    request = SimpleNamespace(
        url=SimpleNamespace(hostname=hostname),
        client=SimpleNamespace(host=client_host),
    )

    assert is_local_request(request) is expected


def test_vscode_extension_is_runtime_only():
    runtime = build_extension_runtime({})
    providers = [
        provider
        for provider in runtime.page_asset_providers
        if provider.__module__.endswith(".vscode")
    ]

    assert runtime.enabled("vscode")
    static_dir = runtime.bundles["vscode.runtime"].static_dir
    assert static_dir is not None
    assert static_dir.is_dir()
    assert providers[0]({"mode": "runtime"}) == ("vscode.runtime",)
    assert providers[0]({"mode": "static"}) == ()


def test_vscode_link_detection():
    source = Path("vyasa/extensions_builtin/vscode/static/vscode.js").read_bytes()
    # Import through a data URL so Node treats the browser asset as an ES module.
    encoded = source.hex()
    script = f"""
        const source = Buffer.from('{encoded}', 'hex').toString();
        const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
        const base = 'http://localhost:8000/posts/guide';
        const suffixes = new Set(['.py', '.js']);
        if (module.codePathFromHref('/posts/src/app.py', base, suffixes) !== 'src/app.py') process.exit(1);
        if (module.codePathFromHref('/src/kitchen/models.py', base, suffixes) !== 'src/kitchen/models.py') process.exit(4);
        if (module.codePathFromHref('/posts/notes.md', base, suffixes) !== null) process.exit(2);
        if (module.codePathFromHref('https://example.com/app.py', base, suffixes) !== null) process.exit(3);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)
