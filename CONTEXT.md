# Vyasa Modular Architecture

Vyasa is a Markdown website platform whose runtime can be split into a small core and optional extensions.

Reference docs:

- [ADR 0001: Modular Extension Architecture](docs/adr/0001-modular-extension-architecture.md)
- [Vyasa Extension Contract Notes](docs/grill-sessions/vyasa-extension-contract.md)

## Language

**Core**:
The mandatory runtime layer that owns content mounting, routing, rendering contracts, shared page shell, wikilinks, and RBAC.
_Avoid_: Kernel, base app

**Extension**:
An optional module that adds behavior through core-owned contracts without becoming required by every Vyasa site.
_Avoid_: Plugin, addon

**Markdown Pipeline**:
The core-owned rendering contract that turns Markdown into HTML while allowing extensions to register syntax handlers.
_Avoid_: Renderer plugin system

**Extension Configuration**:
The `.vyasa` TOML declarations that enable and configure extension behavior for a site or folder.
_Avoid_: Entry-point discovery, implicit auto-loading

**Root Configuration**:
The root `.vyasa` file that decides which extensions load at server start.
_Avoid_: Folder configuration

**Folder Configuration**:
A folder-local `.vyasa` file that tunes already-loaded behavior for a content subtree.
_Avoid_: Extension loading configuration

**Built-in Extension**:
An extension shipped with Vyasa and enabled explicitly through extension configuration.
_Avoid_: External package, third-party extension

**Override Slot**:
A named core contract where exactly one extension may replace default behavior.
_Avoid_: Last-writer-wins hook

**Theme Extension**:
An extension that changes visual tokens, CSS, typography, colors, or component styling.
_Avoid_: Custom CSS bundle

**Layout Extension**:
An extension that changes page structure, chrome placement, visible regions, gestures, or navigation affordances.
_Avoid_: Theme

**Render Extension**:
An extension that adds or overrides Markdown rendering behavior through the Markdown Pipeline.
_Avoid_: Markdown plugin

**Extension Bundle**:
A built-in extension folder containing Python code, CSS, JavaScript, and other assets behind one extension id.
_Avoid_: Loose module

**Extension App**:
The restricted registration surface that an extension uses to add routes, assets, markdown handlers, layout hooks, config, and lifecycle hooks.
_Avoid_: Raw FastHTML app

**Extension Asset**:
A CSS, JavaScript, image, or other static file exposed by core from an extension bundle.
_Avoid_: Ad hoc static route

**Asset Bundle**:
An ordered group of extension assets loaded only when a route or rendered document asks for it.
_Avoid_: Global dependency graph

**Asset Collector**:
The per-render context object where extensions record which asset bundles a page needs.
_Avoid_: Global asset flag

**Default Preset**:
The built-in extension set enabled automatically to preserve today’s Vyasa behavior.
_Avoid_: Core

**Extension Metadata**:
The Python-declared capabilities, slots, requirements, scoping, and fallback rules for an extension.
_Avoid_: TOML behavior definition

**Capability Name**:
A stable metadata string that names an extension-provided slot, capability, or asset bundle.
_Avoid_: Hook id

See [Vyasa Extension Contract Notes](docs/grill-sessions/vyasa-extension-contract.md) for the current `slot:*`, `cap:*`, and `bundle:*` naming rules.

**Storage Namespace**:
A core-assigned durable filesystem territory where one extension may store local data.
_Avoid_: Global extension database path

**Extension Config Model**:
The Pydantic model an extension owns for validating its root and folder configuration.
_Avoid_: Untyped config dict

**Error Page Extension**:
The built-in extension that renders configurable 4xx and 5xx error pages.
_Avoid_: Custom not-found only

## Relationships

- The **Core** loads zero or more **Extensions**.
- An **Extension** depends on **Core** contracts, but **Core** must not depend on a specific **Extension**.
- The **Core** owns the **Markdown Pipeline**.
- An **Extension** may add syntax to the **Markdown Pipeline**.
- **Extension Configuration** is the canonical source for enabling extension behavior.
- Initial **Extension Configuration** targets **Built-in Extensions** only.
- **Built-in Extensions** live in the Vyasa repo and can be switched off.
- A disabled **Built-in Extension** is not loaded at server start.
- Existing sites keep today’s behavior by default.
- **Root Configuration** controls extension loading.
- **Folder Configuration** may configure or disable already-loaded extension behavior for its subtree.
- **Folder Configuration** cannot disable core RBAC.
- Folder-level disabling is available only when an **Extension** declares that scoped disabling is supported.
- An **Extension Bundle** is the preferred implementation shape for built-in extensions.
- An **Extension** registers through an **Extension App**, not the raw FastHTML app.
- **Extension Assets** are served from core-managed URLs.
- **Asset Bundles** are loaded dynamically by page need, not globally by extension presence.
- A render extension uses the **Asset Collector** to request an **Asset Bundle** during page rendering.
- Each **Extension** owns one `[extensions.<id>]` TOML namespace.
- **Folder Configuration** uses the same extension namespace for scoped settings.
- Existing top-level config keys remain supported through compatibility mapping.
- **Default Preset** includes default layout, default theme, search, error pages, blog home behavior, tabs, diagrams, tasks, slides, and filesystem content.
- Vyasa boot fails when no layout extension is active.
- Theme is required at runtime, but a broken configured theme falls back to the default theme.
- Broken not-found behavior falls back to the default not-found extension.
- Broken search disables search cleanly.
- Broken home behavior falls back to a plain index.
- `.vyasa` selects and configures extensions; **Extension Metadata** defines extension behavior rules.
- **Capability Names** let Vyasa validate extension conflicts, dependencies, and load order.
- **Storage Namespaces** prevent local extension data from colliding and make backup, cleanup, and migration discoverable.
- Extensions depend on capability names for required behavior.
- Extension ids are used only for optional integrations or configuration.
- Each extension owns an **Extension Config Model**.
- Core merges and validates extension config before passing it to extension code.
- Normal users see concise scoped errors; admins may see detailed diagnostics.
- **Error Page Extension** owns default configurable 4xx and 5xx pages.
- Extensions are instantiated once during server startup.
- Extensions receive per-request or per-render context instead of storing user state.
- Default extensions are subclassable where stable customization seams exist.
- Simple extensions should not require inheritance.
- Runtime load resolves enabled extensions, validates metadata, registers through the extension app, then applies folder configuration per request.
- Config order does not decide override slot behavior.
- Config order may matter only for explicitly ordered additive extension lists.
- Route extensions declare route prefixes so startup validation can catch route conflicts.
- An **Override Slot** has at most one active extension.
- A site has at most one active **Theme Extension**.
- A site has at most one active **Layout Extension**.
- A **Theme Extension** changes presentation styling; a **Layout Extension** changes page structure and interaction surfaces.
- Many **Render Extensions** may be active together.
- A Markdown syntax marker has exactly one owning **Render Extension**.

## Example Dialogue

> **Dev:** "Should slides be in **Core**?"
> **Domain expert:** "No, slides are an **Extension**; RBAC stays in **Core**."
> **Dev:** "How does a site enable an **Extension**?"
> **Domain expert:** "Through **Extension Configuration** in `.vyasa`."

## Flagged Ambiguities

- "plugin", "addon", and "extension" all describe optional behavior; resolved: use **Extension**.
- "theme" was used for styling, layout, rendering, gestures, and behavior; resolved: split **Theme Extension** from **Layout Extension** and keep rendering behavior separate.
