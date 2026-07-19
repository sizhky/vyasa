import base64
import io
import re

from PIL import Image

from vyasa import favicon
from vyasa.favicon import legacy_favicon_svg
from vyasa.stained_glass import apply_corner_radius


def test_favicon_uses_stained_glass_and_is_deterministic(tmp_path, monkeypatch):
    rendered = []
    monkeypatch.setattr(
        favicon,
        "render",
        lambda config: rendered.append(config) or Image.new("RGBA", (64, 64), "red"),
    )
    favicon._favicon_svg.cache_clear()
    svg = favicon.favicon_svg(tmp_path)

    assert svg == favicon.favicon_svg(tmp_path)
    assert svg != legacy_favicon_svg(tmp_path)
    payload = re.search(r"base64,([^\"']+)", svg)
    assert payload is not None
    image = Image.open(io.BytesIO(base64.b64decode(payload.group(1))))
    assert image.size == (64, 64)
    assert image.mode == "RGBA"
    assert rendered[0].panes == 18
    assert rendered[0].lead == 1.3
    assert rendered[0].corner_radius == 32
    assert rendered[0].outer_border is False


def test_corner_radius_spans_square_to_circle():
    source = Image.new("RGB", (64, 64), "red")
    square = apply_corner_radius(source, 0)
    circle = apply_corner_radius(source, 32)

    assert square.getpixel((0, 0))[3] == 255
    assert circle.getpixel((0, 0))[3] == 0
    assert circle.getpixel((32, 32))[3] == 255
