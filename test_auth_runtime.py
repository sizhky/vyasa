from types import SimpleNamespace

from vyasa.auth.runtime import make_user_auth_before


def _request(path: str):
    return SimpleNamespace(url=SimpleNamespace(path=path), scope={})


def test_api_requests_do_not_poison_next_redirect():
    before = make_user_auth_before(
        auth_required=True,
        rbac_rules=[],
        rbac_cfg={},
        google_oauth_cfg={},
        coerce_list=lambda value: value if isinstance(value, list) else [],
    )
    sess = {}

    response = before(_request("/api/bookmarks"), sess)

    assert response is None
    assert sess == {}


def test_page_requests_still_redirect_to_login():
    before = make_user_auth_before(
        auth_required=True,
        rbac_rules=[],
        rbac_cfg={},
        google_oauth_cfg={},
        coerce_list=lambda value: value if isinstance(value, list) else [],
    )
    sess = {}

    response = before(_request("/posts/example"), sess)

    assert response is not None
    assert response.status_code == 303
    assert sess["next"] == "/posts/example"
