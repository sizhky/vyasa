import re
import xml.etree.ElementTree as ET

from vyasa import favicon
from vyasa.favicon import legacy_favicon_svg


def test_favicon_is_pure_svg_and_deterministic(tmp_path):
    favicon._favicon_svg.cache_clear()
    svg = favicon.favicon_svg(tmp_path)

    assert svg == favicon.favicon_svg(tmp_path)
    assert svg != legacy_favicon_svg(tmp_path)
    assert "data:image" not in svg
    root = ET.fromstring(svg)
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    assert root.attrib["viewBox"] == "0 0 64 64"


def test_different_server_roots_produce_distinct_favicons(tmp_path):
    icons = {
        re.sub(
            r"favicon-[0-9a-f]+",
            "favicon-id",
            favicon.favicon_svg(tmp_path / f"server-{index}"),
        )
        for index in range(100)
    }

    assert len(icons) == 100


def test_generated_favicons_use_only_approved_compositions(tmp_path):
    compositions = {
        ET.fromstring(favicon.favicon_svg(tmp_path / f"server-{index}")).attrib[
            "data-composition"
        ]
        for index in range(100)
    }

    assert compositions == set(favicon._COMPOSITIONS)


def test_generated_favicons_have_no_stroked_closed_loops(tmp_path):
    for index in range(100):
        root = ET.fromstring(favicon.favicon_svg(tmp_path / f"server-{index}"))
        outlined_loops = [
            element
            for element in root.iter()
            if element.tag.rsplit("}", 1)[-1] in {"circle", "ellipse"}
            and element.attrib.get("fill") == "none"
        ]

        assert outlined_loops == []


def test_generated_favicons_do_not_rotate_whole_motifs(tmp_path):
    for index in range(100):
        svg = favicon.favicon_svg(tmp_path / f"server-{index}")

        assert '<g transform="rotate(' not in svg


def test_generated_favicons_use_even_wedge_counts():
    root = ET.fromstring(favicon.favicon_svg("/preview/vyasa-server-64"))
    wedges = [
        element
        for element in root
        if element.tag.rsplit("}", 1)[-1] == "path"
        and element.attrib.get("d", "").startswith("M32 32")
    ]

    assert len(wedges) % 2 == 0


def test_generated_favicon_writer_matches_runtime(tmp_path):
    destination = tmp_path / "static" / "icon.svg"
    destination.parent.mkdir()

    favicon.write_generated_favicon(tmp_path, destination)

    assert destination.read_text() == favicon.favicon_svg(tmp_path)


def test_custom_png_takes_precedence(tmp_path):
    assert favicon.favicon_href(tmp_path) == "/static/icon.svg"

    static = tmp_path / "static"
    static.mkdir()
    (static / "icon.png").touch()

    assert favicon.favicon_href(tmp_path) == "/static/icon.png"


def test_favicon_palettes_have_strong_contrast():
    for background in favicon._BACKGROUNDS:
        for foreground in favicon._FOREGROUNDS:
            assert _contrast(background, foreground) >= 4.5


def _contrast(first: str, second: str) -> float:
    lighter, darker = sorted((_luminance(first), _luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def _luminance(color: str) -> float:
    channels = [int(color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
