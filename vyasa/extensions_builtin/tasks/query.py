from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import argparse
import json
import re
import shlex
from typing import Any, Iterable

from .items_pack import read_kg_pack, read_schema


CONDITION_RE = re.compile(r'([\w-]+)\s*(!=|<=|>=|<|>|~|=)\s*("(?:[^"\\]|\\.)*"|\S+)')


class QueryError(ValueError):
    pass


class QueryAnswer(list[dict[str, Any]]):
    def __init__(self, rows: Iterable[dict[str, Any]], context: str | dict[str, str]):
        super().__init__(rows)
        self.context = context

    def as_dict(self) -> dict[str, Any]:
        return {"context": self.context, "rows": list(self)}


def _unquote(value: str) -> str:
    if not value.startswith('"'):
        return value
    try:
        return str(json.loads(value))
    except json.JSONDecodeError:
        return value[1:-1]


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _stable(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))


def _matches(row: dict[str, Any], field: str, operator: str, expected: str) -> bool:
    current = row.get(field)
    if expected == "_none":
        return (current is None) == (operator == "=")
    if current is None:
        return operator == "!="
    values = current if isinstance(current, list) else [current]
    options = expected.split(",")
    if operator == "=":
        return any(option in values for option in options)
    if operator == "!=":
        return not any(option in values for option in options)
    if operator == "~":
        needle = expected.casefold()
        return any(needle in str(value).casefold() for value in values)
    left, right = _number(values[0]), _number(expected)
    if left is None or right is None:
        return False
    return {
        "<": left < right,
        "<=": left <= right,
        ">": left > right,
        ">=": left >= right,
    }[operator]


class KnowledgeGraphQuery:
    def __init__(self, schema_path: str | Path):
        self.schema_path = Path(schema_path)
        self.schema = read_schema(self.schema_path)
        self.relations = set(self.schema.relations)
        self._graphs: dict[str, dict[str, Any]] = {}
        default_graph = read_kg_pack(self.schema_path)
        context = default_graph.get("kg_context") or {}
        self.default_context = str(context.get("id") or "base")
        self.contexts = list(default_graph.get("kg_contexts") or [])
        self._graphs[self.default_context] = default_graph

    def _context_id(self, requested: str | None) -> str:
        context_id = requested or self.default_context
        if context_id == "latest" and self.contexts:
            return str(max(self.contexts, key=lambda item: (item.get("seq", 0), item.get("id", "")))["id"])
        known = {str(item.get("id")) for item in self.contexts}
        if self.contexts and context_id not in known:
            raise QueryError(f"Unknown KG context: {context_id}")
        if not self.contexts and context_id != "base":
            raise QueryError(f"Unknown KG context: {context_id}")
        return context_id

    def _graph(self, context_id: str) -> dict[str, Any]:
        if context_id not in self._graphs:
            try:
                self._graphs[context_id] = read_kg_pack(self.schema_path, context_id)
            except ValueError as exc:
                raise QueryError(str(exc)) from exc
        return self._graphs[context_id]

    @staticmethod
    def _nodes(graph: dict[str, Any]) -> list[dict[str, Any]]:
        rows = []
        for node in [*graph.get("groups", []), *graph.get("tasks", [])]:
            rows.append({key: value for key, value in node.items() if not key.startswith("__")})
        return sorted(rows, key=lambda row: str(row.get("id", "")))

    @staticmethod
    def _edges(graph: dict[str, Any]) -> list[dict[str, Any]]:
        return sorted(
            (dict(edge) for edge in graph.get("dependency_edges", [])),
            key=lambda edge: (
                str(edge.get("source", "")),
                str(edge.get("relation", edge.get("label", ""))),
                str(edge.get("target", "")),
                str(edge.get("id", "")),
            ),
        )

    def _facts(self, graph: dict[str, Any], context_id: str) -> list[dict[str, Any]]:
        facts: list[dict[str, Any]] = []
        for node in self._nodes(graph):
            entity = node.get("id")
            for field in sorted(key for key in node if key != "id"):
                values = node[field] if isinstance(node[field], list) else [node[field]]
                for value in values:
                    facts.append({"e": entity, "a": field, "v": value, "ref": False, "context": context_id})
        for edge in self._edges(graph):
            relation = str(edge.get("relation") or edge.get("label") or "")
            facts.append(
                {
                    "e": edge.get("source"),
                    "a": relation,
                    "v": edge.get("target"),
                    "ref": True,
                    "relation": relation,
                    "edge_id": edge.get("id"),
                    "context": context_id,
                }
            )
        return facts

    def _require_relation(self, relation: str) -> None:
        if relation not in self.relations:
            raise QueryError(f"Undeclared KG relation: {relation}")

    def _traverse(
        self,
        rows: list[dict[str, Any]],
        graph: dict[str, Any],
        relation: str,
        incoming: bool,
        transitive: bool,
    ) -> list[dict[str, Any]]:
        self._require_relation(relation)
        nodes = {str(node["id"]): node for node in self._nodes(graph)}
        adjacency: dict[str, list[tuple[str, dict[str, Any]]]] = defaultdict(list)
        for edge in self._edges(graph):
            edge_relation = str(edge.get("relation") or edge.get("label") or "")
            if edge_relation != relation:
                continue
            source, target = str(edge.get("source")), str(edge.get("target"))
            start, end = (target, source) if incoming else (source, target)
            adjacency[start].append((end, {"source": source, "relation": relation, "target": target}))
        for values in adjacency.values():
            values.sort(key=lambda item: (item[0], _stable(item[1])))

        seed_paths: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            if row.get("id") is None:
                continue
            seed = str(row["id"])
            path = list(row.get("__path__", []))
            if seed not in seed_paths or _stable(path) < _stable(seed_paths[seed]):
                seed_paths[seed] = path
        seeds = sorted(seed_paths)
        seed_set = set(seeds)
        paths: dict[str, list[dict[str, Any]]] = {}
        frontier = [(seed, seed_paths[seed]) for seed in seeds]
        seen = set(seeds)
        while frontier:
            current, path = frontier.pop(0)
            for target, step in adjacency.get(current, []):
                next_path = [*path, step]
                if target not in seed_set and (target not in paths or _stable(next_path) < _stable(paths[target])):
                    paths[target] = next_path
                if transitive and target not in seen:
                    seen.add(target)
                    frontier.append((target, next_path))
            if not transitive:
                continue
        reached = sorted(paths)
        return [{**nodes[node_id], "__path__": paths[node_id]} for node_id in reached if node_id in nodes]

    def _snapshot(self, context_id: str) -> tuple[dict[str, dict[str, Any]], dict[tuple[str, str, str], dict[str, Any]]]:
        graph = self._graph(context_id)
        nodes = {str(node["id"]): node for node in self._nodes(graph)}
        edges = {}
        for edge in self._edges(graph):
            relation = str(edge.get("relation") or edge.get("label") or "")
            key = (str(edge.get("source")), relation, str(edge.get("target")))
            edges[key] = {key: value for key, value in edge.items() if not key.startswith("__")}
        return nodes, edges

    def _diff(self, before_id: str, after_id: str) -> list[dict[str, Any]]:
        before_nodes, before_edges = self._snapshot(before_id)
        after_nodes, after_edges = self._snapshot(after_id)
        rows: list[dict[str, Any]] = []
        for node_id in sorted(after_nodes.keys() - before_nodes.keys()):
            rows.append({"change": "added", "kind": "node", "id": node_id, "value": after_nodes[node_id]})
        for node_id in sorted(before_nodes.keys() - after_nodes.keys()):
            rows.append({"change": "removed", "kind": "node", "id": node_id, "value": before_nodes[node_id]})
        for node_id in sorted(before_nodes.keys() & after_nodes.keys()):
            before, after = before_nodes[node_id], after_nodes[node_id]
            for field in sorted((before.keys() | after.keys()) - {"id"}):
                if before.get(field) == after.get(field):
                    continue
                change = "added" if field not in before else "removed" if field not in after else "changed"
                rows.append(
                    {
                        "change": change,
                        "kind": "attribute",
                        "id": node_id,
                        "field": field,
                        "before": before.get(field),
                        "after": after.get(field),
                    }
                )
        for key in sorted(after_edges.keys() - before_edges.keys()):
            source, relation, target = key
            rows.append({"change": "added", "kind": "edge", "source": source, "relation": relation, "target": target})
        for key in sorted(before_edges.keys() - after_edges.keys()):
            source, relation, target = key
            rows.append({"change": "removed", "kind": "edge", "source": source, "relation": relation, "target": target})
        for key in sorted(before_edges.keys() & after_edges.keys()):
            before = {k: v for k, v in before_edges[key].items() if k != "id"}
            after = {k: v for k, v in after_edges[key].items() if k != "id"}
            if before != after:
                source, relation, target = key
                rows.append(
                    {
                        "change": "changed",
                        "kind": "edge",
                        "source": source,
                        "relation": relation,
                        "target": target,
                        "before": before,
                        "after": after,
                    }
                )
        return rows

    def previous_context_diff(self, context_id: str) -> dict[str, Any]:
        after_id = self._context_id(context_id)
        ordered = sorted(self.contexts, key=lambda item: (item.get("seq", 0), item.get("id", "")))
        index = next((i for i, item in enumerate(ordered) if str(item.get("id")) == after_id), -1)
        if index <= 0:
            return {"from": "", "to": after_id, "node_ids": []}
        before_id = str(ordered[index - 1]["id"])
        present_ids = {str(node["id"]) for node in self._nodes(self._graph(after_id))}
        changed_ids: set[str] = set()
        for row in self._diff(before_id, after_id):
            if row["kind"] in {"node", "attribute"}:
                changed_ids.add(str(row["id"]))
            elif row["kind"] == "edge":
                changed_ids.update((str(row["source"]), str(row["target"])))
        return {
            "from": before_id,
            "to": after_id,
            "node_ids": sorted(changed_ids & present_ids),
        }

    def run(self, query: str) -> QueryAnswer:
        stages = [stage.strip() for stage in query.split("|") if stage.strip()]
        if not stages:
            raise QueryError("Empty KG query")
        source = shlex.split(stages[0])
        if not source:
            raise QueryError("Missing KG query source")

        context_id = self.default_context
        if source[0] == "diff":
            if len(source) != 3:
                raise QueryError("diff requires two context ids")
            before_id, after_id = self._context_id(source[1]), self._context_id(source[2])
            stream = self._diff(before_id, after_id)
            answer_context: str | dict[str, str] = {"from": before_id, "to": after_id}
            graph = self._graph(after_id)
        elif source[0] == "contexts":
            if len(source) != 1:
                raise QueryError("contexts does not accept a context id")
            stream = sorted((dict(item) for item in self.contexts), key=lambda item: (item.get("seq", 0), item.get("id", "")))
            answer_context = "catalog"
            graph = self._graph(self.default_context)
        elif source[0] in {"nodes", "facts"}:
            if len(source) == 1:
                requested = None
            elif len(source) == 3 and source[1] == "at":
                requested = source[2]
            else:
                raise QueryError(f"Invalid {source[0]} source")
            context_id = self._context_id(requested)
            graph = self._graph(context_id)
            stream = self._nodes(graph) if source[0] == "nodes" else self._facts(graph, context_id)
            answer_context = context_id
        else:
            raise QueryError(f"Unknown KG query source: {source[0]}")

        for stage in stages[1:]:
            verb, _, rest = stage.partition(" ")
            rest = rest.strip()
            if verb == "where":
                conditions = [(field, operator, _unquote(value)) for field, operator, value in CONDITION_RE.findall(rest)]
                if not conditions:
                    raise QueryError("where requires at least one condition")
                stream = [row for row in stream if all(_matches(row, *condition) for condition in conditions)]
            elif verb == "join":
                fields = shlex.split(rest)
                nodes = {str(node["id"]): node for node in self._nodes(graph)}
                for row in stream:
                    node = nodes.get(str(row.get("e", "")), {})
                    row.update({field: node[field] for field in fields if field in node})
            elif verb in {"follow", "follow*", "incoming", "incoming*"}:
                stream = self._traverse(stream, graph, rest, verb.startswith("incoming"), verb.endswith("*"))
            elif verb in {"with", "without"}:
                self._require_relation(rest)
                targets = {
                    str(edge.get("target"))
                    for edge in self._edges(graph)
                    if str(edge.get("relation") or edge.get("label") or "") == rest
                }
                stream = [row for row in stream if (str(row.get("id")) in targets) == (verb == "with")]
            elif verb == "select":
                fields = shlex.split(rest)
                stream = [
                    {**{field: row[field] for field in fields if field in row}, **({"__path__": row["__path__"]} if "__path__" in row else {})}
                    for row in stream
                ]
            elif verb == "group":
                field = rest
                groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
                for row in stream:
                    value = row.get(field)
                    for group_value in value if isinstance(value, list) else [value]:
                        groups[group_value].append(row)
                stream = [{"group": key, "items": groups[key]} for key in sorted(groups, key=_stable)]
            elif verb in {"count", "countd", "sum", "avg"}:
                grouped_rows = bool(stream) and all("items" in row or "__items" in row for row in stream)
                aggregate_groups = stream if grouped_rows else [{"items": stream}]
                output: list[dict[str, Any]] = []
                field = rest
                for group in aggregate_groups:
                    items = group.get("items", group.get("__items", []))
                    row = {key: value for key, value in group.items() if key not in {"items", "__items"}}
                    row["__items"] = items
                    if verb == "count":
                        row["count"] = len(items)
                    elif verb == "countd":
                        values = set()
                        for item in items:
                            raw_value = item.get(field)
                            field_values = raw_value if isinstance(raw_value, list) else [raw_value]
                            values.update(_stable(value) for value in field_values if value is not None)
                        row[f"countd_{field}"] = len(values)
                    else:
                        values = [_number(item.get(field)) for item in items]
                        numbers = [value for value in values if value is not None]
                        row[f"{verb}_{field}"] = round(sum(numbers), 3) if verb == "sum" else (round(sum(numbers) / len(numbers), 3) if numbers else None)
                    output.append(row)
                stream = output
            elif verb == "rate":
                fields = shlex.split(rest)
                if len(fields) not in {2, 3}:
                    raise QueryError("rate requires numerator, denominator, and optional scale")
                scale = _number(fields[2]) if len(fields) == 3 else 1.0
                if scale is None:
                    raise QueryError(f"Invalid rate scale: {fields[2]}")
                for row in stream:
                    numerator, denominator = _number(row.get(fields[0])), _number(row.get(fields[1]))
                    row["rate"] = round(numerator / denominator * scale, 3) if numerator is not None and denominator else None
            elif verb == "sort":
                fields = shlex.split(rest)
                if not fields:
                    raise QueryError("sort requires a field")
                field = fields[0]
                descending = len(fields) > 1 and fields[1] == "desc"
                stream.sort(key=lambda row: (row.get(field) is None, _stable(row.get(field))), reverse=descending)
            elif verb == "limit":
                try:
                    limit = int(rest)
                except ValueError as exc:
                    raise QueryError(f"Invalid limit: {rest}") from exc
                if limit < 0:
                    raise QueryError("limit cannot be negative")
                stream = stream[:limit]
            elif verb in {"paths", "explain"}:
                stream = [{**row, "path": row.get("__path__", [])} for row in stream]
            else:
                raise QueryError(f"Unknown KG query stage: {verb}")

        clean = [{key: value for key, value in row.items() if not key.startswith("__")} for row in stream]
        return QueryAnswer(clean, answer_context)


def run(schema_path: str | Path, query: str) -> QueryAnswer:
    return KnowledgeGraphQuery(schema_path).run(query)


def query_command(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="vyasa kg-query", description="Query a Vyasa Knowledge Graph")
    parser.add_argument("schema", help="Path to kg.schema")
    parser.add_argument("query", help="Knowledge Graph pipeline query")
    args = parser.parse_args(argv)
    try:
        answer = run(args.schema, args.query)
    except (OSError, QueryError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(answer.as_dict(), ensure_ascii=False, sort_keys=True))
    return 0
