"""Markdown documents whose frontmatter names a marimo-studio view.

Frontmatter contract:

    marimo:
      notebook: ../notebooks/explore.py   # relative to this document
      view: datasets                      # an existing Studio view of that notebook
      url: http://localhost:2718          # the `marimo run` server for that notebook

Live: Vyasa renders the document itself. Each run of adjacent `<marimo-cell>` tags becomes one
frame of the view, which shows only that run and reports its height to the Vyasa page.
Fallback (server down, or static build): optional blocks are removed and required blocks
keep their prose with a placeholder for each cell.
"""
import re
import urllib.request
from pathlib import Path
from types import SimpleNamespace

from fasthtml.core import respond
from fasthtml.common import Div, H1, Script, to_xml

from ...document_pages import PAGE_TITLE_CLS, DocumentPage
from ...helpers import parse_frontmatter, resolve_markdown_title_text
from ..markdown.renderer import from_md

BLOCK_RE = re.compile(r"<!--\s*marimo-block\s+(optional|required)\s*-->(.*?)<!--\s*/marimo-block\s*-->", re.S)
CELL_RE = re.compile(r'<marimo-cell\s+name="([^"]+)"\s*>\s*</marimo-cell>')
RUN_RE = re.compile(r'(?:<marimo-cell\s+name="[^"]+"\s*>\s*</marimo-cell>\s*)+')
STATIC_URL_RE = re.compile(r'(href|src)="/static/')
# Studio rejects import maps in Vanilla views, and module scripts cannot load from Vyasa's origin.
MODULE_SCRIPT_RE = re.compile(r'<script[^>]*type="module"[^>]*></script>|<script[^>]*type="importmap"[^>]*>.*?</script>', re.S)
THEME_CONTAINER_RE = re.compile(r'<div[^>]*id="page-container"[^>]*?(style=(["\']).*?\2)')
# The view is a sandboxed document at origin `null`: storage access throws, and module
# scripts from the Vyasa origin fail CORS. Memory storage lets Vyasa's head scripts run.
VIEW_HEAD_START = """<script>try { window.localStorage; } catch (error) {
  const items = new Map();
  Object.defineProperty(window, "localStorage", { configurable: true, value: {
    getItem: (key) => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    clear: () => items.clear(),
    key: (index) => [...items.keys()][index] ?? null,
    get length() { return items.size; },
  } });
}</script>"""
# Studio's projection variables: marimo cells otherwise use marimo's own fonts and colors.
# A frame whose document and frame element differ in color-scheme gets an opaque background.
# daisyUI sets `color-scheme: dark` on :root and Studio's outer document sets none, so both levels use `normal`.
VIEW_HEAD_END = """<style>
marimo-cell {
  --marimo-cell-font: var(--vyasa-font-body, inherit);
  --marimo-cell-heading-font: var(--vyasa-font-heading, var(--vyasa-font-body, inherit));
  --marimo-cell-foreground: var(--vyasa-text, currentColor);
  --marimo-cell-muted-foreground: var(--vyasa-text-muted, currentColor);
  --marimo-cell-background: transparent;
  --marimo-cell-surface: var(--vyasa-surface, transparent);
  --marimo-cell-border-color: var(--vyasa-border, currentColor);
  --marimo-cell-accent: var(--vyasa-primary, LinkText);
}
marimo-cell .prose :where(code)::before, marimo-cell .prose :where(code)::after { content: none; }
html, body, #page-container { background: transparent !important; }
:root { color-scheme: normal !important; }
</style>"""
# Measure `#app-shell`, not the document: the document is as tall as the frame, so it never shrinks.
RUN_SCRIPT = """<style>[data-vyasa-marimo-run] { display: none; }</style><script>(() => {
  const run = new URLSearchParams(location.search).get("run") || "0";
  const section = document.querySelector(`[data-vyasa-marimo-run="${CSS.escape(run)}"]`);
  if (section) section.style.display = "block";
  const shell = document.getElementById("app-shell");
  const report = () => window.top.postMessage({ type: "vyasa-marimo-height", height: Math.ceil(shell.getBoundingClientRect().height) }, "*");
  new ResizeObserver(report).observe(shell);
  report();
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "vyasa-theme") document.documentElement.classList.toggle("dark", !!event.data.dark);
  });
})();</script>"""
# Vyasa page side: the message comes from the view inside Studio's outer document, which is the frame's window.
# The page answers each view with its own light or dark mode, and resends it when the mode changes.
FRAME_HEIGHT_SCRIPT = """window.vyasaMarimoFrames || (() => {
  window.vyasaMarimoFrames = new Set();
  const theme = () => ({ type: "vyasa-theme", dark: document.documentElement.classList.contains("dark") });
  window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "vyasa-marimo-height" || !event.source) return;
    for (const frame of document.querySelectorAll("iframe.vyasa-marimo-frame")) {
      if (frame.contentWindow === event.source.parent) frame.style.height = `${event.data.height}px`;
    }
    window.vyasaMarimoFrames.add(event.source);
    event.source.postMessage(theme(), "*");
  });
  new MutationObserver(() => window.vyasaMarimoFrames.forEach((view) => view.postMessage(theme(), "*")))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();"""
HEAD_TAGS = ("title", "meta", "link", "style", "base")
GENERATED_NOTE = "<!-- Generated by Vyasa from {source}. Edit the Markdown file, not this file. -->\n"


def marimo_spec(path: Path) -> dict | None:
    """Return the `marimo` frontmatter table, or None when the document has none."""
    if path.suffix.lower() != ".md":
        return None
    metadata, _ = parse_frontmatter(path)
    spec = metadata.get("marimo")
    return spec if isinstance(spec, dict) and spec.get("notebook") and spec.get("view") else None


def is_marimo_path(path: Path) -> str | None:
    return "marimo" if marimo_spec(path) else None


def view_dir(doc_path: Path, spec: dict) -> Path:
    """Studio's default view location: `<notebook dir>/__marimo__/studio/<stem>/<view>/`.

    >>> view_dir(Path("/r/docs/a.md"), {"notebook": "../nb/x.py", "view": "v"}).as_posix()
    '/r/nb/__marimo__/studio/x/v'
    """
    notebook = (doc_path.parent / spec["notebook"]).resolve()
    return notebook.parent / "__marimo__" / "studio" / notebook.stem / spec["view"]


def _cell_list(names: list[str]) -> str:
    """
    >>> _cell_list(["a"]), _cell_list(["a", "b"]), _cell_list(["a", "b", "c"])
    ('`a` needs', '`a` and `b` need', '`a`, `b`, and `c` need')
    """
    quoted = [f"`{name}`" for name in names]
    if len(quoted) == 1:
        return f"{quoted[0]} needs"
    joined = " and ".join(quoted) if len(quoted) == 2 else ", ".join(quoted[:-1]) + f", and {quoted[-1]}"
    return f"{joined} need"


def fallback_markdown(markdown: str) -> str:
    """Remove optional blocks; replace each cell run in a required block with one warning callout.

    >>> fallback_markdown('a<!-- marimo-block optional -->x<!-- /marimo-block -->b')
    'ab'
    >>> print(fallback_markdown('<!-- marimo-block required -->x\\n<marimo-cell name="c"></marimo-cell><!-- /marimo-block -->').strip())
    x
    <BLANKLINE>
    <BLANKLINE>
    > [!warning] Live cells offline
    > `c` needs the marimo server.
    """
    def block(match):
        return "" if match.group(1) == "optional" else match.group(2)

    def run(match):
        names = CELL_RE.findall(match.group(0))
        return f"\n\n> [!warning] Live cells offline\n> {_cell_list(names)} the marimo server.\n\n"
    return RUN_RE.sub(run, BLOCK_RE.sub(block, markdown))


def endpoints(spec: dict, marimo_servers: dict) -> dict | None:
    """Where frames load from, where Vyasa checks health, and the start command's address flags.

    `server` names a proxied server from `[marimo_servers]`, so frames use Vyasa's own address.
    `url` is a direct server that readers' browsers reach themselves.

    >>> endpoints({"view": "v", "url": "http://localhost:2719"}, {})["frames"]
    'http://localhost:2719/v/'
    >>> e = endpoints({"view": "v", "server": "s"}, {"s": {"upstream": "http://127.0.0.1:2721", "token_file": "/k"}})
    >>> e["frames"], e["health"], e["flags"]
    ('/marimo/s/v/', 'http://127.0.0.1:2721/marimo/s/health', '--host 127.0.0.1 --port 2721 --base-url /marimo/s --token-password-file /k')
    >>> endpoints({"view": "v", "server": "missing"}, {}) is None
    True
    """
    if spec.get("server"):
        name = str(spec["server"])
        server = marimo_servers.get(name)
        if not server:
            return None
        upstream = server["upstream"].rstrip("/")
        port = upstream.rsplit(":", 1)[-1]
        token = f" --token-password-file {server['token_file']}" if server.get("token_file") else ""
        return {"frames": f"/marimo/{name}/{spec['view']}/", "health": f"{upstream}/marimo/{name}/health",
                "shown": f"server `{name}`", "flags": f"--host 127.0.0.1 --port {port} --base-url /marimo/{name}{token}"}
    url = str(spec.get("url") or "http://localhost:2718").rstrip("/")
    return {"frames": f"{url}/{spec['view']}/", "health": f"{url}/health", "shown": url,
            "flags": f"--port {url.rsplit(':', 1)[-1]}"}


def offline_callout(doc_path: Path, spec: dict, reason: str, flags: str) -> str:
    """Error callout with the command that starts the server; the notebook path is absolute so it runs anywhere.

    >>> print(offline_callout(Path("/r/docs/a.md"), {"notebook": "../nb/x.py"}, "No server answers at http://localhost:2719", "--port 2719"))
    > [!error] Marimo server is not running
    > No server answers at http://localhost:2719. The page shows its static version, and optional blocks are hidden. Start the server, then reload this page:
    >
    > ```bash
    > uvx --with marimo-studio==0.2.3 marimo run /r/nb/x.py --sandbox --headless --port 2719
    > ```
    """
    notebook = (doc_path.parent / spec["notebook"]).resolve()
    return (
        "> [!error] Marimo server is not running\n"
        f"> {reason}. The page shows its static version, and optional blocks are hidden. Start the server, then reload this page:\n"
        ">\n> ```bash\n"
        f"> uvx --with marimo-studio==0.2.3 marimo run {notebook} --sandbox --headless {flags}\n"
        "> ```"
    )


def framed_markdown(markdown: str, src: str) -> str:
    """Replace each cell run with a frame of the view that shows only that run.

    >>> framed_markdown('a\\n<marimo-cell name="x"></marimo-cell>\\n<marimo-cell name="y"></marimo-cell>\\nb', "http://m/v/").count("<iframe")
    1
    """
    runs = iter(range(len(RUN_RE.findall(markdown))))
    frame = ('\n<iframe class="vyasa-marimo-frame block w-full border-0" data-vyasa-marimo-run="{run}" '
             'src="{src}?run={run}" title="Live marimo cells" height="160" style="color-scheme: normal"></iframe>\n\n')
    return RUN_RE.sub(lambda _: frame.format(run=next(runs), src=src), markdown)


def runs_html(markdown: str) -> str:
    """View article: one hidden section per cell run; the frame's `?run=` query shows one and reports its height.

    >>> runs_html('<marimo-cell name="x"></marimo-cell> p <marimo-cell name="y"></marimo-cell>').count("<section")
    2
    """
    sections = "".join(
        f'<section data-vyasa-marimo-run="{run}" class="space-y-4">{cells.strip()}</section>'
        for run, cells in enumerate(RUN_RE.findall(markdown))
    )
    return sections + RUN_SCRIPT


def server_up(url: str, timeout: float = 0.3) -> bool:
    """`url` is the full health address."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status == 200
    except Exception:
        return False


def view_html(page_html: str, article_html: str, vyasa_origin: str, source: str) -> str:
    """Studio entry document: the live Vyasa page's head and theme container, holding the article as `#app-shell`.

    >>> page = '<html><head><title>t</title><link href="/static/a.css"></head><body class="b"><div id="page-container" style="--vyasa-x: 1">x</div></body></html>'
    >>> out = view_html(page, "<p>hi</p>", "http://v.test", "doc.md")
    >>> out.count("<head>"), out.count('id="app-shell"'), 'href="http://v.test/static/a.css"' in out, 'style="--vyasa-x: 1"' in out
    (1, 1, True, True)
    """
    head = page_html.split("<head>", 1)[1].split("</head>", 1)[0]
    body_tag = re.search(r"<body[^>]*>", page_html)
    theme = THEME_CONTAINER_RE.search(page_html)
    container_style = f" {theme.group(1)}" if theme else ""
    page = (
        f"<!DOCTYPE html>\n{GENERATED_NOTE.format(source=source)}<html lang=\"en\"><head>"
        f"{VIEW_HEAD_START}{head}{VIEW_HEAD_END}</head>{body_tag.group(0) if body_tag else '<body>'}"
        f'<div id="page-container"{container_style}>'
        f'<main id="app-shell" class="w-full">'
        f'<div data-vyasa-document-body="true" class="w-full">{article_html}</div></main></div></body></html>'
    )
    return MODULE_SCRIPT_RE.sub("", STATIC_URL_RE.sub(rf'\1="{vyasa_origin}/static/', page))


def full_page_html(request, page) -> str:
    """The page as a whole document. FastHTML answers an htmx request with a fragment that has no `<head>`."""
    nodes = page if isinstance(page, (tuple, list)) else (page,)
    heads = [node for node in nodes if getattr(node, "tag", "") in HEAD_TAGS]
    body = [node for node in nodes if getattr(node, "tag", "") not in HEAD_TAGS]
    return to_xml(respond(request, heads, body))


def write_if_changed(path: Path, text: str) -> None:
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")


def render_marimo_document(context):
    doc_path = Path(context.document.path)
    spec = marimo_spec(doc_path) or {}
    metadata, raw = parse_frontmatter(doc_path)
    title, markdown = resolve_markdown_title_text(metadata, raw, doc_path.stem, abbreviations=context.abbreviations)
    target = view_dir(doc_path, spec)
    from .proxy import servers
    where = endpoints(spec, servers())
    file_path = str(doc_path)
    flags = where["flags"] if where else ""
    if not where:
        reason = f"`.vyasa` has no `[marimo_servers.{spec.get('server')}]` entry"
    elif not (target / "view.toml").is_file():
        reason = f"Studio view `{spec['view']}` does not exist at `{target}`"
    elif not server_up(where["health"]):
        reason = f"No server answers for {where['shown']}"
    else:
        shell = DocumentPage(title, context.path, Div(), show_sidebar=False, show_toc=False).render(
            context.layout, htmx=False, blog_title=context.blog_title, auth=context.auth)
        origin = str(context.request.base_url).rstrip("/")
        write_if_changed(target / "index.html", view_html(full_page_html(context.request, shell), runs_html(markdown), origin, doc_path.name))
        body = from_md(framed_markdown(markdown, where["frames"]), current_path=context.path)
        content = Div(context.breadcrumbs, H1(title, cls=f"{PAGE_TITLE_CLS} mb-6"),
                      Div(body, data_vyasa_document_body="true", cls="w-full"), Script(FRAME_HEIGHT_SCRIPT))
        return DocumentPage(title, context.path, content, file_path=file_path, toc_source=markdown).render(
            context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth)
    body = from_md(f"{offline_callout(doc_path, spec, reason, flags)}\n\n{fallback_markdown(markdown)}", current_path=context.path)
    content = Div(context.breadcrumbs, H1(title, cls=f"{PAGE_TITLE_CLS} mb-6"), Div(body, data_vyasa_document_body="true"))
    return DocumentPage(title, context.path, content, file_path=file_path, toc_source=fallback_markdown(markdown)).render(
        context.layout, htmx=context.htmx, blog_title=context.blog_title, auth=context.auth)


def render_static_marimo_document(context):
    metadata, raw = parse_frontmatter(context.doc_file)
    title, markdown = resolve_markdown_title_text(metadata, raw, context.doc_file.stem, abbreviations=context.abbreviations)
    markdown = fallback_markdown(markdown)
    html = to_xml(from_md(markdown, current_path=context.relative_path.with_suffix("").as_posix()))
    return SimpleNamespace(title=title, raw_content=markdown, toc_items=None, content_html=html)
