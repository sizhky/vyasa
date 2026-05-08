import html
from pathlib import Path


TREE_SUFFIXES = (".md", ".pdf", ".tree")


def parse_tree_table(source: str | Path) -> dict:
    text = Path(source).read_text(encoding="utf-8") if isinstance(source, Path) else str(source)
    sheet = ""
    hierarchy: list[str] = []
    columns: list[str] = []
    rows: list[dict] = []
    stack: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            key, _, value = stripped[1:].partition(":")
            key = key.strip().lower()
            value = value.strip()
            if key == "sheet":
                sheet = value
            elif key == "hierarchy":
                hierarchy = [part.strip() for part in value.split("|") if part.strip()]
                stack = [""] * len(hierarchy)
            elif key == "columns":
                columns = [part.strip() for part in value.split("|") if part.strip()]
            continue
        depth = 0
        for ch in raw_line[: len(raw_line) - len(raw_line.lstrip(" \t"))]:
            depth += 4 if ch == "\t" else 1
        depth //= 4
        cells = [cell.strip() for cell in stripped.split("\t")]
        if not cells or not cells[0]:
            continue
        if not hierarchy:
            hierarchy = ["Level 1", "Level 2", "Level 3", "Item"]
            stack = [""] * len(hierarchy)
        depth = min(depth, len(hierarchy) - 1)
        if len(cells) == 1:
            stack[depth] = cells[0]
            for idx in range(depth + 1, len(stack)):
                stack[idx] = ""
            continue
        path = [""] * len(hierarchy)
        for idx in range(depth):
            path[idx] = stack[idx]
        path[depth] = cells[0]
        values = cells[1:] + [""] * max(0, len(columns) - len(cells) + 1)
        rows.append({"path": path, "values": values[: len(columns)]})
    return {"sheet": sheet, "hierarchy": hierarchy, "columns": columns, "rows": rows}


def render_tree_table_html(source: str | Path, *, include_heading: bool = True) -> str:
    table = parse_tree_table(source)
    headers = table["hierarchy"] + table["columns"]
    head_html = "".join(f"<th>{html.escape(header)}</th>" for header in headers)
    body_rows = []
    for row in table["rows"]:
        path_cells = []
        for idx, value in enumerate(row["path"]):
            cls = f' class="vyasa-tree-table-h{min(idx + 1, 3)}"' if value else ""
            path_cells.append(f"<td{cls}>{html.escape(value) if value else '&nbsp;'}</td>")
        meta_cells = [f'<td class="vyasa-tree-table-meta">{html.escape(value) if value else "&nbsp;"}</td>' for value in row["values"]]
        body_rows.append("<tr>" + "".join(path_cells + meta_cells) + "</tr>")
    title = html.escape(table["sheet"] or "Tree Table")
    summary = f'{len(table["rows"])} rows'
    header_html = ""
    if include_heading:
        header_html = (
            f'<div class="mb-4"><div class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tree Table</div>'
            f'<h1 class="mt-1 text-3xl font-semibold">{title}</h1><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{summary}</p></div>'
        )
    return f'<section class="vyasa-tree-doc">{header_html}<div class="vyasa-tree-table-wrap"><table class="vyasa-tree-table"><thead><tr>{head_html}</tr></thead><tbody>{"".join(body_rows)}</tbody></table></div></section>'
