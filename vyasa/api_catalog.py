from __future__ import annotations

import inspect
import re
from typing import get_type_hints


_published_apis: dict[str, dict[str, dict]] = {}


def publish_api(
    rt,
    *,
    namespace: str,
    operation_id: str,
    path: str,
    methods=("GET",),
    query=(),
    body=None,
    local_only: bool = False,
):
    """Register a route and publish its inspectable API contract."""
    def decorator(handler):
        signature = inspect.signature(handler)
        path_arguments = set(re.findall(r"\{([A-Za-z_][A-Za-z0-9_]*)(?::[^}]+)?\}", path))
        missing = path_arguments.difference(signature.parameters)
        if missing:
            raise TypeError(f"Published API {operation_id} path arguments missing from signature: {sorted(missing)}")
        try:
            hints = get_type_hints(handler)
        except (NameError, TypeError):
            hints = {}
        arguments = [
            {
                "name": name,
                "required": parameter.default is inspect.Parameter.empty,
                "type": _type_name(hints.get(name, parameter.annotation)),
            }
            for name, parameter in signature.parameters.items()
            if name != "request"
        ]
        operation = {
            "id": operation_id,
            "methods": list(methods),
            "path": path,
            "signature": f"{handler.__name__}{str(signature).replace(chr(39), '')}",
            "arguments": arguments,
            "description": inspect.getdoc(handler) or "",
        }
        if query:
            operation["query"] = list(query)
        if body is not None:
            operation["body"] = body
        if local_only:
            operation["local_only"] = True
        _published_apis.setdefault(namespace, {})[operation_id] = operation
        return rt(path, methods=list(methods))(handler)
    return decorator


def namespace_catalog(namespace: str) -> dict:
    operations = list(sorted(_published_apis.get(namespace, {}).values(), key=lambda item: item["id"]))
    catalog_operation = next((item for item in operations if item["id"] == f"{namespace}.catalog.read"), None)
    return {
        "namespace": namespace,
        "href": catalog_operation["path"] if catalog_operation else None,
        "operations": operations,
    }


def build_vyasa_api_catalog(runtime=None) -> dict:
    enabled = set(runtime.plan.enabled_ids) if runtime is not None else None
    catalogs = [
        namespace_catalog(namespace)
        for namespace in sorted(_published_apis)
        if namespace == "vyasa" or enabled is None or namespace in enabled
    ]
    return {"service": "vyasa", "catalog": "/api/catalog", "catalogs": catalogs}


def _type_name(annotation) -> str:
    if annotation is inspect.Parameter.empty:
        return "any"
    return getattr(annotation, "__name__", str(annotation).replace("typing.", ""))
