from __future__ import annotations

import json
import re
import secrets
import time

from starlette.responses import JSONResponse, Response

from ...api_catalog import publish_api
from .file_routes import _atomic_write_bytes, _is_local_request, _resolve_ref


_CONNECTOR_TYPES = {"arrow", "line"}
_REF_QUERY = ({"name": "ref", "required": True, "description": "Content-root-safe Excalidraw sidecar path"},)
_CREATE_BODY = {
    "nodes": [{"id": "optional", "text": "Required", "color": "#b2f2bb", "x": 0, "y": 0}],
    "connections": [{"id": "optional", "from": "node-id", "to": "node-id", "text": "optional", "color": "#1e1e1e"}],
}
_PATCH_BODY = {
    "nodes": [{"id": "node-id", "text": "optional", "color": "optional"}],
    "connections": [{"id": "connection-id", "text": "optional", "color": "optional"}],
}
_DELETE_BODY = {
    "nodes": ["node-id"],
    "connections": ["connection-id"],
}


def register_excalidraw_routes(rt, runtime) -> None:
    refresh_path = "/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}/refresh"
    graph_path = "/api/mdx/excalidraw/{path:path}/canvas/{canvas_id}"

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.refresh.status",
        path=refresh_path,
        query=_REF_QUERY,
    )
    def get_refresh(path: str, canvas_id: str, request):
        """Read the refresh revision watched by an open Excalidraw canvas."""
        canvas = _canvas_id(canvas_id)
        file_path = _resolve_ref(path, request, runtime)
        if not canvas or file_path is None:
            return Response(status_code=404)
        from .file_routes import _readonly
        return JSONResponse(
            {"revision": str(_mtime_revision(file_path)), "readonly": _readonly()},
            headers={"Cache-Control": "no-store"},
        )

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.refresh.signal",
        path=refresh_path,
        methods=("POST",),
        query=_REF_QUERY,
        local_only=True,
    )
    def refresh(path: str, canvas_id: str, request):
        """Tell open pages to reload a directly edited Excalidraw scene."""
        canvas = _canvas_id(canvas_id)
        if not _is_local_request(request):
            return Response("Forbidden", status_code=403)
        file_path = _resolve_ref(path, request, runtime)
        if not canvas or file_path is None:
            return Response(status_code=404)
        file_path.touch()
        return JSONResponse({"revision": str(_mtime_revision(file_path))}, headers={"Cache-Control": "no-store"})

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.graph.read",
        path=graph_path,
        query=_REF_QUERY,
    )
    def get_graph(path: str, canvas_id: str, request):
        """Return token-light Excalidraw nodes and connections."""
        resolved = _request_scene(path, canvas_id, request, runtime)
        if resolved is None:
            return Response(status_code=404)
        _file_path, canvas, _data, scene = resolved
        graph = compact_scene(scene)
        graph.update({"document": path.strip("/"), "canvas": canvas, "ref": str(request.query_params.get("ref", ""))})
        return JSONResponse(graph, headers={"Cache-Control": "no-store"})

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.graph.create",
        path=graph_path,
        methods=("POST",),
        query=_REF_QUERY,
        body=_CREATE_BODY,
        local_only=True,
    )
    async def create_graph_elements(path: str, canvas_id: str, request):
        """Add cards and bound connections while preserving the Excalidraw scene."""
        return await _write_graph(path, canvas_id, request, runtime, apply_compact_create)

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.graph.update",
        path=graph_path,
        methods=("PATCH",),
        query=_REF_QUERY,
        body=_PATCH_BODY,
        local_only=True,
    )
    async def update_graph_elements(path: str, canvas_id: str, request):
        """Patch existing Excalidraw node or connection text and colors."""
        return await _write_graph(path, canvas_id, request, runtime, apply_compact_patch)

    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.excalidraw.graph.delete",
        path=graph_path,
        methods=("DELETE",),
        query=_REF_QUERY,
        body=_DELETE_BODY,
        local_only=True,
    )
    async def delete_graph_elements(path: str, canvas_id: str, request):
        """Delete nodes (with their labels and bound connectors) and connections by id."""
        return await _write_graph(path, canvas_id, request, runtime, apply_compact_delete)


async def _write_graph(path, canvas_id, request, runtime, operation):
    if not _is_local_request(request):
        return Response("Forbidden", status_code=403)
    resolved = _request_scene(path, canvas_id, request, runtime)
    if resolved is None:
        return Response(status_code=404)
    file_path, canvas, data, scene = resolved
    try:
        patch = await request.json()
        operation(scene, patch)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    _atomic_write_bytes(file_path, (json.dumps(data, indent=2) + "\n").encode())
    graph = compact_scene(scene)
    graph.update({"document": path.strip("/"), "canvas": canvas, "ref": str(request.query_params.get("ref", ""))})
    return JSONResponse(graph, headers={"Cache-Control": "no-store"})


def compact_scene(scene: dict) -> dict:
    elements = [element for element in scene.get("elements", []) if not element.get("isDeleted")]
    texts = [element for element in elements if element.get("type") == "text"]
    connectors = [element for element in elements if element.get("type") in _CONNECTOR_TYPES]
    shapes = [element for element in elements if element.get("type") not in _CONNECTOR_TYPES | {"text"}]
    used_text_ids: set[str] = set()
    nodes = []
    for shape in shapes:
        labels = _labels_for(shape, texts)
        used_text_ids.update(label["id"] for label in labels)
        nodes.append({
            "id": shape.get("id"),
            "text": "\n".join(label.get("text", "") for label in labels).strip(),
            "color": shape.get("backgroundColor", "transparent"),
        })
    connections = []
    for connector in connectors:
        labels = _labels_for(connector, texts)
        used_text_ids.update(label["id"] for label in labels)
        connections.append({
            "id": connector.get("id"),
            "from": (connector.get("startBinding") or {}).get("elementId"),
            "to": (connector.get("endBinding") or {}).get("elementId"),
            "text": "\n".join(label.get("text", "") for label in labels).strip(),
            "color": connector.get("strokeColor", "#1e1e1e"),
        })
    for label in texts:
        if label.get("id") not in used_text_ids and not label.get("containerId"):
            nodes.append({
                "id": label.get("id"),
                "text": label.get("text", ""),
                "color": label.get("backgroundColor", "transparent"),
            })
    return {"nodes": nodes, "connections": connections}


def apply_compact_patch(scene: dict, patch: dict) -> None:
    if not isinstance(patch, dict):
        raise TypeError("Expected a JSON object")
    elements = [element for element in scene.get("elements", []) if not element.get("isDeleted")]
    by_id = {element.get("id"): element for element in elements}
    texts = [element for element in elements if element.get("type") == "text"]
    for node in _patch_items(patch, "nodes"):
        element = _known_element(by_id, node, "node")
        labels = [element] if element.get("type") == "text" else _labels_for(element, texts)
        if "color" in node:
            color = _color(node["color"], "transparent")
            element["backgroundColor"] = color
            for label in labels:
                label["backgroundColor"] = color
        if "text" in node:
            if not labels:
                raise ValueError(f"Node {node['id']} has no editable text element")
            _set_text(labels[0], str(node["text"]))
        _touch([element, *labels])
    for connection in _patch_items(patch, "connections"):
        element = _known_element(by_id, connection, "connection")
        if element.get("type") not in _CONNECTOR_TYPES:
            raise ValueError(f"Element {connection['id']} is not a connection")
        labels = _labels_for(element, texts)
        if "color" in connection:
            element["strokeColor"] = _color(connection["color"], "#1e1e1e")
        if "text" in connection:
            if not labels:
                raise ValueError(f"Connection {connection['id']} has no editable text element")
            _set_text(labels[0], str(connection["text"]))
        _touch([element, *labels])


def apply_compact_create(scene: dict, payload: dict) -> None:
    if not isinstance(payload, dict):
        raise TypeError("Expected a JSON object")
    elements = scene.setdefault("elements", [])
    if not isinstance(elements, list):
        raise TypeError("Excalidraw elements must be an array")
    active = [element for element in elements if not element.get("isDeleted")]
    by_id = {element.get("id"): element for element in active}
    shapes = [item for item in active if item.get("type") not in _CONNECTOR_TYPES | {"text"}]
    next_x = max((float(item.get("x", 0)) + float(item.get("width", 0)) for item in shapes), default=-80) + 80
    for index, node in enumerate(_patch_items(payload, "nodes")):
        node_id = _new_element_id("node", node.get("id"), by_id)
        text = str(node.get("text") or "").strip()
        if not text:
            raise ValueError("New nodes require text")
        color = _color(node.get("color"), "#ffc9c9")
        x = _number(node.get("x"), next_x + index * 360)
        y = _number(node.get("y"), 0)
        width = _number(node.get("width"), 280, minimum=80)
        height = max(_number(node.get("height"), 120, minimum=50), len(text.splitlines()) * 25 + 32)
        text_id = _new_element_id(f"{node_id}-text", None, by_id)
        shape = _rectangle(node_id, x, y, width, height, color, text_id)
        label = _text_element(text_id, text, x, y, width, height, node_id)
        elements.extend((shape, label))
        by_id[node_id] = shape
        by_id[text_id] = label
    for connection in _patch_items(payload, "connections"):
        connection_id = _new_element_id("connection", connection.get("id"), by_id)
        start = _connection_node(by_id, connection.get("from"), "from")
        end = _connection_node(by_id, connection.get("to"), "to")
        color = _color(connection.get("color"), "#1e1e1e")
        label_text = str(connection.get("text") or "").strip()
        label_id = _new_element_id(f"{connection_id}-text", None, by_id) if label_text else None
        arrow = _arrow(connection_id, start, end, color, label_id)
        elements.append(arrow)
        _bind(start, connection_id, "arrow")
        _bind(end, connection_id, "arrow")
        by_id[connection_id] = arrow
        if label_id:
            label = _connection_text(label_id, label_text, arrow, connection_id)
            elements.append(label)
            by_id[label_id] = label


def apply_compact_delete(scene: dict, patch: dict) -> None:
    if not isinstance(patch, dict):
        raise TypeError("Expected a JSON object")
    elements = scene.get("elements", [])
    active = [element for element in elements if not element.get("isDeleted")]
    by_id = {element.get("id"): element for element in active}
    texts = [element for element in active if element.get("type") == "text"]
    connectors = [element for element in active if element.get("type") in _CONNECTOR_TYPES]
    removal: set[str] = set()
    for node_id in _delete_ids(patch, "nodes"):
        element = by_id.get(node_id)
        if element is None:
            raise ValueError(f"Unknown node {node_id}")
        removal.add(node_id)
        labels = [element] if element.get("type") == "text" else _labels_for(element, texts)
        removal.update(label.get("id") for label in labels)
        for connector in connectors:
            if node_id in {
                (connector.get("startBinding") or {}).get("elementId"),
                (connector.get("endBinding") or {}).get("elementId"),
            }:
                removal.add(connector.get("id"))
                removal.update(label.get("id") for label in _labels_for(connector, texts))
    for connection_id in _delete_ids(patch, "connections"):
        element = by_id.get(connection_id)
        if element is None:
            raise ValueError(f"Unknown connection {connection_id}")
        if element.get("type") not in _CONNECTOR_TYPES:
            raise ValueError(f"Element {connection_id} is not a connection")
        removal.add(connection_id)
        removal.update(label.get("id") for label in _labels_for(element, texts))
    if not removal:
        raise ValueError("No ids supplied to delete")
    scene["elements"] = [element for element in elements if element.get("id") not in removal]
    for element in scene["elements"]:
        bound = element.get("boundElements")
        if isinstance(bound, list):
            element["boundElements"] = [ref for ref in bound if ref.get("id") not in removal]


def _delete_ids(patch: dict, key: str) -> list[str]:
    items = patch.get(key, [])
    if not isinstance(items, list):
        raise TypeError(f"{key} must be an array of ids")
    ids = []
    for item in items:
        element_id = item.get("id") if isinstance(item, dict) else item
        if not isinstance(element_id, str) or not element_id:
            raise TypeError(f"{key} entries must be id strings")
        ids.append(element_id)
    return ids


def _request_scene(path, canvas_id, request, runtime):
    canvas = _canvas_id(canvas_id)
    file_path = _resolve_ref(path, request, runtime)
    if not canvas or file_path is None or not file_path.is_file():
        return None
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    scene = _scene_for(data, canvas)
    return (file_path, canvas, data, scene) if scene is not None else None


def _scene_for(data: dict, canvas: str) -> dict | None:
    if isinstance(data.get("elements"), list):
        return data
    return None


def _labels_for(element: dict, texts: list[dict]) -> list[dict]:
    element_id = element.get("id")
    direct = [text for text in texts if text.get("containerId") == element_id]
    if direct:
        return direct
    groups = set(element.get("groupIds") or [])
    return [text for text in texts if groups.intersection(text.get("groupIds") or [])]


def _patch_items(patch: dict, key: str) -> list[dict]:
    items = patch.get(key, [])
    if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
        raise TypeError(f"{key} must be an array of objects")
    return items


def _known_element(by_id: dict, item: dict, kind: str) -> dict:
    element_id = item.get("id")
    if not element_id or element_id not in by_id:
        raise ValueError(f"Unknown {kind} id: {element_id}")
    return by_id[element_id]


def _set_text(element: dict, text: str) -> None:
    element["text"] = text
    element["originalText"] = text


def _rectangle(element_id, x, y, width, height, color, text_id) -> dict:
    element = _base_element(element_id, "rectangle", x, y, width, height)
    element.update({
        "backgroundColor": color,
        "roundness": {"type": 3},
        "boundElements": [{"id": text_id, "type": "text"}],
    })
    return element


def _text_element(element_id, text, x, y, width, height, container_id) -> dict:
    lines = text.splitlines() or [text]
    font_size = 20
    text_height = max(font_size * 1.25 * len(lines), font_size * 1.25)
    element = _base_element(element_id, "text", x + 16, y + (height - text_height) / 2, width - 32, text_height)
    element.update({
        "strokeWidth": 1,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "roundness": None,
        "fontSize": font_size,
        "fontFamily": 1,
        "text": text,
        "textAlign": "center",
        "verticalAlign": "middle",
        "containerId": container_id,
        "originalText": text,
        "lineHeight": 1.25,
        "baseline": int(text_height - 5),
    })
    return element


def _arrow(element_id, start, end, color, text_id) -> dict:
    if start["id"] == end["id"]:
        raise ValueError("Self-connections require explicit Excalidraw geometry")
    start_x = float(start.get("x", 0)) + float(start.get("width", 0)) / 2
    start_y = float(start.get("y", 0)) + float(start.get("height", 0)) / 2
    end_x = float(end.get("x", 0)) + float(end.get("width", 0)) / 2
    end_y = float(end.get("y", 0)) + float(end.get("height", 0)) / 2
    dx, dy = end_x - start_x, end_y - start_y
    element = _base_element(element_id, "arrow", start_x, start_y, abs(dx), abs(dy))
    element.update({
        "strokeColor": color,
        "backgroundColor": "transparent",
        "roundness": {"type": 2},
        "boundElements": ([{"id": text_id, "type": "text"}] if text_id else []),
        "points": [[0, 0], [dx, dy]],
        "startBinding": {"elementId": start["id"], "focus": 0, "gap": 8},
        "endBinding": {"elementId": end["id"], "focus": 0, "gap": 8},
        "lastCommittedPoint": None,
        "startArrowhead": None,
        "endArrowhead": "arrow",
    })
    return element


def _connection_text(element_id, text, arrow, container_id) -> dict:
    x = float(arrow["x"]) + float(arrow["points"][-1][0]) / 2
    y = float(arrow["y"]) + float(arrow["points"][-1][1]) / 2
    return _text_element(element_id, text, x - 70, y - 20, 140, 40, container_id)


def _base_element(element_id, element_type, x, y, width, height) -> dict:
    return {
        "type": element_type,
        "version": 1,
        "versionNonce": _nonce(),
        "isDeleted": False,
        "id": element_id,
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "angle": 0,
        "x": x,
        "y": y,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "width": width,
        "height": height,
        "seed": _nonce(),
        "groupIds": [],
        "frameId": None,
        "roundness": None,
        "boundElements": [],
        "updated": int(time.time() * 1000),
        "link": None,
        "locked": False,
    }


def _new_element_id(prefix: str, requested, by_id: dict) -> str:
    if requested is not None:
        element_id = str(requested).strip()
        if not _valid_id(element_id):
            raise ValueError(f"Invalid element id: {element_id}")
        if element_id in by_id:
            raise ValueError(f"Element id already exists: {element_id}")
        return element_id
    while True:
        element_id = f"{prefix}-{secrets.token_hex(5)}"
        if element_id not in by_id:
            return element_id


def _connection_node(by_id: dict, element_id, field: str) -> dict:
    element = by_id.get(str(element_id or ""))
    if element is None or element.get("type") in _CONNECTOR_TYPES | {"text"}:
        raise ValueError(f"Unknown connection {field} node: {element_id}")
    return element


def _bind(element: dict, bound_id: str, bound_type: str) -> None:
    bindings = element.setdefault("boundElements", [])
    if not any(binding.get("id") == bound_id for binding in bindings):
        bindings.append({"id": bound_id, "type": bound_type})


def _color(value, default: str) -> str:
    color = str(value or default).strip()
    if color != "transparent" and not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
        raise ValueError(f"Invalid Excalidraw color: {color}")
    return color


def _number(value, default: float, minimum: float | None = None) -> float:
    number = float(default if value is None else value)
    if minimum is not None and number < minimum:
        raise ValueError(f"Value must be at least {minimum:g}")
    return number


def _nonce() -> int:
    return secrets.randbelow(2_147_483_646) + 1


def _touch(elements: list[dict]) -> None:
    now = int(time.time() * 1000)
    for element in {item.get("id"): item for item in elements}.values():
        element["version"] = int(element.get("version", 0)) + 1
        element["versionNonce"] = int(element.get("versionNonce", 0)) + 1
        element["updated"] = now


def _canvas_id(canvas_id) -> str:
    value = str(canvas_id or "").strip()
    return value if _valid_id(value) else ""


def _valid_id(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", value))


def _mtime_revision(file_path) -> int:
    try:
        return file_path.stat().st_mtime_ns
    except FileNotFoundError:
        return 0


def browser_autosave_conflicts(file_path, request) -> bool:
    headers = getattr(request, "headers", {})
    if not headers.get("sec-fetch-mode"):
        return False
    query = getattr(request, "query_params", {})
    supplied = str(query.get("revision", ""))
    if not supplied or not file_path.exists():
        return False
    return supplied != str(_mtime_revision(file_path))
