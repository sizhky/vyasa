from vyasa.extensions_builtin.tasks.items_store_contracts import (
    BulkAttrPatch,
    MutationKind,
    NodeRecord,
    QueryKind,
    RecordKind,
    STORE_SYNTAX_NAME,
)


def test_items_ledger_contract_names_are_stable():
    assert STORE_SYNTAX_NAME == "Items Ledger"
    assert QueryKind.NEIGHBORS == "neighbors"
    assert MutationKind.BULK_SET_ATTR == "bulk_set_attr"


def test_items_ledger_bulk_attr_patch_targets_many_records():
    patch = BulkAttrPatch(RecordKind.NODE, ("a", "b"), "status", "done")

    assert patch.ids == ("a", "b")
    assert patch.key == "status"
    assert patch.value == "done"


def test_items_ledger_node_record_keeps_attrs_separate():
    node = NodeRecord(id="n-api", label="API", group="g-platform", attrs={"owner": "eng"})

    assert node.kind == RecordKind.NODE
    assert node.group == "g-platform"
    assert node.attrs == {"owner": "eng"}
