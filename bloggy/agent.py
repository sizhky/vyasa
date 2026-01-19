# fasthtml solveit
from dataclasses import dataclass
from pathlib import Path, re
from urllib.parse import quote
from pydantic_ai import Agent, RunContext
from .config import get_config

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
