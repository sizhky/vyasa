import re


def parse_roles_text(text: str):
    return [part.strip() for part in re.split(r"[,\n]+", text or "") if part.strip()]


async def start_google_login(request, google_oauth):
    next_url = request.session.get("next") or request.query_params.get("next") or "/"
    request.session["next"] = next_url
    redirect_uri = str(request.base_url).rstrip("/") + "/auth/google/callback"
    return await google_oauth.google.authorize_redirect(request, redirect_uri)


async def fetch_google_userinfo(request, google_oauth, logger):
    token = await google_oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo:
        return userinfo
    try:
        return await google_oauth.google.parse_id_token(request, token)
    except Exception as exc:
        logger.warning(f"Google OAuth id_token missing or invalid: {exc}")
        return await google_oauth.google.userinfo(token=token)


def google_account_allowed(email, google_oauth_cfg):
    allowed_domains = google_oauth_cfg.get("allowed_domains", [])
    if allowed_domains and (not email or email.split("@")[-1] not in allowed_domains):
        return False
    allowed_emails = google_oauth_cfg.get("allowed_emails", [])
    return not allowed_emails or bool(email and email in allowed_emails)


def build_google_auth_payload(userinfo):
    return {
        "provider": "google",
        "email": userinfo.get("email") if isinstance(userinfo, dict) else None,
        "name": userinfo.get("name") if isinstance(userinfo, dict) else None,
        "picture": userinfo.get("picture") if isinstance(userinfo, dict) else None,
    }
