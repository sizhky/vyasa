import re

_GUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def parse_roles_text(text: str):
    return [part.strip() for part in re.split(r"[,\n]+", text or "") if part.strip()]


async def start_oauth_login(request, oauth, provider):
    next_url = request.session.get("next") or request.query_params.get("next") or "/"
    request.session["next"] = next_url
    redirect_uri = str(request.base_url).rstrip("/") + f"/auth/{provider}/callback"
    return await oauth.create_client(provider).authorize_redirect(request, redirect_uri)


async def fetch_oauth_userinfo(request, oauth, provider, logger):
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo:
        return userinfo
    try:
        return await client.parse_id_token(request, token)
    except Exception as exc:
        logger.warning(f"{provider} OAuth id_token missing or invalid: {exc}")
        return await client.userinfo(token=token)


def oauth_account_email(userinfo):
    """Email used for allow lists and RBAC. Microsoft work accounts may omit
    `email` and carry the sign-in name in `preferred_username`.

    >>> oauth_account_email({"preferred_username": "A@PenguinAI.co"})
    'A@PenguinAI.co'
    """
    if not isinstance(userinfo, dict):
        return None
    email = userinfo.get("email") or userinfo.get("preferred_username")
    return str(email).strip() if email else None


def oauth_account_allowed(userinfo, provider_cfg):
    """Gate an OAuth account by tenant, domain, and email.

    >>> cfg = {"tenant_id": "11111111-2222-3333-4444-555555555555", "allowed_domains": ["penguinai.co"]}
    >>> oauth_account_allowed({"tid": "11111111-2222-3333-4444-555555555555", "email": "a@penguinai.co"}, cfg)
    True
    >>> oauth_account_allowed({"tid": "99999999-2222-3333-4444-555555555555", "email": "a@penguinai.co"}, cfg)
    False
    >>> oauth_account_allowed({"email": "a@evil.co"}, {"allowed_domains": ["penguinai.co"]})
    False
    """
    claims = userinfo if isinstance(userinfo, dict) else {}
    tenant = str(provider_cfg.get("tenant_id") or "").strip().lower()
    if _GUID.match(tenant) and str(claims.get("tid") or "").lower() != tenant:
        return False
    email = (oauth_account_email(claims) or "").lower()
    allowed_domains = provider_cfg.get("allowed_domains", [])
    if allowed_domains and (not email or email.split("@")[-1] not in allowed_domains):
        return False
    allowed_emails = provider_cfg.get("allowed_emails", [])
    return not allowed_emails or bool(email and email in allowed_emails)


def build_oauth_auth_payload(provider, userinfo):
    claims = userinfo if isinstance(userinfo, dict) else {}
    sub = claims.get("sub")
    return {
        "provider": provider,
        "email": oauth_account_email(claims),
        "username": claims.get("preferred_username"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
        "sub": sub,
        "id": sub,
    }
