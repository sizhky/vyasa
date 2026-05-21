from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class RuntimeServices:
    values: dict[str, Any]

    def __getattr__(self, name: str) -> Any:
        try:
            return self.values[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


_ACTIVE_SERVICES: RuntimeServices | None = None


def set_runtime_services(values: dict[str, Any] | RuntimeServices | None) -> RuntimeServices | None:
    global _ACTIVE_SERVICES
    if values is None:
        _ACTIVE_SERVICES = None
    elif isinstance(values, RuntimeServices):
        _ACTIVE_SERVICES = values
    else:
        _ACTIVE_SERVICES = RuntimeServices(dict(values))
    return _ACTIVE_SERVICES


def get_runtime_services() -> RuntimeServices:
    if _ACTIVE_SERVICES is None:
        raise RuntimeError("Runtime services not initialized")
    return _ACTIVE_SERVICES
