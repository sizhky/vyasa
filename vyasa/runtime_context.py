from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .auth.context import get_auth_from_request, get_roles_from_request
from .auth.policy import is_allowed


class RuntimeAccess(Protocol):
    config: Any
    logger: Any

    def roles_for_request(self, request): ...
    def can_read_post(self, path: str, request) -> bool: ...
    def auth_for_request(self, request) -> dict: ...
    def current_rbac_rules(self): ...


@dataclass(frozen=True)
class RuntimeContext:
    config: Any
    rbac_rules: Any
    rbac_cfg: Any
    google_oauth_cfg: Any
    logger: Any

    def _value(self, item):
        return item() if callable(item) else item

    def roles_for_request(self, request):
        return get_roles_from_request(
            request,
            self._value(self.rbac_rules),
            self._value(self.rbac_cfg),
            self._value(self.google_oauth_cfg),
            self.config._coerce_list,
        )

    def can_read_post(self, path: str, request) -> bool:
        roles = self.roles_for_request(request)
        return roles is None or is_allowed(f"/posts/{path}", roles or [], self._value(self.rbac_rules))

    def auth_for_request(self, request) -> dict:
        return get_auth_from_request(
            request,
            self._value(self.rbac_rules),
            self._value(self.rbac_cfg),
            self._value(self.google_oauth_cfg),
            self.config._coerce_list,
        ) or {}

    def current_rbac_rules(self):
        return self._value(self.rbac_rules)
