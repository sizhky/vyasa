"""Configuration management for Bloggy.

Supports loading configuration from:
1. .bloggy file (TOML or YAML format) in the current directory or blog root
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
            except Exception as toml_error:
                self._config = self._load_non_toml_config(config_file)
                if self._config:
                    print(f"✓ Loaded configuration from: {config_file} (non-TOML)")
                else:
                    print(f"Warning: Failed to load {config_file}: {toml_error}")
                    self._config = {}

    def _load_non_toml_config(self, config_file: Path) -> dict:
        try:
            content = config_file.read_text(encoding="utf-8")
        except Exception:
            return {}

        parsed = None
        try:
            import yaml
            parsed = yaml.safe_load(content)
        except Exception:
            parsed = None

        if isinstance(parsed, dict):
            return parsed

        return self._parse_simple_config(content)

    def _parse_simple_config(self, content: str) -> dict:
        config = {}
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if ":" not in stripped:
                continue
            key, value = stripped.split(":", 1)
            key = key.strip()
            value = value.strip()
            if not key:
                continue
            lowered = value.lower()
            if lowered in ("true", "false"):
                config[key] = lowered == "true"
            else:
                config[key] = value
        return config
    
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
