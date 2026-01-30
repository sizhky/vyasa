"""Configuration management for Bloggy.

Supports loading configuration from:
1. .bloggy file (TOML format) in the current directory or blog root
2. Environment variables (as fallback)
3. Default values

Priority: .bloggy file > environment variables > defaults
"""

import os
import tomllib
from pathlib import Path
from typing import Optional


class BloggyConfig:

    """Configuration handler for Bloggy."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize configuration.
        
        Args:
            config_path: Optional path to .bloggy file. If not provided, will search
                        in current directory and BLOGGY_ROOT.
        """
        self._config = {}
        self._load_config(config_path)
    
    def _load_config(self, config_path: Optional[Path] = None):
        """Load configuration from .bloggy file if it exists."""
        # Try to find .bloggy file
        config_file = None
        
        if config_path and config_path.exists():
            config_file = config_path
        else:
            # Search in BLOGGY_ROOT first (if set)
            root = os.getenv('BLOGGY_ROOT')
            if root:
                root_config = Path(root) / '.bloggy'
                if root_config.exists():
                    config_file = root_config
            
            # Then search in current directory
            if not config_file:
                cwd_config = Path.cwd() / '.bloggy'
                if cwd_config.exists():
                    config_file = cwd_config
        
        # Load the config file if found
        if config_file:
            try:
                with open(config_file, 'rb') as f:
                    self._config = tomllib.load(f)
                print(f"✓ Loaded configuration from: {config_file}")
            except Exception as e:
                print(f"Warning: Failed to load {config_file}: {e}")
                self._config = {}
    
    def get(self, key: str, env_var: str, default: any = None) -> any:
        """Get configuration value with priority: config file > env var > default.
        
        Args:
            key: Key in the .bloggy config file
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
        root = self.get('root', 'BLOGGY_ROOT', '.')
        return Path(root).resolve()
    
    def get_blog_title(self) -> str:
        """Get the blog title."""
        from .core import slug_to_title  # Import here to avoid circular dependency
        
        title = self.get('title', 'BLOGGY_TITLE', None)
        if title:
            return title.upper()
        
        # Default to root folder name
        return slug_to_title(self.get_root_folder().name).upper()
    
    def get_host(self) -> str:
        """Get the server host."""
        return self.get('host', 'BLOGGY_HOST', '127.0.0.1')
    
    def get_port(self) -> int:
        """Get the server port."""
        port = self.get('port', 'BLOGGY_PORT', 5001)
        return int(port)
    
    def get_auth(self):
        """Get authentication credentials from config, env, or default (None)."""
        user = self.get('username', 'BLOGGY_USER', None)
        pwd = self.get('password', 'BLOGGY_PASSWORD', None)
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
        value = self.get('auth_required', 'BLOGGY_AUTH_REQUIRED', None)
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

        client_id = cfg.get('client_id') or self.get('google_client_id', 'BLOGGY_GOOGLE_CLIENT_ID', None)
        client_secret = cfg.get('client_secret') or self.get('google_client_secret', 'BLOGGY_GOOGLE_CLIENT_SECRET', None)
        allowed_domains = cfg.get('allowed_domains')
        if allowed_domains is None:
            allowed_domains = self.get('google_allowed_domains', 'BLOGGY_GOOGLE_ALLOWED_DOMAINS', [])
        allowed_emails = cfg.get('allowed_emails')
        if allowed_emails is None:
            allowed_emails = self.get('google_allowed_emails', 'BLOGGY_GOOGLE_ALLOWED_EMAILS', [])
        default_roles = cfg.get('default_roles')
        if default_roles is None:
            default_roles = self.get('google_default_roles', 'BLOGGY_GOOGLE_DEFAULT_ROLES', [])

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
        enabled_env = os.getenv('BLOGGY_RBAC_ENABLED')
        if enabled_env is not None:
            enabled = enabled_env.lower() in ('true', '1', 'yes', 'on')
        if enabled is None:
            enabled = bool(cfg.get('rules') or cfg.get('user_roles'))

        default_roles = cfg.get('default_roles', None)
        if default_roles is None:
            default_roles = self.get('rbac_default_roles', 'BLOGGY_RBAC_DEFAULT_ROLES', [])

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
    
    def get_sidebars_open(self) -> bool:
        """Get whether sidebars should be open by default."""
        value = self.get('sidebars_open', 'BLOGGY_SIDEBARS_OPEN', True)
        # Handle string values from environment variables
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        return bool(value)



# Global config instance
_config: Optional[BloggyConfig] = None


def get_config() -> BloggyConfig:
    """Get or create the global configuration instance."""
    global _config
    if _config is None:
        _config = BloggyConfig()
    return _config


def reload_config(config_path: Optional[Path] = None):
    """Reload configuration, optionally from a specific path."""
    global _config
    _config = BloggyConfig(config_path)
    return _config
