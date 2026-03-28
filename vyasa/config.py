"""Configuration management for Vyasa.

Supports loading configuration from:
1. .vyasa file (TOML format) in the current directory or blog root
2. Environment variables (as fallback)
3. Default values

Priority: .vyasa file > environment variables > defaults
"""

import os
import hashlib
import tomllib
from pathlib import Path
from typing import Optional
from .helpers import slug_to_title

MIN_DYNAMIC_PORT = 1024
MAX_DYNAMIC_PORT = 65535


def port_for_working_directory(path: Path) -> int:
    """Map an absolute directory path to a deterministic non-privileged port."""
    normalized = str(path.resolve()).encode("utf-8")
    digest = hashlib.sha256(normalized).digest()
    span = MAX_DYNAMIC_PORT - MIN_DYNAMIC_PORT + 1
    return MIN_DYNAMIC_PORT + (int.from_bytes(digest[:8], "big") % span)


class VyasaConfig:

    """Configuration handler for Vyasa."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize configuration.
        
        Args:
            config_path: Optional path to .vyasa file. If not provided, will search
                        in current directory and VYASA_ROOT.
        """
        self._config = {}
        self._loaded_config_path: Optional[Path] = None
        self._load_config(config_path)
    
    def _load_config(self, config_path: Optional[Path] = None):
        """Load configuration from .vyasa file if it exists."""
        # Try to find .vyasa file
        config_file = None
        
        if config_path and config_path.exists():
            config_file = config_path
        else:
            # Search in VYASA_ROOT first (if set)
            root = os.getenv('VYASA_ROOT')
            if root:
                root_config = Path(root) / '.vyasa'
                if root_config.exists():
                    config_file = root_config
            
            # Then search in current directory
            if not config_file:
                cwd_config = Path.cwd() / '.vyasa'
                if cwd_config.exists():
                    config_file = cwd_config
        
        # Load the config file if found
        if config_file:
            try:
                with open(config_file, 'rb') as f:
                    self._config = tomllib.load(f)
                preset_name = str(self._config.get("theme_preset", "")).strip()
                if preset_name:
                    preset_dir = config_file.parent / ".vyasa-themes"
                    preset_file = preset_dir / f"{preset_name}.toml"
                    if preset_file.exists():
                        with open(preset_file, "rb") as f:
                            preset_cfg = tomllib.load(f)
                        self._config = {**preset_cfg, **self._config}
                self._loaded_config_path = config_file
            except Exception as e:
                self._config = {}
                self._loaded_config_path = None
    
    def get(self, key: str, env_var: str, default: any = None) -> any:
        """Get configuration value with priority: config file > env var > default.
        
        Args:
            key: Key in the .vyasa config file
            env_var: Environment variable name
            default: Default value if not found
            
        Returns:
            Configuration value
        """
        # First check config file
        if key in self._config:
            return self._config[key]
        
        # Then check environment variable
        env_value = os.getenv(env_var)
        if env_value is not None:
            return env_value
        
        # Finally return default
        return default
    
    def get_root_folder(self) -> Path:
        """Get the blog root folder path."""
        root = self.get('root', 'VYASA_ROOT', '.')
        return Path(root).resolve()
    
    def get_blog_title(self) -> str:
        """Get the blog title."""
        title = self.get('title', 'VYASA_TITLE', None)
        if title:
            return title.upper()
        
        # Default to root folder name
        return slug_to_title(self.get_root_folder().name).upper()
    
    def get_theme_primary(self) -> str | None:
        value = self.get('theme_primary', 'VYASA_THEME_PRIMARY', None)
        return str(value).strip() if value else None
    
    def get_theme_preset(self) -> str | None:
        value = self.get('theme_preset', 'VYASA_THEME_PRESET', None)
        return str(value).strip() if value else None
    
    def get_theme_body_font(self) -> str | None:
        value = self.get('theme_body_font', 'VYASA_THEME_BODY_FONT', None)
        return str(value).strip() if value else None
    
    def get_theme_heading_font(self) -> str | None:
        value = self.get('theme_heading_font', 'VYASA_THEME_HEADING_FONT', None)
        return str(value).strip() if value else None
    
    def get_theme_ui_font(self) -> str | None:
        value = self.get('theme_ui_font', 'VYASA_THEME_UI_FONT', None)
        return str(value).strip() if value else None

    def get_theme_tokens(self) -> dict[str, str]:
        tokens = {}
        for key, value in self._config.items():
            if not key.startswith("theme_") or key in {"theme_preset", "theme_primary", "theme_body_font", "theme_heading_font", "theme_ui_font"}:
                continue
            if value is None:
                continue
            token_name = key.removeprefix("theme_").replace("_", "-")
            tokens[token_name] = str(value).strip()
        return tokens
    
    def get_host(self) -> str:
        """Get the server host."""
        return self.get('host', 'VYASA_HOST', '127.0.0.1')
    
    def get_port(self) -> int:
        """Get the server port."""
        port = self.get('port', 'VYASA_PORT', None)
        if port is None:
            return port_for_working_directory(Path.cwd())
        return int(port)
    
    def get_auth(self):
        """Get authentication credentials from config, env, or default (None)."""
        user = self.get('username', 'VYASA_USER', None)
        pwd = self.get('password', 'VYASA_PASSWORD', None)
        return user, pwd

    def _coerce_list(self, value):
        if value is None:
            return []
        if isinstance(value, list):
            return [v for v in value if v is not None and str(v).strip()]
        if isinstance(value, str):
            parts = [v.strip() for v in value.split(",")]
            return [v for v in parts if v]
        return [value]

    def get_auth_required(self):
        """Return auth_required if set, otherwise None."""
        value = self.get('auth_required', 'VYASA_AUTH_REQUIRED', None)
        if value is None:
            return None
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)

    def get_google_oauth(self):
        """Get Google OAuth settings (optional)."""
        cfg = self._config.get('google_oauth', {})
        if not isinstance(cfg, dict):
            cfg = {}

        client_id = cfg.get('client_id') or self.get('google_client_id', 'VYASA_GOOGLE_CLIENT_ID', None)
        client_secret = cfg.get('client_secret') or self.get('google_client_secret', 'VYASA_GOOGLE_CLIENT_SECRET', None)
        allowed_domains = cfg.get('allowed_domains')
        if allowed_domains is None:
            allowed_domains = self.get('google_allowed_domains', 'VYASA_GOOGLE_ALLOWED_DOMAINS', [])
        allowed_emails = cfg.get('allowed_emails')
        if allowed_emails is None:
            allowed_emails = self.get('google_allowed_emails', 'VYASA_GOOGLE_ALLOWED_EMAILS', [])
        default_roles = cfg.get('default_roles')
        if default_roles is None:
            default_roles = self.get('google_default_roles', 'VYASA_GOOGLE_DEFAULT_ROLES', [])

        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "allowed_domains": self._coerce_list(allowed_domains),
            "allowed_emails": self._coerce_list(allowed_emails),
            "default_roles": self._coerce_list(default_roles),
        }

    def get_rbac(self):
        """Get RBAC settings (optional)."""
        cfg = self._config.get('rbac', {})
        if not isinstance(cfg, dict):
            cfg = {}

        enabled = cfg.get('enabled', None)
        enabled_env = os.getenv('VYASA_RBAC_ENABLED')
        if enabled_env is not None:
            enabled = enabled_env.lower() in ('true', '1', 'yes', 'on')
        if enabled is None:
            enabled = bool(cfg.get('rules') or cfg.get('user_roles'))

        default_roles = cfg.get('default_roles', None)
        if default_roles is None:
            default_roles = self.get('rbac_default_roles', 'VYASA_RBAC_DEFAULT_ROLES', [])

        user_roles = cfg.get('user_roles', {})
        if not isinstance(user_roles, dict):
            user_roles = {}

        role_users = cfg.get('role_users', {})
        if not isinstance(role_users, dict):
            role_users = {}

        rules = cfg.get('rules', [])
        if not isinstance(rules, list):
            rules = []

        return {
            "enabled": bool(enabled),
            "default_roles": self._coerce_list(default_roles),
            "user_roles": user_roles,
            "role_users": role_users,
            "rules": rules,
        }

    def get_drawings_passwords(self):
        """Get optional per-drawing passwords keyed by drawing path."""
        cfg = self._config.get('drawings_passwords', {})
        if not isinstance(cfg, dict):
            return {}
        return {str(k).strip('/'): str(v) for k, v in cfg.items() if k and v}
    
    def get_sidebars_open(self) -> bool:
        """Get whether sidebars should be open by default."""
        value = self.get('sidebars_open', 'VYASA_SIDEBARS_OPEN', False)
        # Handle string values from environment variables
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)

    def get_show_hidden(self) -> bool:
        """Get whether hidden files and folders should appear in listings."""
        value = self.get('show_hidden', 'VYASA_SHOW_HIDDEN', False)
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)

    def get_reload_excludes(self) -> list[str]:
        """Get extra reload excludes, merged with sane defaults."""
        defaults = [
            ".git", ".venv", "venv", "node_modules", "dist", "build",
            ".pytest_cache", ".mypy_cache", ".ruff_cache", "__pycache__", ".cache",
        ]
        value = self.get('reload_exclude', 'VYASA_RELOAD_EXCLUDE', [])
        extras = [str(v).strip() for v in self._coerce_list(value) if str(v).strip()]
        return list(dict.fromkeys(defaults + extras))



# Global config instance
_config: Optional[VyasaConfig] = None


def get_config() -> VyasaConfig:
    """Get or create the global configuration instance."""
    global _config
    if _config is None:
        _config = VyasaConfig()
    return _config


def reload_config(config_path: Optional[Path] = None):
    """Reload configuration, optionally from a specific path."""
    global _config
    _config = VyasaConfig(config_path)
    return _config
