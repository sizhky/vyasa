from pathlib import Path


ANNOTATIONS_JS = Path("vyasa/extensions_builtin/annotations/static/annotations.js")
ANNOTATIONS_CSS = Path("vyasa/extensions_builtin/annotations/static/annotations.css")


def test_annotations_render_bottom_comments_with_bidirectional_anchors():
    source = ANNOTATIONS_JS.read_text(encoding="utf-8")

    assert "main.appendChild(commentsSection)" in source
    assert "className = 'vyasa-comment-anchor'" in source
    assert "className = 'vyasa-comment-backlink'" in source
    assert "note.scrollIntoView" in source
    assert "target.scrollIntoView" in source
    assert "showCommentPopup(anchor, note, item)" in source
    assert "aria-haspopup', 'dialog'" in source
    assert "classList.toggle('is-pinned', next)" in source
    assert "bar.addEventListener('pointermove'" in source
    assert "const commentPopups = new Map()" in source
    assert "vyasa.annotations.popups.v1" in source
    assert "popup.dataset.vyasaCommentPopup = item.id" in source
    assert "classList.add('vyasa-comment-popup-target')" in source
    assert "persistedPopups.filter((entry) => entry.path === path && entry.pinned)" in source
    assert "localStorage.removeItem('vyasa.annotations.popupPosition.v2')" in source
    assert "const entry = { path, id: state.item.id, pinned: true }" in source
    assert "data-annotation-replies" in source
    assert "}, 5000)" in source
    assert "classList.add('is-hiding')" in source
    assert "!vyasa-comments 1" in source
    assert "`@ thread ${number}`" in source
    assert "makeCommentCopyButton(() => annotationRoots, 'Copy all comments')" in source
    assert "makeCommentCopyButton(() => [item], 'Copy comment thread')" in source
    assert "comment${count === 1 ? '' : 's'} copied" in source
    assert "aria-live', 'polite'" in source
    assert "<uk-icon icon=\"${state.pinned ? 'pin-off' : 'pin'}\"" in source
    assert "host.insertAdjacentElement('afterbegin', note)" not in source
    assert "quote.className = 'vyasa-comment-quote'" in source


def test_popup_controls_use_theme_ink_color():
    css = ANNOTATIONS_CSS.read_text(encoding="utf-8")
    assert ".vyasa-comment-popup-bar button" in css
    assert "color: var(--vyasa-ink, #2d3434) !important" in css
    assert "--vyasa-comment-glow-rgb: 245 158 11" in css
    assert "rgb(var(--vyasa-comment-glow-rgb) / .18)" in css
