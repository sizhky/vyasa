from fasthtml.common import *
from monsterui.all import *


def not_found_content():
    return Div(
        Div(H1("404", cls="text-9xl font-bold text-vyasa-faint mb-4"), cls="text-center"),
        H2("Page Not Found", cls="text-3xl font-bold text-vyasa-text mb-4 text-center"),
        P("Oops! The page you're looking for doesn't exist. It might have been moved or deleted.", cls="text-lg text-vyasa-muted mb-8 text-center max-w-2xl mx-auto"),
        Div(
            A(UkIcon("home", cls="w-5 h-5 mr-2"), "Go to Home", href="/", hx_get="/", hx_target="#main-content", hx_push_url="true", hx_swap="outerHTML show:window:top settle:0.1s", cls="inline-flex items-center px-6 py-3 bg-vyasa-accent hover:bg-vyasa-accent-hover text-vyasa-on-accent rounded-lg font-medium transition-colors mr-4"),
            A(UkIcon("arrow-left", cls="w-5 h-5 mr-2"), "Go Back", href="javascript:history.back()", cls="inline-flex items-center px-6 py-3 bg-vyasa-active hover:bg-vyasa-hover text-vyasa-text rounded-lg font-medium transition-colors"),
            cls="flex justify-center items-center gap-4 flex-wrap",
        ),
        Div(P("💡 ", Strong("Tip:"), " Check the sidebar for available posts, or use the search to find what you're looking for.", cls="text-sm text-vyasa-muted italic"), cls="mt-12 text-center"),
        cls="flex flex-col items-center justify-center py-16 px-6 min-h-[60vh]",
    )
