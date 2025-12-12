# Publishing to PyPI

## Prerequisites

1. Install build tools:
```bash
pip install build twine
```

2. Create accounts on:
   - [PyPI](https://pypi.org/account/register/) (production)
   - [TestPyPI](https://test.pypi.org/account/register/) (testing)

3. Create API tokens:
   - PyPI: https://pypi.org/manage/account/token/
   - TestPyPI: https://test.pypi.org/manage/account/token/

## Build the Package

```bash
# Clean previous builds
rm -rf dist/ build/ *.egg-info

# Build the package
python -m build
```

This creates:
- `dist/bloggy-0.1.0-py3-none-any.whl` (wheel)
- `dist/bloggy-0.1.0.tar.gz` (source distribution)

## Test Locally

```bash
# Install from the wheel
pip install dist/bloggy-0.1.0-py3-none-any.whl

# Test the CLI
bloggy demo/
```

## Publish to TestPyPI (recommended first)

```bash
python -m twine upload --repository testpypi dist/*
```

Test installation from TestPyPI:
```bash
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ bloggy
```

## Publish to PyPI

```bash
python -m twine upload dist/*
```

## Post-Publication

1. Create a git tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```

2. Create a GitHub release with the changelog

3. Test installation:
```bash
pip install bloggy
```

## Updating the Package

1. Update version in:
   - `pyproject.toml`
   - `settings.ini`
   - `bloggy/__init__.py`

2. Update CHANGELOG.md

3. Rebuild and republish:
```bash
rm -rf dist/ build/ *.egg-info
python -m build
python -m twine upload dist/*
```

## Using PyPI API Tokens

Store your tokens in `~/.pypirc`:

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
username = __token__
password = pypi-YOUR-API-TOKEN-HERE

[testpypi]
username = __token__
password = pypi-YOUR-TESTPYPI-TOKEN-HERE
```

Then you can upload without entering credentials:
```bash
python -m twine upload dist/*
```
