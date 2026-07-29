import subprocess
from pathlib import Path


def test_link_preview_shadow_is_on_unclipped_outer_popup():
    css = Path("vyasa/extensions_builtin/link_preview/static/link_preview.css").read_text()
    popup_rule = css.split(".vyasa-link-preview-popover.is-open", 1)[1].split("}", 1)[0]
    card_rule = css.split(".vyasa-link-preview-card {", 1)[1].split("}", 1)[0]
    pointer_rule = css.split(".vyasa-link-preview-pointer polygon {", 1)[1].split("}", 1)[0]

    assert "width: max(560px, 46vw);" in css
    assert "box-shadow:" in popup_rule
    assert "drop-shadow(" in pointer_rule
    assert "box-shadow:" not in card_rule


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
        if (Math.abs(baseA[0] - baseB[0]) > 0.001) throw new Error(`pointer base is not edge-aligned`);
        if (Math.abs(baseA[1] - baseB[1]) !== 28) throw new Error(`pointer base is not 28px wide`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


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
        views[0].close();
        if (stack.size !== 0 || !views[0].removed) throw new Error(`parent did not close`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)
