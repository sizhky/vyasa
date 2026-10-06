from dataclasses import dataclass
from typing import Callable

# Microsoft authorities that accept accounts from any tenant. Their id_token
# `email` claim is not verified, so a domain check alone cannot gate access.
MICROSOFT_MULTI_TENANT = {"common", "organizations", "consumers"}


@dataclass(frozen=True)
class OAuthProvider:
    """One OIDC sign-in provider.

    >>> OAUTH_PROVIDERS["microsoft"].metadata_url({"tenant_id": "contoso.com"})
    'https://login.microsoftonline.com/contoso.com/v2.0/.well-known/openid-configuration'
    >>> OAUTH_PROVIDERS["microsoft"].metadata_url({"tenant_id": "common"}) is None
    True
    """

    name: str
    label: str
    metadata_url: Callable[[dict], str | None]


def _microsoft_metadata_url(cfg: dict) -> str | None:
    tenant = str(cfg.get("tenant_id") or "").strip()
    if not tenant or tenant.lower() in MICROSOFT_MULTI_TENANT:
        return None
    return f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"


OAUTH_PROVIDERS = {
    "google": OAuthProvider("google", "Google", lambda cfg: "https://accounts.google.com/.well-known/openid-configuration"),
    "microsoft": OAuthProvider("microsoft", "Microsoft", _microsoft_metadata_url),
}


def build_oauth(oauth_cfg: dict, logger):
    """Register every configured provider. Returns (oauth, enabled names in display order)."""
    configured = [
        (provider, cfg)
        for name, provider in OAUTH_PROVIDERS.items()
        if (cfg := oauth_cfg.get(name) or {}).get("client_id") and cfg.get("client_secret")
    ]
    if not configured:
        return None, ()
    try:
        from authlib.integrations.starlette_client import OAuth
    except Exception as exc:
        logger.warning(f"OAuth disabled: {exc}")
        return None, ()
    oauth = OAuth()
    enabled = []
    for provider, cfg in configured:
        metadata_url = provider.metadata_url(cfg)
        if not metadata_url:
            logger.warning(f"{provider.label} OAuth disabled: set a single tenant_id (not common/organizations/consumers)")
            continue
        oauth.register(
            name=provider.name,
            client_id=cfg["client_id"],
            client_secret=cfg["client_secret"],
            server_metadata_url=metadata_url,
            client_kwargs={"scope": "openid email profile"},
        )
        enabled.append(provider.name)
    return oauth, tuple(enabled)
