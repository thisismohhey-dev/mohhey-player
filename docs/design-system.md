# Design system

Source of truth: `apps/desktop/renderer/src/styles/main.css` (tokens). shadcn-vue components consume the same variable names.

- **Direction:** warm paper surfaces, near-black ink, one vermilion accent (`--brand`), generous whitespace, huge display
  headings (reference `docs/template/03.webp`), a blurred-artwork Now Playing view (`04`), floating rounded cards (`05`).
- **Type** (from `docs/fonts`): *PP Neue Montreal* (display, headings, brand) · *Inter* variable (UI/body) ·
  *Geist Mono* (times, numerals, key caps). *Vazirmatn* (variable, SIL OFL) covers Persian/Arabic glyphs; Persian text gets zero letter-spacing so letters stay joined.
- **Radius:** 12 px rows/thumbs · 20 px cards · 28 px player bar · full pills for buttons.
- **Elevation:** `shadow-card`, `shadow-float`; borders are 9 % ink.
- **Themes:** light/dark/system via `.dark` token overrides; the Now Playing view always renders with the dark tokens.
- **Motion:** 160–260 ms, ease-out; all motion collapses under `prefers-reduced-motion`.
- **Layout:** logical properties (`ms-`, `ps-`, `start-`, `end-`), `dir="auto"` on user text, copy in `locales/en.ts`.
  Adding Persian and `dir="rtl"` needs a dictionary, not CSS rewrites.
