import logging
import os
import sys
from pathlib import Path

from loguru import logger
from .config import get_config


class InterceptHandler(logging.Handler):
    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        logger.opt(exception=record.exc_info, depth=6).log(level, record.getMessage())


def configure_logging():
    config = get_config()
    debug_enabled = os.getenv("VYASA_DEBUG", "").lower() in {"1", "true", "yes", "on"}
    console_level = "DEBUG" if debug_enabled else "INFO"
    try:
        log_path = config.get_root_folder() / "vyasa.log"
    except Exception:
        log_path = Path.cwd() / "vyasa.log"
    logger.remove()
    logger.add(sys.stdout, level=console_level)
    if config.get_log_to_file():
        logger.add(str(log_path), rotation="10 MB", retention="10 days", level="DEBUG")
    handler = InterceptHandler()
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.DEBUG if debug_enabled else logging.INFO)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "starlette", "watchfiles", "watchfiles.main"):
        target = logging.getLogger(name)
        target.handlers = [handler]
        target.setLevel(logging.DEBUG if debug_enabled else logging.INFO)
        target.propagate = False
