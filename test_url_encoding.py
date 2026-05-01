from pathlib import Path

from fasthtml.common import to_xml

from vyasa.helpers import content_url_for_slug
from vyasa.search_views import render_posts_search_results
from vyasa.slides import ZenSlideDeck, present_href_for_anchor


def test_content_url_for_slug_escapes_reserved_path_chars():
    slug = "transcripts/Basics/#2_ A star-tup is born!"

    assert content_url_for_slug(slug) == "/posts/transcripts/Basics/%232_%20A%20star-tup%20is%20born%21"


def test_search_results_emit_encoded_post_links():
    slug = "transcripts/Basics/#2_ A star-tup is born!"

    html = to_xml(render_posts_search_results("#2", [(slug, slug)], None))

    assert 'href="/posts/transcripts/Basics/%232_%20A%20star-tup%20is%20born%21"' in html
    assert 'hx-get="/posts/transcripts/Basics/%232_%20A%20star-tup%20is%20born%21"' in html


def test_slide_links_emit_encoded_doc_paths():
    deck = ZenSlideDeck("## Title")

    assert deck.href("#2_ A star-tup is born!", 1) == "/slides/%232_%20A%20star-tup%20is%20born%21/slide-1"
    assert deck.doc_href("#2_ A star-tup is born!", 1).startswith("/posts/%232_%20A%20star-tup%20is%20born%21#")


def test_present_href_for_anchor_matches_deck_anchor_mapping():
    pokemon = Path("/Users/yeshwanth/Code/Personal/vyasa/demo/pokemon/README.md").read_text(encoding="utf-8")
    skill = Path("/Users/yeshwanth/Code/Divami/divami-agents/skills/convo-with-me/SKILL.md").read_text(encoding="utf-8")

    assert present_href_for_anchor(pokemon, "demo/pokemon/README", "intro") == "/slides/demo/pokemon/README/slide-3"
    assert present_href_for_anchor(skill, "divami-agents/skills/convo-with-me/SKILL", "mode-composition") == "/slides/divami-agents/skills/convo-with-me/SKILL/slide-3"


def test_frontmatter_only_prelude_does_not_create_empty_slide():
    deck = ZenSlideDeck("---\ntitle: Skill\n---\n\n# Top\n\nAlpha\n\n## Child\n\nBeta\n")

    assert deck.slides == [["# Top", "Alpha"], ["# Top", "## Child", "Beta"]]
