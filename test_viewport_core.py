import subprocess
from pathlib import Path


def test_initial_viewport_scale() -> None:
    script = """
import assert from 'node:assert/strict';
import { initialViewportScale } from './vyasa/static/viewport_core.js';
assert.equal(initialViewportScale(0.5, 2, 4, false), 0.5);
assert.equal(initialViewportScale(0.5, 2, 4, true), 2);
assert.equal(initialViewportScale(0.8, 0.6, 2, true), 0.6);
assert.equal(initialViewportScale(1.5, 2, 2, true), 1.5);
"""
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=Path(__file__).parent,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
