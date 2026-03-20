from fasthtml.common import *


def login_content(error, google_enabled, local_enabled):
    return Div(
        H2("Login", cls="uk-h2"),
        (A(Span("Continue with Google", cls="text-sm font-semibold"), href="/login/google", cls="inline-flex items-center justify-center px-4 py-2 my-6 rounded-md border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-900 hover:border-slate-900 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-900/80 transition-colors max-w-sm mx-auto") if google_enabled else None),
        (Form(Div(Input(type="text", name="username", required=True, id="username", cls="uk-input input input-bordered w-full", placeholder="Username"), cls="my-4"), Div(Input(type="password", name="password", required=True, id="password", cls="uk-input input input-bordered w-full", placeholder="Password"), cls="my-4"), Button("Login", type="submit", cls="uk-btn btn btn-primary w-full"), enctype="multipart/form-data", method="post", cls="max-w-sm mx-auto") if local_enabled else None),
        P(error, cls="text-red-500 mt-4") if error else None,
        cls="prose mx-auto mt-24 text-center",
    )


def impersonate_content(error, success, impersonating_email):
    return Div(
        H1("Impersonate User", cls="text-3xl font-bold"),
        P("Switch the current session to a different user for RBAC testing.", cls="text-slate-600 dark:text-slate-400"),
        Div(P(error, cls="text-red-600") if error else None, P(success, cls="text-emerald-600") if success else None, cls="mt-4"),
        Div((P(f"Currently impersonating: {impersonating_email}", cls="text-sm text-amber-600 dark:text-amber-400") if impersonating_email else None), cls="mt-2"),
        Form(
            Div(Label("User email", cls="block text-sm font-medium mb-2"), Input(type="email", name="email", placeholder="user@domain.com", cls="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60"), cls="mt-6"),
            Div(Button("Start Impersonation", type="submit", name="action", value="start", cls="mt-6 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"), Button("Stop Impersonation", type="submit", name="action", value="stop", cls="mt-6 ml-3 px-4 py-2 rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"), cls="flex items-center"),
            method="post",
            cls="mt-4",
        ),
        cls="max-w-xl mx-auto py-10 px-6",
    )
