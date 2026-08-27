import json
import subprocess
from hashlib import sha256
from pathlib import Path

import pytest

from vyasa.extensions_builtin.link_preview import code_reference_render, routes
from vyasa.extensions_builtin.link_preview.code_reference import (
    CodeReference,
    CodeReferenceError,
    SourceRange,
    focus_ranges,
    resolve_code_reference,
)
from vyasa.extensions_builtin.link_preview.code_reference_markdown import (
    parse_code_reference_json,
)


def test_code_reference_normalizes_defaults():
    reference = CodeReference.parse(
        {
            "change": "dc4967f",
            "show": "symbol",
            "symbol": "HomeFeedScreen",
            "kind": "Function",
            "focus": "changed",
        }
    )

    assert reference.context == 3
    assert reference.view == "source"
    assert reference.side == "after"
    assert reference.role == "implementation"
    assert reference.follow_renames is True


def test_code_reference_rejects_missing_paired_attribute():
    with pytest.raises(CodeReferenceError) as caught:
        CodeReference.parse({"show": "symbol", "focus": "all"})

    assert caught.value.code == "missing_attribute"


def test_code_reference_selects_disjoint_changed_blocks_inside_tsx_symbol(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "t"], check=True)
    source = repo / "HomeFeedScreen.tsx"
    source.write_text(
        "export const HomeFeedScreen = () => {\n"
        "  const visible = true;\n"
        "  const render = () => visible;\n"
        "  return render();\n"
        "};\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
    source.write_text(
        "export const HomeFeedScreen = () => {\n"
        "  const visible = true;\n"
        "  reportVisible(\"post-1\");\n"
        "  const render = () => visible;\n"
        "  flushNow();\n"
        "  return render();\n"
        "};\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "tracking"], check=True)
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True
    ).stdout.strip()

    resolved = resolve_code_reference(
        source,
        CodeReference.parse(
            {
                "change": commit[:8],
                "show": "symbol",
                "symbol": "HomeFeedScreen",
                "kind": "Function",
                "focus": "changed",
                "context": "0",
            }
        ),
    )

    assert resolved.selected == SourceRange(1, 7)
    assert resolved.focused == (SourceRange(3, 3), SourceRange(5, 5))
    assert resolved.blocks == (SourceRange(3, 3), SourceRange(5, 5))


def test_link_preview_renders_code_reference_metadata(tmp_path, monkeypatch):
    source = tmp_path / "sample.py"
    source.write_text("def run():\n    return True\n", encoding="utf-8")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.py")

    result = routes.render_link_preview_html(
        href="sample.py",
        code_ref=json.dumps({"show": "file", "focus": "all", "role": "test"}),
    )

    assert result is not None
    assert 'data-code-reference-role="test"' in result
    assert 'data-code-highlight-lines="1-2"' in result


def test_link_preview_renders_disjoint_changed_blocks_for_symbol(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "t"], check=True)
    source = repo / "HomeFeedScreen.tsx"
    source.write_text(
        "export const HomeFeedScreen = () => {\n"
        "  const visible = true;\n"
        "  const render = () => visible;\n"
        "  return render();\n"
        "};\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
    source.write_text(
        "export const HomeFeedScreen = () => {\n"
        "  const visible = true;\n"
        "  reportVisible(\"post-1\");\n"
        "  const render = () => visible;\n"
        "  flushNow();\n"
        "  return render();\n"
        "};\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "tracking"], check=True)
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True
    ).stdout.strip()
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "HomeFeedScreen.tsx")

    result = routes.render_link_preview_html(
        href="HomeFeedScreen.tsx",
        code_ref=json.dumps(
            {
                "change": commit,
                "show": "symbol",
                "symbol": "HomeFeedScreen",
                "kind": "Function",
                "focus": "changed",
                "context": "0",
            }
        ),
    )

    assert result is not None
    # One continuous block covers the whole symbol, so line 4 stays readable
    # between the two changed lines instead of hiding behind an omission row.
    assert result.count("<code") == 1
    assert 'data-code-highlight-lines="3-3,5-5"' in result
    assert 'data-code-source-start="1"' in result
    assert 'data-code-reference-blocks="3-3,5-5"' in result
    assert "data-code-omitted-start" not in result
    assert "data-code-reference-previous" in result
    assert "data-code-reference-next" in result

    diff = routes.render_link_preview_html(
        href="HomeFeedScreen.tsx",
        code_ref=json.dumps({"change": commit, "show": "file", "focus": "changed", "view": "diff"}),
    )
    split = routes.render_link_preview_html(
        href="HomeFeedScreen.tsx",
        code_ref=json.dumps(
            {"change": commit, "show": "file", "focus": "changed", "view": "split", "side": "both"}
        ),
    )

    assert diff is not None and 'vyasa-code-reference-diff' in diff
    assert "+  reportVisible" in diff
    assert split is not None and 'vyasa-code-reference-split' in split
    assert "Before" in split and "After" in split


def test_code_reference_resolves_pinned_manual_range_and_region(tmp_path):
    source = tmp_path / "feed.ts"
    source.write_text(
        "// region: feed-tracking\n"
        "const first = true;\n"
        "const second = true;\n"
        "// endregion\n",
        encoding="utf-8",
    )
    normalized = "const first = true;\nconst second = true;\n"
    pin = sha256(normalized.encode("utf-8")).hexdigest()[:8]

    manual = resolve_code_reference(
        source,
        CodeReference.parse(
                {"show": "lines", "lines": "2:3", "focus": "ln[2:3]", "pin": pin}
        ),
    )
    region = resolve_code_reference(
        source,
        CodeReference.parse({"show": "region", "region": "feed-tracking", "focus": "all"}),
    )

    assert manual.focused == (SourceRange(2, 3),)
    assert region.selected == SourceRange(2, 3)


def test_code_reference_resolves_worktree_changes(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "t"], check=True)
    source = repo / "feed.py"
    source.write_text("value = 1\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
    source.write_text("value = 2\n", encoding="utf-8")

    resolved = resolve_code_reference(
        source,
        CodeReference.parse({"change": "worktree", "show": "file", "focus": "changed"}),
    )

    assert resolved.base_ref
    assert resolved.head_ref == "worktree"
    assert resolved.focused == (SourceRange(1, 1),)


def test_code_reference_follows_rename_without_false_changed_lines(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "t"], check=True)
    old = repo / "old.ts"
    old.write_text("export const value = 1;\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
    new = repo / "new.ts"
    old.rename(new)
    subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "rename"], check=True)
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True
    ).stdout.strip()

    resolved = resolve_code_reference(
        new,
        CodeReference.parse({"change": commit, "show": "file", "focus": "changed"}),
    )

    assert resolved.focused == ()


def test_link_preview_shadow_is_on_unclipped_outer_popup():
    css = Path("vyasa/extensions_builtin/link_preview/static/link_preview.css").read_text()
    source = Path("vyasa/extensions_builtin/link_preview/static/link_preview.js").read_text()
    popup_rule = css.split(".vyasa-link-preview-popover.is-open", 1)[1].split("}", 1)[0]
    card_rule = css.split(".vyasa-link-preview-card {", 1)[1].split("}", 1)[0]
    pointer_rule = css.split(".vyasa-link-preview-pointer path {", 1)[1].split("}", 1)[0]

    assert "width: max(560px, 46vw);" in css
    assert "box-shadow:" in popup_rule
    assert "drop-shadow(" in pointer_rule
    assert "box-shadow:" not in card_rule
    assert "cursor: ns-resize;" in css
    assert "cursor: ew-resize;" in css
    assert "cursor: nwse-resize;" in css
    assert "cursor: nesw-resize;" in css
    assert "event.target?.id !== 'main-content'" in source
    assert "previews.closeAll();" in source
    assert "(normalFontPx || 18) * 0.75 - 2" in source
    assert "data-vyasa-link-preview-font-decrease" in source
    assert "data-vyasa-link-preview-font-increase" in source
    assert "data-vyasa-link-preview-wrap" in source
    assert "pre.classList.toggle('vyasa-code-wrap', wordWrap)" in source
    assert "localStorage.getItem(WORD_WRAP_KEY) === '1'" in source
    assert "localStorage.setItem(WORD_WRAP_KEY, wordWrap ? '1' : '0')" in source
    assert 'button[aria-pressed="true"]' in css
    assert ".vyasa-link-preview-plain-text.vyasa-code-wrap" in css
    assert ".vyasa-link-preview-body > .code-block:only-child pre.vyasa-code-wrap { width: 100%;" in css
    assert "event.shiftKey ? shell?.dataset.absolutePath : shell?.dataset.relativePath" in source
    assert "sourceLabel.title = relativePath;" in source
    assert "sourceLabel.href = link.getAttribute('href')" in source
    assert "event.target.closest('button,a')" in source
    assert "cursor: pointer;" in css.split("[data-vyasa-link-preview-origin]", 1)[1].split("}", 1)[0]
    assert "flex: 0 1 auto;" in css
    assert "margin-left: auto;" in css
    assert "overflow-wrap: anywhere;" in css
    assert "white-space: normal;" in css
    assert "width: max-content;" in css.split(".vyasa-link-preview-body > .code-block:only-child pre", 1)[1].split("}", 1)[0]
    assert "overflow: visible;" in css.split(".vyasa-link-preview-body > .code-block:only-child pre", 1)[1].split("}", 1)[0]
    assert "--vyasa-link-preview-font-size" in css
    assert "font-size: 1.75em;" in css
    assert "width: max-content;" in css
    assert ".vyasa-link-preview-body .vyasa-doc-h2 { font-size: 1.5em; }" in css
    assert ".vyasa-link-preview-body .vyasa-doc-h6 { font-size: 1em; }" in css
    assert ".vyasa-link-preview-target-line" in css


def test_link_preview_pointer_joins_source_to_nearest_popup_edge():
    script = """
        import { linkPreviewPointerPoints } from './vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js';
        const points = linkPreviewPointerPoints(
            { left: 0, top: 100, width: 100, height: 20 },
            { left: 200, top: 50, width: 100, height: 100 },
        );
        const [tip, baseA, baseB] = points;
        if (tip[0] !== 50 || tip[1] !== 110) throw new Error(`wrong source tip: ${tip}`);
        const baseCenterX = (baseA[0] + baseB[0]) / 2;
        if (Math.abs(baseCenterX - 200) > 0.001) throw new Error(`pointer missed popup edge`);
        const baseWidth = Math.hypot(baseA[0] - baseB[0], baseA[1] - baseB[1]);
        if (Math.abs(baseWidth - 28) > 0.001) throw new Error(`pointer base is not 28px wide`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_link_preview_pointer_fill_overlaps_border_but_outline_stops_at_edge():
    script = """
        import { linkPreviewPointerGeometry } from './vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js';
        const geometry = linkPreviewPointerGeometry(
            { left: 0, top: 0, width: 100, height: 20 },
            { left: 200, top: 50, width: 100, height: 100 },
        );
        if (geometry.outline[1][0] !== 200 || geometry.outline[2][0] !== 200) {
            throw new Error(`outline does not stop at popup edge: ${geometry.outline}`);
        }
        if (geometry.fill[1][0] !== 202 || geometry.fill[2][0] !== 202) {
            throw new Error(`fill does not cover popup border: ${geometry.fill}`);
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_link_preview_refreshes_pointer_during_canvas_pan():
    script = """
        import { installLinkPreviewPanTracking } from './vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js';
        const target = new EventTarget();
        let refreshes = 0;
        installLinkPreviewPanTracking(target, () => { refreshes += 1; });
        target.dispatchEvent(new Event('pointermove'));
        target.dispatchEvent(new Event('wheel'));
        if (refreshes !== 2) throw new Error(`expected two pan refreshes, got ${refreshes}`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_link_preview_finds_symbol_position_from_link_query():
    source = Path("vyasa/extensions_builtin/link_preview/static/link_preview.js").read_text()
    script = """
        import { linkPreviewCodeLineHref, linkPreviewHashMatch, linkPreviewLineMatch, linkPreviewLineNumber, linkPreviewSymbolMatch } from './vyasa/extensions_builtin/link_preview/static/link_preview_target.js';
        if (linkPreviewCodeLineHref('src/my file.py', 7) !== '/posts/src/my%20file.py%3A7') {
            throw new Error('VS Code line link lost');
        }
        if (linkPreviewLineNumber('/posts/code.py%3A3') !== 3) throw new Error('line number lost');
        const line = linkPreviewLineMatch(
            '/posts/genhrx.ai/apps/ai/app/api/routes/agent_runtime.py%3A3',
            ['first\\nsecond\\nthird\\nfourth'],
        );
        if (line?.chunkIndex !== 0 || line?.lineStart !== 13 || line?.lineEnd !== 18) {
            throw new Error(`line match lost: ${JSON.stringify(line)}`);
        }
        const python = 'Flow: _POLICY_MAP selects a policy.\\n\\n_POLICY_MAP: dict[str, str] = {';
        const variable = linkPreviewSymbolMatch(
            '/posts/agent_runtime.py?symbol=_POLICY_MAP&kind=Variable',
            [python],
        );
        if (variable?.lineStart !== python.indexOf('_POLICY_MAP:')) {
            throw new Error(`variable definition lost: ${JSON.stringify(variable)}`);
        }
        const renderedVariable = linkPreviewSymbolMatch(
            '/posts/agent_runtime.py?symbol=_POLICY_MAP&kind=Variable',
            ['Flow: _POLICY_MAP selects a policy.', '_POLICY_MAP: dict[str, str] = {'],
        );
        if (renderedVariable?.chunkIndex !== 1) throw new Error('rendered variable definition lost');
        const pythonProperty = linkPreviewSymbolMatch(
            '/posts/content_enrichment_agent.py?symbol=llm_quality_score&kind=Property',
            ['llm_quality_score — 1–5 integer', 'llm_quality_score: int = Field('],
        );
        if (pythonProperty?.chunkIndex !== 1) throw new Error('Python property definition lost');
        const match = linkPreviewSymbolMatch(
            '/posts/src/kitchen/story.md?symbol=story&kind=File',
            ['Introduction', 'The Supply Chain Planner\\'s Story'],
        );
        if (match?.chunkIndex !== 1 || match?.start !== 27 || match?.kind !== 'File') {
            throw new Error(`wrong symbol match: ${JSON.stringify(match)}`);
        }
        const exact = linkPreviewSymbolMatch(
            '/posts/code.py?symbol=run&kind=Function',
            ['runner', 'function run()'],
        );
        if (exact?.chunkIndex !== 1 || exact?.start !== 9) {
            throw new Error(`exact symbol match lost: ${JSON.stringify(exact)}`);
        }
        const code = linkPreviewSymbolMatch(
            '/posts/code.py?symbol=run&kind=Function',
            ['value = 1\\nfunction run(arg) {\\n  return arg;\\n}'],
        );
        if (code?.lineStart !== 10 || code?.lineEnd !== 29) {
            throw new Error(`target line lost: ${JSON.stringify(code)}`);
        }
        const heading = linkPreviewHashMatch(
            '/posts/doc#Likely-changes',
            ['first', 'likely-changes'],
        );
        if (heading !== 'likely-changes') throw new Error(`fragment match lost: ${heading}`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)
    assert "scrollLinkPreviewToTarget(content, link.getAttribute('href') || '')" in source
    assert "target.scrollIntoView({ block: 'center' })" in source
    assert "target.className = 'vyasa-link-preview-target-line'" in source
    assert "[data-source-line=\"${sourceLine}\"]" in source
    assert "body.querySelectorAll('.vyasa-code-line')" in source


def test_link_preview_resizes_from_each_edge():
    script = """
        import { resizeLinkPreviewRect } from './vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js';
        const original = { left: 100, top: 100, width: 500, height: 400 };
        const viewport = { width: 1000, height: 800 };
        const left = resizeLinkPreviewRect(original, 'left', 100, 0, viewport);
        const right = resizeLinkPreviewRect(original, 'right', 100, 0, viewport);
        const top = resizeLinkPreviewRect(original, 'top', 0, 100, viewport);
        const bottom = resizeLinkPreviewRect(original, 'bottom', 0, 100, viewport);
        const topLeft = resizeLinkPreviewRect(original, 'top-left', 100, 100, viewport);
        const bottomRight = resizeLinkPreviewRect(original, 'bottom-right', 100, 100, viewport);
        if (left.left !== 200 || left.width !== 400) throw new Error(`left edge failed`);
        if (right.left !== 100 || right.width !== 600) throw new Error(`right edge failed`);
        if (top.top !== 200 || top.height !== 300) throw new Error(`top edge failed`);
        if (bottom.top !== 100 || bottom.height !== 500) throw new Error(`bottom edge failed`);
        if (topLeft.left !== 200 || topLeft.top !== 200 || topLeft.width !== 400 || topLeft.height !== 300) throw new Error(`top-left corner failed`);
        if (bottomRight.width !== 600 || bottomRight.height !== 500) throw new Error(`bottom-right corner failed`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_link_preview_remembers_latest_width_for_new_popups():
    script = """
        const values = new Map();
        globalThis.localStorage = {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
        };
        const module = await import('./vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js?first');
        const { linkPreviewPreferredWidth, rememberLinkPreviewWidth } = module;
        if (linkPreviewPreferredWidth(560, 1000) !== 560) throw new Error('default width lost');
        rememberLinkPreviewWidth(720);
        if (linkPreviewPreferredWidth(560, 1000) !== 720) throw new Error('resized width not reused');
        const reloaded = await import('./vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js?reloaded');
        if (reloaded.linkPreviewPreferredWidth(560, 1000) !== 720) throw new Error('stored width not restored');
        rememberLinkPreviewWidth(420);
        if (linkPreviewPreferredWidth(560, 1000) !== 420) throw new Error('latest width not used');
        if (linkPreviewPreferredWidth(560, 400) !== 376) throw new Error('width exceeds viewport');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_link_preview_renders_unknown_extension_as_escaped_text(tmp_path, monkeypatch):
    source = tmp_path / "sample.xyz"
    source.write_text("<node>value</node>")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.xyz")

    result = routes.render_link_preview_html(href="sample.xyz")

    assert result is not None
    assert '<pre class="vyasa-link-preview-plain-text">&lt;node&gt;value&lt;/node&gt;</pre>' in result


def test_link_preview_renders_code_with_highlight_contract(tmp_path, monkeypatch):
    source = tmp_path / "sample.py"
    source.write_text("def run():\n    return True\n")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.py")

    result = routes.render_link_preview_html(href="sample.py")

    assert result is not None
    assert '<code class="language-python"' in result
    assert 'data-code-line-numbers="true"' in result
    preview_source = Path(
        "vyasa/extensions_builtin/link_preview/static/link_preview.js"
    ).read_text()
    assert "window.__vyasaInitCodeTools?.(content);" in preview_source
    assert "installCodeLineLinks(content);" in preview_source
    assert "dataset.vyasaLinkPreviewCodeLine = 'true'" in preview_source
    assert ".vyasa-link-preview-code-line::before" in Path(
        "vyasa/extensions_builtin/link_preview/static/link_preview.css"
    ).read_text()


def test_link_preview_resolves_mounted_source_path_with_line_suffix(tmp_path, monkeypatch):
    source = tmp_path / "agent_runtime.py"
    source.write_text("def register_agent_runtime():\n    return True\n")
    slug = "genhrx.ai/apps/ai/app/api/routes/agent_runtime.py"
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda value: source if value == slug else None)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: slug)

    result = routes.render_link_preview_html(
        href=f"/posts/{slug}:32",
        current_path="genhrx.ai/docs/ai-presentation/02-one-hour-structure",
    )

    assert result is not None
    assert "register_agent_runtime" in result


def test_link_preview_renders_full_markdown_for_symbol_position(tmp_path, monkeypatch):
    source = tmp_path / "sample.md"
    source.write_text("# Start\n\nOpening.\n\n# Later\n\nRun the target.")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.md")

    result = routes.render_link_preview_html(href="sample.md?symbol=target&kind=Function")

    assert result is not None
    assert "Opening." in result
    assert "Run the target." in result


def test_link_preview_fragment_match_ignores_heading_case(tmp_path, monkeypatch):
    source = tmp_path / "sample.md"
    source.write_text("# First\n\nopening\n\n## Likely changes\n\ntarget\n\n## Later\n\nignore\n")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.md")

    result = routes.render_link_preview_html(href="/posts/sample#Likely-changes")

    assert result is not None
    assert "Likely changes" in result
    assert "target" in result
    assert "opening" not in result
    assert "Later" not in result


def test_link_preview_stack_keeps_nested_previews_until_each_is_closed():
    script = """
        import { LinkPreviewStack } from './vyasa/extensions_builtin/link_preview/static/link_preview_stack.js';

        const views = [];
        const createView = ({ onClose }) => {
            const view = {
                content: null,
                removed: false,
                raised: 0,
                raise() { this.raised += 1; },
                remove() { this.removed = true; },
                setMessage(message) { this.content = message; },
                setContent(content) { this.content = content; },
                close: onClose,
            };
            views.push(view);
            return view;
        };
        const fetchPreview = async ({ href }) => `<p>${href}</p>`;
        const stack = new LinkPreviewStack({ createView, fetchPreview });
        const link = (href) => ({
            dataset: { vyasaLinkPreviewCurrentPath: 'parent' },
            getAttribute: (name) => name === 'href' ? href : null,
        });
        const parent = link('/parent');
        const child = link('/child');

        stack.open(parent, { clientX: 10, clientY: 10 });
        stack.open(parent, { clientX: 20, clientY: 20 });
        stack.open(child, { clientX: 30, clientY: 30 });
        await new Promise((resolve) => setTimeout(resolve, 0));

        if (stack.size !== 2) throw new Error(`expected two previews, got ${stack.size}`);
        if (views.length !== 2) throw new Error(`duplicate preview created`);
        if (views[0].removed || views[1].removed) throw new Error(`preview closed without dismissal`);
        if (views[0].content !== '<p>/parent</p>') throw new Error(`parent did not load`);
        if (views[1].content !== '<p>/child</p>') throw new Error(`child did not load`);

        if (!stack.closeLatest()) throw new Error(`latest preview was not closed`);
        if (stack.size !== 1 || views[0].removed || !views[1].removed) {
            throw new Error(`Escape must close child and leave parent open`);
        }
        stack.open(child, { clientX: 30, clientY: 30 });
        stack.closeAll();
        if (stack.size !== 0 || !views[0].removed || !views[2].removed) {
            throw new Error(`page change must close every preview`);
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


# --- code reference: parser, resolver, selection, render, build ---------


def _git_repo(tmp_path, name="repo"):
    repo = tmp_path / name
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "t"], check=True)
    return repo


def _git(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def _commit(repo, message="change"):
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", message)
    return _git(repo, "rev-parse", "HEAD")


def test_code_reference_parses_quoted_multi_range_focus():
    reference = CodeReference.parse(
        {"show": "lines", "lines": "120:190", "focus": "ln[131:137,166-180,200]"}
    )

    assert focus_ranges(reference.focus) == (
        SourceRange(131, 137),
        SourceRange(166, 180),
        SourceRange(200, 200),
    )


@pytest.mark.parametrize(
    "attrs,code",
    [
        ({"show": "everything"}, "invalid_attribute"),
        ({"view": "sideways"}, "invalid_attribute"),
        ({"role": "opinion"}, "invalid_attribute"),
        ({"context": "99"}, "invalid_attribute"),
        ({"follow_renames": "maybe"}, "invalid_attribute"),
        ({"colour": "red"}, "invalid_attribute"),
        ({"show": "region"}, "missing_attribute"),
        ({"show": "lines"}, "missing_attribute"),
        ({"focus": "changed"}, "missing_attribute"),
        ({"side": "both"}, "missing_attribute"),
        ({"view": "split", "side": "after"}, "missing_attribute"),
        ({"show": "lines", "lines": "12"}, "range_invalid"),
        ({"focus": "ln[9:2]"}, "range_invalid"),
    ],
)
def test_code_reference_rejects_invalid_attributes(attrs, code):
    with pytest.raises(CodeReferenceError) as caught:
        CodeReference.parse(attrs)

    assert caught.value.code == code


def test_code_reference_rejects_oversized_attribute_payload():
    with pytest.raises(CodeReferenceError) as caught:
        parse_code_reference_json(json.dumps({"symbol": "x" * 5000}))

    assert caught.value.code == "limit_exceeded"


def test_code_reference_resolves_python_symbol_kinds(tmp_path):
    source = tmp_path / "service.py"
    source.write_text(
        "def run():\n"
        "    return 1\n"
        "\n"
        "\n"
        "class Feed:\n"
        "    @property\n"
        "    def run(self):\n"
        "        return 2\n"
        "\n"
        "    class Inner:\n"
        "        def run(self):\n"
        "            return 3\n",
        encoding="utf-8",
    )

    function = resolve_code_reference(
        source, CodeReference.parse({"show": "symbol", "symbol": "run", "kind": "Function"})
    )
    klass = resolve_code_reference(
        source, CodeReference.parse({"show": "symbol", "symbol": "Feed", "kind": "Class"})
    )
    nested = resolve_code_reference(
        source, CodeReference.parse({"show": "symbol", "symbol": "Feed.Inner.run"})
    )

    assert function.selected == SourceRange(1, 2)
    assert klass.selected == SourceRange(5, 12)
    # The decorator belongs to the symbol, so the range starts at line 6.
    assert nested.selected == SourceRange(11, 12)


def test_code_reference_reports_ambiguous_and_unsupported_symbols(tmp_path):
    python = tmp_path / "service.py"
    python.write_text(
        "class A:\n    def run(self):\n        return 1\n"
        "\n\nclass B:\n    def run(self):\n        return 2\n",
        encoding="utf-8",
    )
    styles = tmp_path / "site.css"
    styles.write_text("body { color: red; }\n", encoding="utf-8")

    with pytest.raises(CodeReferenceError) as ambiguous:
        resolve_code_reference(python, CodeReference.parse({"show": "symbol", "symbol": "run"}))
    with pytest.raises(CodeReferenceError) as unsupported:
        resolve_code_reference(styles, CodeReference.parse({"show": "symbol", "symbol": "body"}))

    assert ambiguous.value.code == "symbol_ambiguous"
    assert unsupported.value.code == "language_unsupported"


def test_code_reference_rejects_duplicate_region_and_drifted_pin(tmp_path):
    duplicate = tmp_path / "twice.ts"
    duplicate.write_text(
        "// region: feed\nconst a = 1;\n// endregion\n"
        "// region: feed\nconst b = 2;\n// endregion\n",
        encoding="utf-8",
    )
    drifted = tmp_path / "settings.py"
    drifted.write_text("a = 1\nb = 2\nc = 3\n", encoding="utf-8")

    with pytest.raises(CodeReferenceError) as region:
        resolve_code_reference(
            duplicate, CodeReference.parse({"show": "region", "region": "feed"})
        )
    with pytest.raises(CodeReferenceError) as pin:
        resolve_code_reference(
            drifted, CodeReference.parse({"show": "lines", "lines": "1:2", "pin": "0000dead"})
        )

    assert region.value.code == "region_duplicate"
    assert pin.value.code == "pin_mismatch"


def test_code_reference_rejects_merge_commit_and_resolves_explicit_range(tmp_path):
    repo = _git_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    first = _commit(repo, "base")
    _git(repo, "checkout", "-qb", "side")
    (repo / "a.py").write_text("x = 2\n", encoding="utf-8")
    _commit(repo, "side")
    _git(repo, "checkout", "-q", "main")
    (repo / "b.py").write_text("y = 1\n", encoding="utf-8")
    _commit(repo, "main2")
    _git(repo, "merge", "-q", "--no-ff", "-m", "merge", "side")
    merge = _git(repo, "rev-parse", "HEAD")

    with pytest.raises(CodeReferenceError) as caught:
        resolve_code_reference(
            repo / "a.py",
            CodeReference.parse({"change": merge, "show": "file", "focus": "changed"}),
        )
    explicit = resolve_code_reference(
        repo / "a.py",
        CodeReference.parse({"change": f"{first}..{merge}", "show": "file", "focus": "changed"}),
    )
    root = resolve_code_reference(
        repo / "a.py",
        CodeReference.parse({"change": first, "show": "file", "focus": "changed"}),
    )

    assert caught.value.code == "merge_base_required"
    assert explicit.focused == (SourceRange(1, 1),)
    assert root.base_ref == "" and root.focused == (SourceRange(1, 1),)


def test_code_reference_reads_deleted_lines_from_the_before_side(tmp_path):
    repo = _git_repo(tmp_path)
    (repo / "feed.py").write_text("keep = 1\ndrop = 2\n", encoding="utf-8")
    _commit(repo, "base")
    (repo / "feed.py").write_text("keep = 1\n", encoding="utf-8")
    commit = _commit(repo, "remove")

    resolved = resolve_code_reference(
        repo / "feed.py",
        CodeReference.parse(
            {"change": commit, "show": "file", "focus": "changed", "side": "before", "view": "diff"}
        ),
    )

    assert resolved.focused == (SourceRange(2, 2),)
    assert [row.state for row in resolved.diff_lines] == ["context", "deleted"]


def test_code_reference_marks_untracked_worktree_file_as_fully_changed(tmp_path):
    repo = _git_repo(tmp_path)
    (repo / "seed.py").write_text("seed = 1\n", encoding="utf-8")
    _commit(repo, "base")
    fresh = repo / "fresh.py"
    fresh.write_text("a = 1\nb = 2\n", encoding="utf-8")

    resolved = resolve_code_reference(
        fresh, CodeReference.parse({"change": "worktree", "show": "file", "focus": "changed"})
    )

    assert resolved.head_ref == "worktree"
    assert resolved.focused == (SourceRange(1, 2),)


def test_code_reference_rejects_worktree_in_static_builds(tmp_path):
    repo = _git_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    _commit(repo, "base")

    with pytest.raises(CodeReferenceError) as caught:
        resolve_code_reference(
            repo / "a.py",
            CodeReference.parse({"change": "worktree", "show": "file"}),
            allow_worktree=False,
        )

    assert caught.value.code == "worktree_disallowed"


def test_code_reference_warns_when_the_change_misses_the_shown_source(tmp_path):
    repo = _git_repo(tmp_path)
    (repo / "feed.py").write_text(
        "def untouched():\n    return 1\n\n\ndef edited():\n    return 1\n", encoding="utf-8"
    )
    _commit(repo, "base")
    (repo / "feed.py").write_text(
        "def untouched():\n    return 1\n\n\ndef edited():\n    return 2\n", encoding="utf-8"
    )
    commit = _commit(repo, "edit")

    resolved = resolve_code_reference(
        repo / "feed.py",
        CodeReference.parse(
            {
                "change": commit,
                "show": "symbol",
                "symbol": "untouched",
                "kind": "Function",
                "focus": "changed",
            }
        ),
    )

    assert [item.code for item in resolved.diagnostics] == ["no_changed_lines"]
    assert resolved.focused == ()
    assert resolved.blocks == (SourceRange(1, 2),)


def test_code_reference_merges_context_and_reports_omitted_gaps(tmp_path):
    source = tmp_path / "feed.py"
    source.write_text("\n".join(f"line_{n} = {n}" for n in range(1, 41)) + "\n", encoding="utf-8")

    resolved = resolve_code_reference(
        source,
        CodeReference.parse({"show": "file", "focus": "ln[5,7,30]", "context": "2"}),
    )

    assert resolved.blocks == (SourceRange(3, 9), SourceRange(28, 32))
    assert resolved.omitted_gaps == (SourceRange(10, 27),)


def test_code_reference_render_carries_header_badges_and_line_states(tmp_path, monkeypatch):
    repo = _git_repo(tmp_path)
    source = repo / "feed.py"
    source.write_text("a = 1\nb = 2\n", encoding="utf-8")
    _commit(repo, "base")
    source.write_text("a = 1\nb = 3\n", encoding="utf-8")
    commit = _commit(repo, "edit")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "feed.py")

    result = routes.render_link_preview_html(
        href="feed.py",
        code_ref=json.dumps(
            {"change": commit, "show": "file", "focus": "changed", "role": "test", "context": "0"}
        ),
    )

    assert 'data-code-reference-role="test"' in result
    assert f'data-code-reference-head="{commit}"' in result
    assert 'data-code-reference-path-after="feed.py"' in result
    assert 'data-badge="changed"' in result and "1 changed lines" in result
    assert 'data-code-line-states="1-1:context,2-2:added"' in result
    assert 'data-code-source-start="1"' in result
    assert 'data-code-reference-blocks="2-2"' in result
    assert "Open in editor" in result and "Open full file" in result


def test_code_reference_render_escapes_source_and_diagnostics(tmp_path, monkeypatch):
    source = tmp_path / "unsafe.py"
    source.write_text('MARK = "<script>alert(1)</script>"\n', encoding="utf-8")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "unsafe.py")

    rendered = routes.render_link_preview_html(href="unsafe.py", code_ref=json.dumps({"show": "file"}))
    diagnostic = routes.render_link_preview_html(
        href="unsafe.py",
        code_ref=json.dumps({"show": "symbol", "symbol": "<img src=x onerror=1>"}),
    )

    assert "<script>alert(1)</script>" not in rendered
    assert "&lt;script&gt;" in rendered
    assert 'data-code-reference-diagnostic="symbol_not_found"' in diagnostic
    assert "<img src=x" not in diagnostic


def test_code_reference_render_shows_rename_header(tmp_path, monkeypatch):
    repo = _git_repo(tmp_path)
    old = repo / "old.py"
    old.write_text("value = 1\n", encoding="utf-8")
    _commit(repo, "base")
    new = repo / "new.py"
    old.rename(new)
    commit = _commit(repo, "rename")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: new)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "new.py")

    result = routes.render_link_preview_html(
        href="new.py", code_ref=json.dumps({"change": commit, "show": "file", "focus": "changed"})
    )

    assert 'data-code-reference-path-before="old.py"' in result
    assert 'data-badge="rename"' in result
    assert "old.py" in result and "new.py" in result


def test_code_reference_render_shows_one_scrollable_range(tmp_path, monkeypatch):
    source = tmp_path / "feed.py"
    source.write_text("\n".join(f"line_{n} = {n}" for n in range(1, 41)) + "\n", encoding="utf-8")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "feed.py")

    result = routes.render_link_preview_html(
        href="feed.py",
        code_ref=json.dumps({"show": "file", "focus": "ln[5,30]", "context": "1"}),
    )

    # The reader scrolls the real file, so nothing between the focus ranges is
    # hidden and every line keeps its own number.
    assert result.count("<code") == 1
    assert 'data-code-source-start="1"' in result
    assert 'data-code-reference-first-line="1"' in result
    assert 'data-code-reference-last-line="40"' in result
    # Navigation stops carry the context margin, so each stop opens with lead-in.
    assert 'data-code-reference-blocks="4-6,29-31"' in result
    assert "line_18 = 18" in result
    assert "data-code-omitted-start" not in result
    assert "data-code-reference-expand" not in result


def test_code_reference_clips_a_huge_range_around_the_focus(tmp_path, monkeypatch):
    from vyasa.extensions_builtin.link_preview import code_reference

    source = tmp_path / "huge.py"
    source.write_text("\n".join(f"line_{n} = {n}" for n in range(1, 5001)) + "\n", encoding="utf-8")
    monkeypatch.setattr(code_reference, "RENDERED_LINES_LIMIT", 100)
    code_reference._resolve_cached.cache_clear()

    resolved = resolve_code_reference(
        source, CodeReference.parse({"show": "file", "focus": "ln[3000]"})
    )
    code_reference._resolve_cached.cache_clear()

    assert resolved.selected == SourceRange(1, 5000)
    assert resolved.shown.count == 100
    assert resolved.shown.start <= 3000 <= resolved.shown.end
    assert [item.code for item in resolved.diagnostics] == ["limit_exceeded"]
    assert resolved.diagnostics[0].severity == "warning"


def test_code_reference_build_report_fails_on_author_errors(tmp_path, monkeypatch, capsys):
    from vyasa.extensions_builtin.link_preview import code_reference_build as build
    from vyasa.extensions_builtin.link_preview.code_reference_markdown import (
        REPORT,
        CodeReferenceRecord,
    )

    source = tmp_path / "feed.py"
    source.write_text("def run():\n    return 1\n", encoding="utf-8")
    REPORT.clear()
    REPORT.add(CodeReferenceRecord("docs/blueprint.md", "feed.py", (("show", "file"),)))
    REPORT.add(
        CodeReferenceRecord(
            "docs/blueprint.md", "feed.py", (("show", "symbol"), ("symbol", "missing"))
        )
    )
    monkeypatch.setattr(build, "_resolve_preview_file", lambda _slug: source, raising=False)
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)

    with pytest.raises(build.CodeReferenceBuildError):
        build.verify_code_references()

    printed = capsys.readouterr().out
    assert "code references: 1 valid, 0 warnings, 1 errors" in printed
    assert "diagnostic: symbol_not_found=1" in printed
    assert "docs/blueprint.md -> feed.py" in printed
    # A build clears the report so the next build starts from its own render.
    assert REPORT.records == []


def test_code_line_spec_map_reads_range_and_single_line_specs():
    script = """
        import { codeLineSpecMap } from './vyasa/extensions_builtin/code_tools/static/code_tools_lines.js';

        const states = codeLineSpecMap('3-5:added,9:deleted');
        const numbers = codeLineSpecMap('1:12,2:13');
        if (states.get(4) !== 'added' || states.get(9) !== 'deleted' || states.has(6)) {
            throw new Error('line states must expand ranges');
        }
        if (numbers.get(2) !== '13') throw new Error('number map must survive');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_code_reference_cache_serves_repeat_lookups_but_follows_worktree_edits(tmp_path):
    repo = _git_repo(tmp_path)
    source = repo / "feed.py"
    source.write_text("a = 1\n", encoding="utf-8")
    _commit(repo, "base")
    reference = CodeReference.parse({"change": "worktree", "show": "file", "focus": "changed"})

    source.write_text("a = 1\nb = 2\n", encoding="utf-8")
    first = resolve_code_reference(source, reference)
    again = resolve_code_reference(source, reference)
    source.write_text("a = 1\nb = 2\nc = 3\n", encoding="utf-8")
    edited = resolve_code_reference(source, reference)

    assert first is again
    assert first.focused == (SourceRange(2, 2),)
    assert edited.focused == (SourceRange(2, 3),)


def test_code_reference_diff_view_keeps_rows_inside_the_shown_symbol(tmp_path):
    repo = _git_repo(tmp_path)
    source = repo / "feed.py"
    source.write_text(
        "def outside():\n    drop_me = 1\n    return drop_me\n\n\n"
        "def shown():\n    keep = 1\n    return keep\n",
        encoding="utf-8",
    )
    _commit(repo, "base")
    source.write_text(
        "def outside():\n    return 0\n\n\n"
        "def shown():\n    keep = 2\n    return keep\n",
        encoding="utf-8",
    )
    commit = _commit(repo, "edit")

    resolved = resolve_code_reference(
        source,
        CodeReference.parse(
            {
                "change": commit,
                "show": "symbol",
                "symbol": "shown",
                "kind": "Function",
                "focus": "changed",
                "view": "diff",
                "side": "both",
                "context": "1",
            }
        ),
    )
    rows = code_reference_render._diff_rows(resolved)

    assert "drop_me = 1" not in "\n".join(row.text for row in rows)
    assert [row.state for row in rows if row.state != "context"] == ["deleted", "added"]


def test_code_reference_resolves_hook_callbacks_and_constants(tmp_path):
    hook = tmp_path / "useQueue.ts"
    hook.write_text(
        "export const useQueue = () => {\n"
        "  const reportHidden = useCallback(\n"
        "    (id: string) => drop(id),\n"
        "    [],\n"
        "  );\n"
        "  return { reportHidden };\n"
        "};\n"
        "\n"
        "export const FLUSH_MS = 1000;\n",
        encoding="utf-8",
    )
    settings = tmp_path / "settings.py"
    settings.write_text(
        "class Settings:\n    DEBUG = False\n\n\nSEEN_TRACKING_ENABLED: bool = False\n",
        encoding="utf-8",
    )

    callback = resolve_code_reference(
        hook, CodeReference.parse({"show": "symbol", "symbol": "reportHidden", "kind": "Function"})
    )
    constant = resolve_code_reference(
        hook, CodeReference.parse({"show": "symbol", "symbol": "FLUSH_MS", "kind": "Variable"})
    )
    flag = resolve_code_reference(
        settings,
        CodeReference.parse({"show": "symbol", "symbol": "SEEN_TRACKING_ENABLED", "kind": "Variable"}),
    )
    attribute = resolve_code_reference(
        settings, CodeReference.parse({"show": "symbol", "symbol": "Settings.DEBUG"})
    )

    assert callback.selected == SourceRange(2, 5)
    assert constant.selected == SourceRange(9, 9)
    assert flag.selected == SourceRange(5, 5)
    assert attribute.selected == SourceRange(2, 2)


def test_missing_tree_sitter_grammars_name_the_fix(tmp_path, monkeypatch):
    import builtins

    source = tmp_path / "card.tsx"
    source.write_text("export const Card = () => null;\n", encoding="utf-8")
    real_import = builtins.__import__

    def without_grammars(name, *args, **kwargs):
        if name == "tree_sitter_language_pack":
            raise ImportError("No module named 'tree_sitter_language_pack'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_grammars)

    with pytest.raises(CodeReferenceError) as caught:
        resolve_code_reference(source, CodeReference.parse({"show": "symbol", "symbol": "Card"}))

    assert caught.value.code == "language_unsupported"
    assert "tree-sitter-language-pack" in str(caught.value)
    assert "show=region" in str(caught.value)


def test_code_reference_block_ranges_parse():
    script = """
        import { parseBlockRanges }
            from './vyasa/extensions_builtin/link_preview/static/code_reference.js';

        const ranges = parseBlockRanges('3-3,10-14');
        if (ranges.length !== 2 || ranges[1].end !== 14) throw new Error('block ranges must parse');
        if (parseBlockRanges('7').length !== 1 || parseBlockRanges('7')[0].end !== 7) {
            throw new Error('a single line is a one-line block');
        }
        if (parseBlockRanges('').length !== 0) throw new Error('empty spec must give no ranges');
        if (parseBlockRanges('bad').length !== 0) throw new Error('junk must be skipped');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_code_reference_does_not_create_a_second_scroll_container():
    # The popup card sizes with `min-height`, so a percentage height inside it
    # collapses. A reference that scrolled itself would lock the popup.
    css = Path("vyasa/extensions_builtin/link_preview/static/code_reference.css").read_text()
    markup = Path("vyasa/extensions_builtin/link_preview/code_reference_render.py").read_text()
    reference_rule = css.split(".vyasa-code-reference {", 1)[1].split("}", 1)[0]

    assert "height: 100%" not in reference_rule
    assert "overflow" not in reference_rule
    assert "overflow: hidden" not in css.split(".vyasa-link-preview-body:has", 1)[1].split("}", 1)[0]
    assert "position: sticky" in css
    assert "vyasa-code-reference-rail" not in markup


def test_code_reference_full_file_toggle_widens_the_view_and_keeps_the_focus(tmp_path, monkeypatch):
    repo = _git_repo(tmp_path)
    source = repo / "service.py"
    source.write_text(
        "def before():\n    return 0\n\n\n"
        "def shown():\n    return 1\n\n\n"
        "def after():\n    return 2\n",
        encoding="utf-8",
    )
    _commit(repo, "base")
    source.write_text(
        "def before():\n    return 9\n\n\n"
        "def shown():\n    return 3\n\n\n"
        "def after():\n    return 2\n",
        encoding="utf-8",
    )
    commit = _commit(repo, "edit")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "service.py")
    code_ref = json.dumps(
        {
            "change": commit,
            "show": "symbol",
            "symbol": "shown",
            "kind": "Function",
            "focus": "changed",
            "context": "0",
        }
    )

    focused = routes.render_link_preview_html(href="service.py", code_ref=code_ref)
    whole = routes.render_link_preview_html(href="service.py", code_ref=code_ref, full=True)

    assert 'data-code-reference-full="false"' in focused
    assert 'data-code-reference-first-line="5"' in focused
    assert "def before" not in focused

    # The whole file is on screen, but the reference still claims only the
    # lines it selected: line 2 changed too and stays unhighlighted.
    assert 'data-code-reference-full="true"' in whole
    assert 'data-code-reference-first-line="1"' in whole
    assert 'data-code-reference-last-line="10"' in whole
    assert "def before" in whole and "def after" in whole
    assert 'data-code-highlight-lines="6-6"' in whole
    assert 'data-code-reference-blocks="6-6"' in whole

    assert "data-code-reference-toggle-full" in focused
    assert ">Full file<" in focused
    assert ">Focused<" in whole


def test_code_reference_hides_the_toggle_when_the_file_is_already_shown(tmp_path, monkeypatch):
    source = tmp_path / "small.py"
    source.write_text("a = 1\nb = 2\n", encoding="utf-8")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "small.py")

    result = routes.render_link_preview_html(
        href="small.py", code_ref=json.dumps({"show": "file", "focus": "all"})
    )

    assert "data-code-reference-toggle-full" not in result


def test_preview_route_reads_the_full_flag(tmp_path, monkeypatch):
    source = tmp_path / "svc.py"
    source.write_text("def run():\n    return 1\n\n\ndef other():\n    return 2\n", encoding="utf-8")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _p, strip_suffix=True: "svc.py")
    seen = {}

    def capture(rt_path):
        def register(fn):
            seen[rt_path] = fn
            return fn
        return register

    routes.register_link_preview_routes(capture, None)
    handler = seen["/preview/link"]
    code_ref = json.dumps({"show": "symbol", "symbol": "run", "kind": "Function"})

    off = handler(href="svc.py", code_ref=code_ref).body.decode()
    on = handler(href="svc.py", code_ref=code_ref, full="1").body.decode()

    assert 'data-code-reference-full="false"' in off and "def other" not in off
    assert 'data-code-reference-full="true"' in on and "def other" in on
