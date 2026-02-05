.PHONY: clean build test publish install dev bump-major bump-minor bump-patch publish-patch publish-minor publish-major ppat pmin pmaj

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

# Version bumping
bump-major:
	@echo "Bumping major version..."
	@python bump_version.py major

bump-minor:
	@echo "Bumping minor version..."
	@python bump_version.py minor

bump-patch:
	@echo "Bumping patch version..."
	@python bump_version.py patch

# Explicit publish + checkpoint shortcuts
publish-patch: bump-patch build
	python -m twine upload --repository sizhky dist/*
	zsh -i -c "checkpoint main"

publish-minor: bump-minor build
	python -m twine upload --repository sizhky dist/*
	zsh -i -c "checkpoint main"

publish-major: bump-major build
	python -m twine upload --repository sizhky dist/*
	zsh -i -c "checkpoint main"

pc: publish-patch
ppat: publish-patch

pmin: publish-minor

pmaj: publish-major
