#!/usr/bin/env python3
"""Render generated Vyasa favicons together at their real display sizes."""

from __future__ import annotations

import argparse
from pathlib import Path

from vyasa.favicon import favicon_svg


def _inner_svg(root: str) -> str:
    svg = favicon_svg(root)
    return svg.partition(">")[2].removesuffix("</svg>")


def build_contact_sheet(count: int = 100, columns: int = 10) -> str:
    cell_width, cell_height = 82, 58
    rows = (count + columns - 1) // columns
    samples = []
    for index in range(count):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        icon = _inner_svg(f"/preview/vyasa-server-{index}")
        samples.append(
            f'<g transform="translate({x + 4} {y + 4}) scale(.5)">{icon}</g>'
            f'<g transform="translate({x + 45} {y + 12}) scale(.25)">{icon}</g>'
            f'<text x="{x + 4}" y="{y + 52}">{index:02}</text>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {columns * cell_width} {rows * cell_height}">'
        '<rect width="100%" height="100%" fill="#fff"/>'
        "<style>text{font:10px ui-monospace,monospace;fill:#52525b}</style>"
        f"{''.join(samples)}</svg>"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path("/tmp/vyasa-favicon-contact-sheet.svg"),
    )
    args = parser.parse_args()
    args.output.write_text(build_contact_sheet(), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
