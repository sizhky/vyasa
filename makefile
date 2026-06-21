.PHONY: clean build test test-all install dev fetch fetch-once typecheck

# Python used for type resolution. Override in CI: make typecheck PY=.venv/bin/python
PY ?= /Users/yeshwanth/.venv/bin/python

# Default: check only .py files you changed vs HEAD (+ untracked), critical rules
# only, one terse line each. The ~140 pre-existing errors stay hidden — you only
# see what your edit broke. Override scope with FILES="a.py b.py"; full repo: typecheck-all.
CHANGED := $(shell { git diff --name-only HEAD -- '*.py'; git ls-files --others --exclude-standard -- '*.py'; } | sort -u)
FILES ?= $(CHANGED)

typecheck:
	@if [ -z "$(FILES)" ]; then echo "no changed .py files"; else \
	  uvx pyright --pythonpath $(PY) --outputjson $(FILES) | $(PY) scripts/pyright_brief.py; fi

typecheck-all:
	@uvx pyright --pythonpath $(PY) --outputjson | $(PY) scripts/pyright_brief.py --all

clean:
	rm -rf dist/ build/ *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	python -m build

test:
	/Users/yeshwanth/.venv/bin/python -m pytest

test-all: test

install:
	pip install -e ".[dev]"

preview:
	# kill any existing process on port 21212
	@lsof -ti:21212 | xargs -r kill -9
	vyasa --port 21212 > /dev/null 2>&1 &

fetch:
	vyasa-fetch --interval 30

fetch-once:
	vyasa-fetch --once

line-count:
	find vyasa -type f \( -name "*.py" -o -name "*.js" \) -print0 | xargs -0 wc -l
