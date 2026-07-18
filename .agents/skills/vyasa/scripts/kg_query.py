#!/usr/bin/env python3
"""Run Vyasa's installed Knowledge Graph query engine."""

from __future__ import annotations

import sys

from vyasa.extensions_builtin.tasks.query import query_command


if __name__ == "__main__":
    raise SystemExit(query_command(sys.argv[1:]))
