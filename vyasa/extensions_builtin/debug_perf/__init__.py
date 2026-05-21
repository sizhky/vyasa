from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass

from ...extensions import ExtensionMeta, VyasaExtensionBase


@dataclass(frozen=True)
class TraceEvent:
    name: str
    duration_ms: float
    attrs: dict


_EVENTS: ContextVar[list[TraceEvent] | None] = ContextVar("vyasa_debug_perf_events", default=None)


class DebugPerfExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.trace.handler(_record_span)


def _record_span(*, name: str, duration_ms: float, attrs: dict) -> None:
    events = _EVENTS.get()
    if events is not None:
        events.append(TraceEvent(name, duration_ms, attrs))


def start_trace() -> object:
    return _EVENTS.set([])


def finish_trace(token: object) -> list[TraceEvent]:
    events = _EVENTS.get() or []
    _EVENTS.reset(token)
    return events


EXTENSION = DebugPerfExtension(
    ExtensionMeta("debug_perf", "route", ("cap:trace:debug_perf",), scope_disable=True)
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META", "TraceEvent", "start_trace", "finish_trace"]
