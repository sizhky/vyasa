from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Literal


STORE_SYNTAX_NAME = "KG Pack"
STORE_FILE_EXTENSION = ".kg.nodes"
DICT_FILE_EXTENSION = ".kg.schema"
PALETTE_FILE_EXTENSION = ".palettes.json"


class RecordKind(StrEnum):
    GROUP = "group"
    NODE = "node"
    EDGE = "edge"


class QueryKind(StrEnum):
    GET = "get"
    NEIGHBORS = "neighbors"
    INCOMING = "incoming"
    OUTGOING = "outgoing"
    LIST_GROUPS = "list_groups"
    LIST_BY_ATTR = "list_by_attr"
    COLOR_MODES = "color_modes"
    FILTER_POLICY = "filter_policy"
    HOVER_POLICY = "hover_policy"
    PROJECTIONS = "projections"
    PROJECTION_GROUPS = "projection_groups"
    VALIDATE = "validate"
    COMPILE = "compile"
    CHECKED_STATE = "checked_state"


class MutationKind(StrEnum):
    UPSERT_RECORD = "upsert_record"
    DELETE_RECORD = "delete_record"
    BULK_SET_ATTR = "bulk_set_attr"
    MOVE_NODE = "move_node"
    RENAME_ID = "rename_id"
    UPSERT_EDGE = "upsert_edge"
    DELETE_EDGE = "delete_edge"
    SET_PALETTE_VALUE = "set_palette_value"
    SET_DEFAULT_COLOR_BY = "set_default_color_by"
    SET_EDGE_COLOR_BY = "set_edge_color_by"
    SET_FILTER_POLICY = "set_filter_policy"
    SET_HOVER_POLICY = "set_hover_policy"
    UPSERT_PROJECTION = "upsert_projection"
    DELETE_PROJECTION = "delete_projection"
    SET_CHECKED_STATE = "set_checked_state"


class ValidationCode(StrEnum):
    DUPLICATE_ID = "duplicate_id"
    MISSING_NODE = "missing_node"
    MISSING_GROUP = "missing_group"
    DANGLING_EDGE = "dangling_edge"
    UNKNOWN_COLOR_VALUE = "unknown_color_value"
    MISSING_PROJECTION_ATTR = "missing_projection_attr"


@dataclass(frozen=True)
class LedgerPaths:
    records_source: str
    palette_source: str = ""


@dataclass(frozen=True)
class FilterPolicy:
    whitelist: tuple[str, ...] = ()
    blacklist: tuple[str, ...] = ()


@dataclass(frozen=True)
class HoverPolicy:
    attrs: tuple[str, ...] = ()


@dataclass(frozen=True)
class CheckedStateContract:
    checked_node_ids: tuple[str, ...] = ()
    persistence_id: str = ""


@dataclass(frozen=True)
class ColorModeContract:
    attr: str
    palette: dict[str, str] = field(default_factory=dict)
    continuous: bool = False


@dataclass(frozen=True)
class ProjectionContract:
    id: str
    groups_from: tuple[str, ...]
    label: str = ""
    caption: str = ""
    default_color_by: str = ""
    hover_attrs: tuple[str, ...] = ()
    edge_label_from: str = ""


@dataclass(frozen=True, kw_only=True)
class LedgerRecord:
    kind: RecordKind
    id: str
    label: str = ""
    attrs: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GroupRecord(LedgerRecord):
    kind: Literal[RecordKind.GROUP] = RecordKind.GROUP
    parent: str | None = None


@dataclass(frozen=True)
class NodeRecord(LedgerRecord):
    kind: Literal[RecordKind.NODE] = RecordKind.NODE
    group: str | None = None


@dataclass(frozen=True)
class EdgeRecord(LedgerRecord):
    kind: Literal[RecordKind.EDGE] = RecordKind.EDGE
    source: str = ""
    target: str = ""


@dataclass(frozen=True)
class RecordSelector:
    kind: RecordKind | None = None
    ids: tuple[str, ...] = ()
    attr_equals: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class QueryRequest:
    kind: QueryKind
    target_id: str = ""
    selector: RecordSelector = field(default_factory=RecordSelector)
    projection_id: str = ""
    include_edges: bool = True


@dataclass(frozen=True)
class BulkAttrPatch:
    selector: RecordSelector
    key: str
    value: Any


@dataclass(frozen=True)
class MutationRequest:
    kind: MutationKind
    record: LedgerRecord | None = None
    bulk_patch: BulkAttrPatch | None = None
    selector: RecordSelector = field(default_factory=RecordSelector)
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ValidationFinding:
    code: ValidationCode
    message: str
    record_id: str = ""
    refs: tuple[str, ...] = ()
