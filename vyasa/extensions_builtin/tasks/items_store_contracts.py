from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Literal

STORE_SYNTAX_NAME = "Items Ledger"
STORE_FILE_EXTENSION = ".items.jsonl"


class RecordKind(StrEnum):
    GROUP = "group"; NODE = "node"; EDGE = "edge"


class QueryKind(StrEnum):
    GET = "get"; NEIGHBORS = "neighbors"; INCOMING = "incoming"; OUTGOING = "outgoing"
    LIST_GROUPS = "list_groups"; LIST_BY_ATTR = "list_by_attr"; COLOR_MODES = "color_modes"
    FILTERS = "filters"; PROJECTIONS = "projections"; VALIDATE = "validate"


class MutationKind(StrEnum):
    UPSERT_RECORD = "upsert_record"; DELETE_RECORD = "delete_record"
    BULK_SET_ATTR = "bulk_set_attr"; MOVE_NODE = "move_node"; RENAME_ID = "rename_id"
    SET_PALETTE_VALUE = "set_palette_value"; SET_DEFAULT_COLOR_BY = "set_default_color_by"
    SET_FILTER_POLICY = "set_filter_policy"; SET_HOVER_ATTRS = "set_hover_attrs"
    UPSERT_PROJECTION = "upsert_projection"


@dataclass(frozen=True, kw_only=True)
class LedgerRecord:
    kind: RecordKind; id: str; label: str = ""; attrs: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GroupRecord(LedgerRecord):
    kind: Literal[RecordKind.GROUP] = RecordKind.GROUP; parent: str | None = None


@dataclass(frozen=True)
class NodeRecord(LedgerRecord):
    kind: Literal[RecordKind.NODE] = RecordKind.NODE; group: str | None = None


@dataclass(frozen=True)
class EdgeRecord(LedgerRecord):
    kind: Literal[RecordKind.EDGE] = RecordKind.EDGE; source: str = ""; target: str = ""


@dataclass(frozen=True)
class BulkAttrPatch:
    target_kind: RecordKind; ids: tuple[str, ...]; key: str; value: Any


@dataclass(frozen=True)
class ProjectionContract:
    id: str; groups_from: tuple[str, ...]; label: str = ""; default_color_by: str = ""
    hover_attrs: tuple[str, ...] = (); edge_label_from: str = ""
