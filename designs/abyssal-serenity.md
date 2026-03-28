# The Design System: Zen Editorial

## 1. Overview & Creative North Star: "The Submerged Gallery"
This design system rejects the frantic, high-contrast layouts of traditional SaaS. Our Creative North Star is **"The Submerged Gallery."** Imagine an art space viewed through clear, still water. It is quiet, expansive, and deeply intentional.

We achieve a premium, custom feel by abandoning traditional "box-and-line" UI. Instead of rigid borders, we use **Tonal Drift**—the subtle shift of blue-greys—to define space. By pairing the mathematical precision of Outfit with the rhythmic, humanistic curves of Fraunces, we create a digital environment that feels curated, not manufactured.

---

## 2. Color & Atmospheric Depth
Our palette is a study in monochromatic serenity. We use "Zen Blue" not as a single accent, but as a spectrum of light and pressure.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be established solely through:
1. **Background Shifts:** Transitioning from `surface` (#f7fafc) to `surface_container_low` (#f1f4f6).
2. **Negative Space:** Utilizing the larger increments of our spacing scale (e.g., `spacing.12` or `16`) to let content breathe.

### Surface Hierarchy & Nesting
Treat the UI as layered sheets of heavy, vellum paper.
* **Base Layer:** `surface` (#f7fafc).
* **Secondary Content:** `surface_container` (#ebeef0).
* **Interactive Cards:** `surface_container_lowest` (#ffffff) to provide a "lifted" appearance without heavy shadows.

### The "Glass & Gradient" Rule
To evoke the "Deep Sea" theme, use Glassmorphism for floating navigation or overlays. Apply `surface_variant` at 60% opacity with a `20px` backdrop blur. For primary CTAs, apply a subtle linear gradient from `primary` (#3b4d60) to `primary_container` (#536578) at a 135-degree angle to add "soul" and dimension.

---

## 3. Typography: The Editorial Voice
We contrast two distinct personalities to create a rhythmic hierarchy.

* **Fraunces (Display & Headlines):** Used for `display-lg` through `headline-sm`. This is our "Editorial Flair." It should feel like a title in a high-end magazine. Use `on_surface` (#181c1e) for maximum authority.
* **Outfit (UI & Body):** (Interchanged for `manrope` in technical implementation). Used for `title`, `body`, and `labels`. Its geometric clarity ensures that even in "meditative" layouts, functionality remains sharp and legible.

**Designer’s Tip:** Use `display-lg` with generous leading and `primary` (#3b4d60) coloring for hero moments to anchor the user's focus instantly.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "noisy" for a Zen system. We move toward **Ambient Depth.**

* **The Layering Principle:** Instead of shadows, stack containers. Place a `surface_container_lowest` card atop a `surface_container` background. The change in hex code provides enough contrast to signify "top-level" without visual clutter.
* **Ambient Shadows:** If a floating element (like a Modal) requires a shadow, use a blur of `40px`, a spread of `-10px`, and a color of `on_surface` (#181c1e) at **only 4% opacity**.
* **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline_variant` (#c3c6ce) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
* **Primary:** Background: `primary` (#3b4d60); Text: `on_primary` (#ffffff). Shape: `rounded-md` (0.75rem).
* **Secondary:** Background: `secondary_container` (#c6e4f4); Text: `on_secondary_container` (#4a6774).
* **Interaction:** On hover, shift background to `primary_container`. Avoid sudden color snaps; use a `300ms` ease-in-out transition.

### Cards & Lists
* **Strict Rule:** No divider lines between list items. Use `spacing.4` (1.4rem) of vertical white space or alternate subtle background tints between `surface` and `surface_container_low`.
* **Roundness:** All cards must use `DEFAULT` (0.5rem/8px) to maintain the "Zen Blue" soft-radius aesthetic.

### Input Fields
* **Style:** Minimalist. No bottom line or full box. Use `surface_container_high` (#e5e9eb) as a solid background fill with a `rounded-sm` corner.
* **Focus:** Transition the background to `surface_container_highest` and add a "Ghost Border" of `primary` at 20% opacity.

### Featured Component: The Meditative Blur-Chip
Used for filtering or categories. These are semi-transparent `secondary_fixed_dim` (#adcbda) pills with a `backdrop-blur`. They should look like pebbles polished by the sea.

---

## 6. Do's and Don'ts

### Do:
* **Do** use asymmetrical layouts. A headline might be offset to the left while body text sits in a narrower column to the right.
* **Do** embrace the "Deep Sea" by using `on_primary_fixed` (#091d2e) for heavy emphasis text—it provides a deep navy weight that feels more premium than black.
* **Do** use `Fraunces` in italic for pull-quotes or sub-headers to emphasize the "Editorial" feel.

### Don't:
* **Don't** use 100% black (#000000). Always use `on_surface` or `on_background` for text.
* **Don't** use standard "Material Design" shadows. They are too aggressive for this calm aesthetic.
* **Don't** crowd the interface. If you feel you need a divider line, you actually need more whitespace.