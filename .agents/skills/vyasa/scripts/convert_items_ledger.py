#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from kg_pack_convert import (  # noqa: E402
    convert_legacy_items_markdown,
    write_conversion,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert first inline items/tasks block to KG schema sidecars.")
    parser.add_argument("markdown_path", help="Markdown file containing an inline items/tasks fence.")
    parser.add_argument("--write", action="store_true", help="Write .ledger.md, .kg.schema, .kg.nodes, .kg.edges, .kg.attrs, .kg.palette, and .kg.cache files.")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files when used with --write.")
    args = parser.parse_args()

    conversion = convert_legacy_items_markdown(args.markdown_path)
    print(conversion.markdown_path)
    print(conversion.schema_path)
    print(conversion.nodes_path)
    print(conversion.edges_path)
    print(conversion.attrs_path)
    print(conversion.palette_path)
    print(conversion.cache_path)
    if args.write:
        write_conversion(conversion, force=args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
