# Contributing to Bloggy

Thank you for your interest in contributing to Bloggy! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bloggy.git`
3. Create a virtual environment: `python -m venv venv`
4. Activate it: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
5. Install in development mode: `pip install -e ".[dev]"`

## Development Workflow

1. Create a new branch for your feature: `git checkout -b feature-name`
2. Make your changes
3. Test your changes locally by running: `bloggy demo/`
4. Commit your changes: `git commit -am "Add feature"`
5. Push to your fork: `git push origin feature-name`
6. Create a Pull Request

## Code Style

- Follow PEP 8 guidelines
- Use meaningful variable and function names
- Add docstrings to functions and classes
- Keep functions focused and concise

## Testing

Before submitting a PR:
- Test the package installation: `pip install -e .`
- Test the CLI: `bloggy your-markdown-folder/`
- Verify all markdown features work (footnotes, mermaid diagrams, etc.)
- Test both light and dark themes

## Reporting Issues

When reporting issues, please include:
- Your Python version
- Your operating system
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages or screenshots

## Feature Requests

We welcome feature requests! Please:
- Check if the feature already exists or is planned
- Describe the feature and its use case
- Explain why it would be valuable to users

## Questions?

Feel free to open an issue for questions or discussions.

Thank you for contributing! 🎉
