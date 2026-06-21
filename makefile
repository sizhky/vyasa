.PHONY: clean build test test-all install dev fetch fetch-once

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
