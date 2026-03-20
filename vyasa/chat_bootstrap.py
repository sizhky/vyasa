from pathlib import Path


def load_pylogue_routes(logger):
    try:
        from pylogue.core import register_routes, EchoResponder
        return register_routes, EchoResponder
    except Exception:
        pylogue_path = Path("/Users/yeshwanth/Code/Personal/pylogue/src/pylogue/core.py")
        if not pylogue_path.exists():
            logger.warning(f"Pylogue not found at {pylogue_path}")
            return None, None
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("pylogue.core", pylogue_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                return module.register_routes, module.EchoResponder
        except Exception as exc:
            logger.warning(f"Failed to load pylogue from {pylogue_path}: {exc}")
            return None, None
    return None, None


def register_chat_routes(app_instance, rt, logger, title):
    pylogue_register, pylogue_responder = load_pylogue_routes(logger)
    if not pylogue_register:
        return
    try:
        from .agent import PydanticAIStreamingResponder
        chat_responder_factory = PydanticAIStreamingResponder
        logger.info("Using PydanticAIStreamingResponder for /chat")
    except Exception as exc:
        logger.warning(f"Falling back to Pylogue responder: {exc}")
        chat_responder_factory = pylogue_responder
    pylogue_register(app_instance, responder_factory=chat_responder_factory, title=title, subtitle="Ask a question about this blog", tag_line="« Blog", tag_line_href="/", base_path="chat", inject_headers=True)

    @rt("/chat")
    def chat_redirect():
        from starlette.responses import RedirectResponse
        return RedirectResponse("/chat/", status_code=307)
