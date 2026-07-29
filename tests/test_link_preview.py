import subprocess
from pathlib import Path

from vyasa.extensions_builtin.link_preview import routes


def test_link_preview_shadow_is_on_unclipped_outer_popup():
    css = Path("vyasa/extensions_builtin/link_preview/static/link_preview.css").read_text()
    source = Path("vyasa/extensions_builtin/link_preview/static/link_preview.js").read_text()
    popup_rule = css.split(".vyasa-link-preview-popover.is-open", 1)[1].split("}", 1)[0]
    card_rule = css.split(".vyasa-link-preview-card {", 1)[1].split("}", 1)[0]
    pointer_rule = css.split(".vyasa-link-preview-pointer polygon {", 1)[1].split("}", 1)[0]

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
    assert "if (relativePath) sourceLabel.textContent = relativePath;" in source
    assert "--vyasa-link-preview-font-size" in css
    assert "font-size: 1.75em;" in css
    assert "width: max-content;" in css
    assert ".vyasa-link-preview-body .vyasa-doc-h2 { font-size: 1.5em; }" in css
    assert ".vyasa-link-preview-body .vyasa-doc-h6 { font-size: 1em; }" in css


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
        if (Math.abs(baseCenterX - 201) > 0.001) throw new Error(`pointer missed popup edge`);
        const baseWidth = Math.hypot(baseA[0] - baseB[0], baseA[1] - baseB[1]);
        if (Math.abs(baseWidth - 28) > 0.001) throw new Error(`pointer base is not 28px wide`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


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


def test_link_preview_renders_unknown_extension_as_escaped_text(tmp_path, monkeypatch):
    source = tmp_path / "sample.xyz"
    source.write_text("<node>value</node>")
    monkeypatch.setattr(routes, "_resolve_preview_file", lambda _slug: source)
    monkeypatch.setattr(routes, "content_slug_for_path", lambda _path, strip_suffix=True: "sample.xyz")

    result = routes.render_link_preview_html(href="sample.xyz")

    assert result is not None
    assert '<pre class="vyasa-link-preview-plain-text">&lt;node&gt;value&lt;/node&gt;</pre>' in result


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
