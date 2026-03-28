# Design System Strategy: The Curated Archive



## 1. Overview & Creative North Star

**The Creative North Star: "The Digital Curator"**



This design system rejects the "app-like" rigidity of modern SaaS in favor of a high-end editorial experience. It is designed to feel like a private library or a high-end archival collection: quiet, authoritative, and profoundly spacious.



To break the "template" look, we move away from symmetrical grids and boxed containers. Instead, we utilize **Intentional Asymmetry**—where large typographic headlines (Newsreader) are offset against minimalist UI controls (Manrope). By leaning into a monochromatic foundation with a singular, desaturated "dried petal" accent, we create a sense of timelessness. The goal is not to "build an interface," but to "curate a space" where content is the only priority.



---



## 2. Colors: Tonal Atmosphere

The palette is a study in "High-Key" lighting. We avoid high contrast in the background to prevent visual fatigue, relying on the most subtle shifts in grey and white.



### Color Tokens

* **Surface (Primary Foundation):** `#f9f9f9` (Surface / Surface Bright)

* **The Archive Accent:** `#8e4a4b` (Primary) — A faded, desaturated clay used sparingly for intent.

* **Text Hierarchy:** `#2d3435` (On Surface) for primary readability; `#5a6061` (On Surface Variant) for meta-data.



### The "No-Line" Rule

**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Separation must be achieved through:

1. **Tonal Shifts:** Placing a `surface-container-lowest` (#ffffff) card against a `surface` (#f9f9f9) background.

2. **Whitespace:** Using the `16` (5.5rem) or `20` (7rem) spacing tokens to define regional boundaries.

3. **Soft Shadows:** Only when necessary for floating elements (see Elevation).



### Surface Hierarchy & Nesting

Treat the UI as stacked sheets of fine, textured paper.

* **Level 0 (Foundation):** `surface` (#f9f9f9)

* **Level 1 (Sections):** `surface-container-low` (#f2f4f4)

* **Level 2 (Active Cards):** `surface-container-lowest` (#ffffff)

* **Level 3 (Interaction/Popovers):** `surface-bright` (#f9f9f9) with Glassmorphism.



### The Glass & Gradient Rule

For main CTAs or Hero sections, use a subtle linear gradient from `primary` (#8e4a4b) to `primary-container` (#ffdad9). For navigation overlays, apply a `backdrop-blur` of 20px over a semi-transparent `surface-container-lowest` (80% opacity) to create a "frosted glass" effect that allows the "archive" beneath to peek through.



---



## 3. Typography: Scholarly Precision

We pair the intellectual weight of a serif with the clinical precision of a modern sans-serif.



* **The Intellectual Voice (Newsreader):** Used for all `Display`, `Headline`, and `Title` styles. This conveys a sense of history and scholarly depth.

* *Styling Note:* Use `display-lg` (3.5rem) with generous leading for hero statements.

* **The Functional Voice (Manrope):** Used for all `Body` and `Label` styles. This provides the "modern tool" feel required for a digital archive.

* *Styling Note:* Use `body-md` (0.875rem) for most reading text to maintain an elegant, slightly smaller-than-average aesthetic.



---



## 4. Elevation & Depth: Tonal Layering

Traditional shadows are too heavy for this system. We use "Ambient Depth."



* **The Layering Principle:** Depth is achieved by placing the lightest colors (`surface-container-lowest` / #ffffff) on top of the base grey (`surface` / #f9f9f9). This creates a "natural lift" akin to a sheet of paper resting on a stone desk.

* **Ambient Shadows:** If an element must float (e.g., a modal), use a shadow color derived from the `on-surface` token: `rgba(45, 52, 53, 0.04)` with a blur of 40px and a Y-offset of 10px.

* **The "Ghost Border" Fallback:** If accessibility requires a container edge, use the `outline-variant` (#adb3b4) at **15% opacity**. It should be felt, not seen.



---



## 5. Components: Soft Architecture



### Buttons

* **Primary:** A soft gradient of `primary` to `primary-dim`. Roundedness: `md` (0.375rem). No hard shadows.

* **Secondary/Tertiary:** Text-only (Manrope, Medium weight) with a `primary` color. On hover, a subtle `surface-container-high` background fill appears.



### Input Fields

* **Styling:** Forgo the "box." Use a `surface-container-lowest` fill with a bottom-only `outline-variant` at 20% opacity.

* **Focus State:** The bottom border transitions to `primary` (#8e4a4b).



### Cards & Lists

* **No Dividers:** Prohibit the use of horizontal lines.

* **Verticality:** Use the `spacing-8` (2.75rem) scale to separate list items.

* **Grouping:** Use a subtle `surface-container-low` background block to group related archival items.



### Custom Component: The "Archival Header"

A layout pattern where the `display-sm` Newsreader title is top-left aligned, while the `label-md` Manrope metadata is rotated 90 degrees or offset far-right to create a sophisticated, asymmetrical editorial feel.



---



## 6. Do’s and Don’ts



### Do

* **Do** use extreme whitespace. If it feels like "too much," it’s likely just right for this system.

* **Do** use `Newsreader` in Italic for pull quotes or emphasis within body text to enhance the scholarly tone.

* **Do** use the desaturated red (`primary`) only for the most important actions or "active" states.



### Don’t

* **Don’t** use pure black (#000000) for text. It breaks the "soft archive" feel. Use `on-surface` (#2d3435).

* **Don’t** use `none` or `full` roundedness for cards; stick to `md` (0.375rem) or `lg` (0.5rem) to maintain a "soft-geometric" architectural look.

* **Don’t** use standard Material Design icons in heavy weights. Use "Light" or "Thin" weight icons to match the Newsreader strokes.