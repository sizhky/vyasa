from fasthtml.common import to_xml

from vyasa.helpers import content_url_for_slug
from vyasa.search_views import render_posts_search_results
from vyasa.slides import ZenSlideDeck


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
