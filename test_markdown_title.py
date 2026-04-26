from vyasa.helpers import resolve_markdown_title


def test_frontmatter_title_strips_identical_leading_h1(tmp_path):
    post = tmp_path / "post.md"
    post.write_text("---\ntitle: Same Title\n---\n# Same Title\n\nBody text.\n", encoding="utf-8")

    title, body = resolve_markdown_title(post)

    assert title == "Same Title"
    assert body == "Body text."


def test_frontmatter_title_keeps_different_leading_h1(tmp_path):
    post = tmp_path / "post.md"
    post.write_text("---\ntitle: Frontmatter Title\n---\n# Body Title\n\nBody text.\n", encoding="utf-8")

    title, body = resolve_markdown_title(post)

    assert title == "Frontmatter Title"
    assert body == "# Body Title\n\nBody text."
