import re


# A `:::tabs` block; slide splitting treats its lines as one block.
TABS_BLOCK = re.compile(r"^:::tabs\s*\n(.*?)^:::", re.MULTILINE | re.DOTALL)


def preprocess_tabs(content):
    tab_data_store = {}
    def replace_tabs_block(match):
        tabs = []
        for tab_match in re.finditer(r"^::tab\{([^\}]+)\}\s*\n(.*?)(?=^::tab\{|\Z)", match.group(1), re.MULTILINE | re.DOTALL):
            attrs = {k: v for k, v in re.findall(r'([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"', tab_match.group(1))}
            if attrs.get("title"):
                tabs.append({"title": attrs["title"], "content": tab_match.group(2).strip(), "attrs": attrs})
        if not tabs:
            return match.group(0)
        title_map = {tab["title"]: tab for tab in tabs}
        index_map = {str(i): tab for i, tab in enumerate(tabs)}
        def resolve_tab_content(tab, stack=None):
            copy_from = tab.get("attrs", {}).get("copy-from")
            if not copy_from:
                return tab["content"]
            stack = stack or set()
            source_tab = index_map.get(copy_from.split(":", 1)[1].strip()) if copy_from.startswith("index:") else index_map.get(copy_from) if copy_from.isdigit() else title_map.get(copy_from)
            if not source_tab or copy_from in stack:
                return tab["content"]
            stack.add(copy_from)
            content = resolve_tab_content(source_tab, stack)
            stack.remove(copy_from)
            fence = "`" * max(4, max((len(run) for run in re.findall(r"`+", content)), default=0) + 1)
            return f"{fence}\n{content}\n{fence}"
        for tab in tabs:
            tab["content"] = resolve_tab_content(tab)
        tab_id = __import__("hashlib").md5(match.group(0).encode()).hexdigest()[:8]
        tab_data_store[tab_id] = [(tab["title"], tab["content"]) for tab in tabs]
        return f'<div class="tab-placeholder" data-tab-id="{tab_id}"></div>'
    return TABS_BLOCK.sub(replace_tabs_block, content), tab_data_store


def render_tabs_html(tab_id, titles, panels, active=0):
    """Tab set markup; `panels[i]` is the already-rendered body of `titles[i]`."""
    parts = [f'<div class="tabs-container" data-tabs-id="{tab_id}">', '<div class="tabs-header">']
    for i, title in enumerate(titles):
        parts.append(f'<button class="tab-button {"active" if i == active else ""}" onclick="switchTab(\'{tab_id}\', {i})">{title}</button>')
    parts.append("</div><div class=\"tabs-content\">")
    for i, panel in enumerate(panels):
        parts.append(f'<div class="tab-panel {"active" if i == active else ""}" data-tab-index="{i}">{panel}</div>')
    parts.append("</div></div>")
    return "\n".join(parts)


def postprocess_tabs(html, tab_data_store, render_tab_content):
    for tab_id, tabs in tab_data_store.items():
        rendered = render_tabs_html(tab_id, [title for title, _ in tabs], [render_tab_content(content) for _, content in tabs])
        html = html.replace(f'<div class="tab-placeholder" data-tab-id="{tab_id}"></div>', rendered)
    return html
