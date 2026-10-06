from fasthtml.common import *


def login_content(error, oauth_providers, local_enabled):
    """`oauth_providers` is a sequence of (name, label) pairs, one button each."""
    return Div(
        H2("Login", cls="uk-h2"),
        Div(*(A(Span(f"Continue with {label}", cls="text-sm font-semibold"), href=f"/login/{name}", cls="inline-flex items-center justify-center px-4 py-2 rounded-md border border-vyasa-strong bg-vyasa-inverse text-vyasa-on-inverse hover:bg-vyasa-hover hover:border-vyasa-strong transition-colors") for name, label in oauth_providers), cls="flex flex-col gap-3 my-6 max-w-sm mx-auto") if oauth_providers else None,
        (Form(Div(Input(type="text", name="username", required=True, id="username", cls="uk-input input input-bordered w-full", placeholder="Username"), cls="my-4"), Div(Input(type="password", name="password", required=True, id="password", cls="uk-input input input-bordered w-full", placeholder="Password"), cls="my-4"), Button("Login", type="submit", cls="uk-btn btn btn-primary w-full"), enctype="multipart/form-data", method="post", cls="max-w-sm mx-auto") if local_enabled else None),
        P(error, cls="text-red-500 mt-4") if error else None,
        cls="prose mx-auto mt-24 text-center",
    )


def impersonate_content(error, success, impersonating_email):
    return Div(
        H1("Impersonate User", cls="text-3xl font-bold"),
        P("Switch the current session to a different user for RBAC testing.", cls="text-vyasa-muted"),
        Div(P(error, cls="text-red-600") if error else None, P(success, cls="text-emerald-600") if success else None, cls="mt-4"),
        Div((P(f"Currently impersonating: {impersonating_email}", cls="text-sm text-amber-600 dark:text-amber-400") if impersonating_email else None), cls="mt-2"),
        Form(
            Div(Label("User email", cls="block text-sm font-medium mb-2"), Input(type="email", name="email", placeholder="user@domain.com", cls="w-full px-3 py-2 rounded-md border border-vyasa-border bg-vyasa-surface"), cls="mt-6"),
            Div(Button("Start Impersonation", type="submit", name="action", value="start", cls="mt-6 px-4 py-2 rounded-md bg-vyasa-accent text-vyasa-on-accent hover:bg-vyasa-accent-hover"), Button("Stop Impersonation", type="submit", name="action", value="stop", cls="mt-6 ml-3 px-4 py-2 rounded-md bg-vyasa-active text-vyasa-text hover:bg-vyasa-hover"), cls="flex items-center"),
            method="post",
            cls="mt-4",
        ),
        cls="max-w-xl mx-auto py-10 px-6",
    )
