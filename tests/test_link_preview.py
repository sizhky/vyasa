import subprocess
from pathlib import Path

from vyasa.extensions_builtin.link_preview import routes


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
    assert "event.shiftKey ? shell?.dataset.absolutePath : shell?.dataset.relativePath" in source
    assert "sourceLabel.title = relativePath;" in source
    assert "overflow-wrap: anywhere;" in css
    assert "white-space: normal;" in css
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
        import { linkPreviewHashMatch, linkPreviewLineMatch, linkPreviewSymbolMatch } from './vyasa/extensions_builtin/link_preview/static/link_preview_target.js';
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
        import { linkPreviewPreferredWidth, rememberLinkPreviewWidth } from './vyasa/extensions_builtin/link_preview/static/link_preview_geometry.js';
        if (linkPreviewPreferredWidth(560, 1000) !== 560) throw new Error('default width lost');
        rememberLinkPreviewWidth(720);
        if (linkPreviewPreferredWidth(560, 1000) !== 720) throw new Error('resized width not reused');
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
