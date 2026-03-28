# Design System Strategy: The Sun-Drenched Editorial

## 1. Overview & Creative North Star: "Radiant Organicism"
This design system moves away from the sterile, rigid grids of traditional SaaS and toward a "Radiant Organicism." The goal is to capture the feeling of a sun-filled studio: warm, tactile, and brimming with energy.

**The Creative North Star: The Golden Hour Gallery.**
We treat the screen not as a digital interface, but as a physical space illuminated by natural light. We break the "template" look by utilizing intentional asymmetry—placing oversized `display-lg` typography in Space Grotesk against generous `16 (5.5rem)` white space. Elements should feel like they are "resting" on a surface rather than being "locked" into a grid. Use overlapping components (e.g., a chip partially masking the corner of a card) to create a custom, high-end editorial feel that suggests human intent over machine logic.

---

## 2. Colors: The Palette of Warmth
The color strategy is built on the interplay between the "Golden Yellow" (`primary`) and the "Burnt Orange" (`secondary`), anchored by a base of "Warm Off-White" (`surface`).

* **Primary (Golden Yellow):** Used for moments of high energy and brand soul. Use `primary_container` (#feb700) for large, impactful areas.
* **Secondary (Burnt Orange):** Used for direction and urgency. It provides the "burnt" depth that prevents the yellow from feeling juvenile.
* **The "No-Line" Rule:** Under no circumstances should 1px solid borders be used to separate sections. Structure must be defined by background shifts. For example, a hero section in `surface` (#f7f6f3) transitions into a feature block in `surface_container_low` (#f1f1ee).
* **Surface Hierarchy & Nesting:** Treat the UI as layers of fine paper.
* *Base:* `surface`
* *Nested Cards:* `surface_container_lowest` (#ffffff) to create a subtle "pop" of clean white.
* **The "Glass & Gradient" Rule:** For floating navigation or elevated modals, use `surface` with an 80% opacity and a `backdrop-blur` of 20px. Enhance main CTAs with a subtle linear gradient from `primary` (#785500) to `primary_container` (#feb700) at a 135-degree angle to simulate the shimmer of sunlight.

---

## 3. Typography: Modernity Meets Warmth
We utilize a high-contrast pairing to balance technical precision with approachable storytelling.

* **Space Grotesk (UI & Headlines):** This is our "modern" voice. Use `display-lg` and `headline-lg` for impactful, short-form messaging. The geometric nature of Space Grotesk provides the necessary "tech" edge to the warm color palette.
* **Lora (The Human Element):** While the tokens specify Plus Jakarta Sans for body text, for a high-end editorial feel, **Lora** (as requested in the theme) should be used for `body-lg` and `body-md` to introduce a friendly, literary serif quality.
* **Hierarchy:**
* **Headlines:** Tight tracking (-2%) and bold weights to create a "poster" effect.
* **Body:** Generous line-height (1.6) in Lora to ensure the "warm and approachable" promise is met through readability.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "digital." We use light and tone to imply physics.

* **The Layering Principle:** Avoid elevation shadows where possible. Instead, stack `surface_container_high` elements on `surface` backgrounds. The subtle delta in hex values creates a sophisticated, "quiet" depth.
* **Ambient Shadows:** If an element must float (like a FAB or Popover), use a "Sunlit Shadow":
* *Blur:* 40px, *Y-Offset:* 12px.
* *Color:* Use a 6% opacity version of `secondary` (#a33700) instead of black. This makes the shadow feel like a warm glow rather than a dark hole.
* **The "Ghost Border" Fallback:** If a container requires definition against a similar background, use `outline_variant` (#adadab) at 15% opacity. It should be felt, not seen.
* **Rounding:** Apply the **Round 16 (`1rem`)** as the default. For signature elements like "Playful" buttons or chips, push to `xl` (`3rem`) or `full` to emphasize the approachable, soft-touch nature of the system.

---

## 5. Components: Intentional Primitives

* **Buttons:**
* *Primary:* `primary_container` background with `on_primary_container` text. Use `xl` (`3rem`) rounding. No borders.
* *Secondary:* Ghost style with a 20% opacity `primary` fill.
* **Cards:** Forbid divider lines. Use `3 (1rem)` padding and separate internal sections with a shift from `surface_container_lowest` to `surface_container`.
* **Input Fields:** Use `surface_container_low` as the background with a `3px` bottom-only border in `primary_fixed` when focused. This creates a high-end "stationery" look.
* **Chips:** Always use `full` rounding. Use `secondary_container` (#ffc4b0) for active states to provide a warm, burnt-orange highlight.
* **Navigation:** A floating "Island" nav is preferred. Use the **Glassmorphism** rule (surface + backdrop blur) and `xl` rounding to make it feel like a premium tool.

---

## 6. Do’s and Don’ts

**Do:**
* **Do** use asymmetrical layouts. Place a large `display-sm` headline on the left and a small `body-md` paragraph offset to the right.
* **Do** use "Sun-Drenched" imagery—photos with high warmth, natural lens flares, and soft focus.
* **Do** embrace white space. Use the `16` and `20` spacing tokens to let the typography breathe.

**Don’t:**
* **Don’t** use 1px solid borders. It shatters the "editorial" feel and makes it look like a generic dashboard.
* **Don’t** use pure black (#000000) for text. Always use `on_surface` (#2e2f2d) to keep the contrast soft and readable.
* **Don’t** use standard "drop shadows." If it doesn't look like ambient light, don't use it.
* **Don’t** cram content. If a section feels tight, upgrade the spacing token by two steps.