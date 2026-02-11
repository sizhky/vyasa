.PHONY: clean build test install dev

clean:
	rm -rf dist/ build/ *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	python -m build

test: build
	pip install dist/vyasa-*.whl --force-reinstall
	vyasa demo/

install:
	pip install -e ".[dev]"

dev:
	vyasa demo/
