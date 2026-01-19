# fasthtml solveit
from dataclasses import dataclass
from pathlib import Path
import re
from urllib.parse import quote
from pydantic_ai import Agent, RunContext
from .config import get_config
from .helpers import list_bloggy_entries

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except Exception:
    pass

try:
    import logfire

    logfire.configure(
        environment="development",
        service_name="bloggy",
    )
    logfire.instrument_pydantic_ai()
except Exception:
    pass


@dataclass
class BloggyDeps:
    root: Path


system_prompt = """
You talk only as much as needed and not a word more.

You are a helpful AI assistant that helps people find answers from a blog.
"""

bloggy_agent = Agent(
    "openai:gpt-5-mini",
    deps_type=BloggyDeps,
    system_prompt=system_prompt,
)


@bloggy_agent.tool
def list_bloggy_posts_tool(
    ctx: RunContext[BloggyDeps],
    path: str = ".",
    include_hidden: bool = False,
) -> dict:
    """List immediate folders and posts under a path (Use this tool for progressive disclosure)."""
    return list_bloggy_entries(ctx.deps.root, relative=path, include_hidden=include_hidden)

@bloggy_agent.tool
def get_bloggy_post_content_tool(
    ctx: RunContext[BloggyDeps],
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
        self.agent = agent if agent is not None else bloggy_agent
        if agent_deps is None:
            config = get_config()
            agent_deps = BloggyDeps(root=config.get_root_folder())
        self.agent_deps = agent_deps
        self.message_history = None

    async def __call__(self, text: str, context=None):
        import asyncio

        if self.agent is None:
            self.agent = bloggy_agent
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
    responder = PydanticAIStreamingResponder(agent=bloggy_agent)
    return create_core_app(
        responder=responder,
        tag_line="PYDANTIC AI",
        title="Pydantic AI Chat",
        subtitle="Streaming tokens from PydanticAI over WebSockets.",
    )
