def build_google_oauth(google_oauth_cfg, logger):
    oauth = None
    enabled = False
    if google_oauth_cfg.get("client_id") and google_oauth_cfg.get("client_secret"):
        try:
            from authlib.integrations.starlette_client import OAuth

            oauth = OAuth()
            oauth.register(
                name="google",
                client_id=google_oauth_cfg["client_id"],
                client_secret=google_oauth_cfg["client_secret"],
                server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
                userinfo_endpoint="https://openidconnect.googleapis.com/v1/userinfo",
                client_kwargs={"scope": "openid email profile"},
            )
            enabled = True
        except Exception as exc:
            logger.warning(f"Google OAuth disabled: {exc}")
    return oauth, enabled
