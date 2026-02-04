# fasthtml solveit
from dataclasses import dataclass
from pathlib import Path
import re
from urllib.parse import quote
from pydantic_ai import Agent, RunContext
from .config import get_config
from .helpers import list_vyasa_entries

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except Exception:
    pass

try:
    import logfire

    logfire.configure(
        environment="development",
        service_name="vyasa",
    )
    logfire.instrument_pydantic_ai()
except Exception:
    pass


@dataclass
class VyasaDeps:
    root: Path


system_prompt = """
You talk only as much as needed and not a word more.

You are a helpful AI assistant that helps people find answers from a blog.
"""

vyasa_agent = Agent(
    "openai:gpt-5-mini",
    deps_type=VyasaDeps,
    system_prompt=system_prompt,
)


@vyasa_agent.tool
def list_vyasa_posts_tool(
    ctx: RunContext[VyasaDeps],
    path: str = ".",
    include_hidden: bool = False,
) -> dict:
    """List immediate folders and posts under a path (Use this tool for progressive disclosure)."""
    return list_vyasa_entries(ctx.deps.root, relative=path, include_hidden=include_hidden)

@vyasa_agent.tool
def get_vyasa_post_content_tool(
    ctx: RunContext[VyasaDeps],
    relative_path: str,
) -> str:
    """Get the content of a blog post given its relative path from the blog root.
    
    Args:
        relative_path: Relative path to the blog post from the blog root.
    """
    root = ctx.deps.root.resolve()
    post_path = (root / relative_path).resolve()
    try:
        if not post_path.is_file() or not str(post_path).startswith(str(root)):
            return "Error: Invalid post path."

        with open(post_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        return f"Error: Could not read post content. Error: {e}"

class PydanticAIStreamingResponder:
    """Streaming responder using Pydantic AI's run_stream."""

    def __init__(self, agent=None, agent_deps=None):
        self.agent = agent if agent is not None else vyasa_agent
        if agent_deps is None:
            config = get_config()
            agent_deps = VyasaDeps(root=config.get_root_folder())
        self.agent_deps = agent_deps
        self.message_history = None

    async def __call__(self, text: str, context=None):
        import asyncio

        if self.agent is None:
            self.agent = vyasa_agent
        if self.agent is None:
            raise RuntimeError("PydanticAI agent is not initialized")

        async with self.agent.run_stream(
            text,
            message_history=self.message_history,
            deps=self.agent_deps,
        ) as response:
            async for token in response.stream_text(delta=True):
                yield token
                await asyncio.sleep(0)

            self.message_history = response.all_messages()


def app_factory():
    responder = PydanticAIStreamingResponder(agent=vyasa_agent)
    return create_core_app(
        responder=responder,
        tag_line="PYDANTIC AI",
        title="Pydantic AI Chat",
        subtitle="Streaming tokens from PydanticAI over WebSockets.",
    )
