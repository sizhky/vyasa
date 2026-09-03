"""The registry of visuals.

Adding a visual is one `Visual(...)` entry. The registry drives fence
registration, the declared capabilities, and the `visuals` gallery, so a new
entry needs no other edit.

Pro: one place to read to learn what exists, which is the point — an agent
lists the registry instead of rediscovering syntax from CSS.
Con: every visual must fit the shared row grammar; anything richer belongs in
its own extension, as Vega-Lite does.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping, Sequence

from .parse import Row
from .render import render_bar, render_card, render_stack


@dataclass(frozen=True)
class Visual:
    name: str
    summary: str
    cell_names: tuple[str, ...]
    render: Callable[[Sequence[Row], Mapping[str, object]], str]
    options: tuple[str, ...]
    example: str


REGISTRY: dict[str, Visual] = {}


def register(visual: Visual) -> Visual:
    REGISTRY[visual.name] = visual
    return visual


SHARED_OPTIONS = ("title", "note", "src", "select", "label_key", "value_key")

register(
    Visual(
        name="card",
        summary="Stat tiles: one big number each, for the figures a reader should carry away.",
        cell_names=("value", "label", "note"),
        render=render_card,
        options=SHARED_OPTIONS + ("columns",),
        example='```card columns=3\n998 | commits\n142 | days with a commit\n7.0 | commits per active day @accent\n```',
    )
)

register(
    Visual(
        name="bar",
        summary="Horizontal bars for comparing rows of one series.",
        cell_names=("label", "value"),
        render=render_bar,
        options=SHARED_OPTIONS + ("total", "max", "sort"),
        example='```bar title="Age of published posts" total=sum\n0-7 days | 117\n8-30 days | 106\n91-120 days | 264 @accent\n```',
    )
)

register(
    Visual(
        name="stack",
        summary="One bar split into shares, for parts of a single whole.",
        cell_names=("label", "value"),
        render=render_stack,
        options=SHARED_OPTIONS + ("total",),
        example='```stack title="Where the files live"\nvyasa/ | 255\ndemo/ | 133\ntests/ | 36\n```',
    )
)


def capabilities() -> tuple[str, ...]:
    """Capabilities the extension declares, derived from the registry.

    >>> "cap:markdown:fence:bar" in capabilities()
    True
    """
    return tuple(f"cap:markdown:fence:{name}" for name in REGISTRY)
