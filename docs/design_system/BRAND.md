# Dracula Theme for 400+ apps — Brand Guide

*One theme. All platforms.*

Dracula is a color scheme for code editors and terminal emulators such as Vim, Notepad++, iTerm, VSCode, Terminal.app, ZSH, and much more. Created in 2013 by Zeno Rocha after a stolen laptop forced him to reconfigure his whole setup, it's grown into one of the most-ported themes in the world (400+ apps, +23K GitHub stars) with a paid "Pro" tier (Dracula Pro) for creators who want a more refined, mathematically-tuned palette plus a light companion variant called **Alucard**.

Extracted and re-measured from https://draculatheme.com/ (default rendered state: `data-theme="dark"`).

## Color roles

Measured from the site's own dark theme (its default — `--hue:250`), not the classic 2013 editor spec. Every hex below is a literal computed-style capture, not a guess.

| Role | Name | Hex | OKLCH | Usage |
| --- | --- | --- | --- | --- |
| Background | Void | `#0e0d11` | `oklch(16.2% 0.008 296.9)` | Page canvas. Matches the site's `<meta name="theme-color">` exactly. |
| Surface | Crypt | `#1c1b22` | `oklch(22.6% 0.014 291.8)` | Cards / raised surfaces (nav panel, theme list cards). |
| Foreground | Moth | `#c2c0ce` | `oklch(81.4% 0.020 292.5)` | Body text. Headings sit one step brighter (`#d3d1db`). |
| Muted | Fog | `#b2afc0` | `oklch(76.2% 0.024 293.9)` | Secondary text — captions, nav labels. |
| Border | Hairline | `#383645` | `oklch(34.1% 0.026 291.1)` | Hairlines / dividers — used directly as the border color on `hr`, tables, blockquotes. |
| Accent | Vampire Purple | `#7359f8` | `oklch(58.2% 0.226 284.4)` | Primary interactive color: `::selection` background, default link/focus color. |
| Accent secondary | Slime Green | `#66f859` | `oklch(86.8% 0.236 142.0)` | Homepage search/filter active state, Team Pick badge. |

**Extended "vampire" swatch set** (dark theme) — reserved for theme-swatch UI and editor previews, never used as page chrome: purple `#7359f8` · pink `#f859a8` · cyan `#5cf5db` · green `#66f859` · red `#f87359` · orange `#f8b659` · yellow `#f8f859`. The same seven vars resolve to darker, less saturated hexes in the site's light theme (e.g. cyan `#036a96`, green `#14710a`) — treat those as a separate light-mode palette, not a mixing option with the dark tokens above.

## Typography

- **Display / Body:** DM Sans — weights 400, 500, 600, 700 ([Google Fonts](https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap)). Headings are weight 600 by default.
- **Mono:** DM Mono — weight 400 ([Google Fonts](https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&display=swap)). Used for `code`/`kbd` only.

## Logo

The header nav is a **plain text wordmark** ("Dracula **Theme**" in DM Sans) — there is no lockup SVG in the page chrome. The real vector mark is a moon-and-bat icon (`logos/hero-icon.svg`, from `/images/hero/default.svg`), shown as a 190×190 avatar next to the H1. Alternates: `logos/favicon-1.ico` (256×256 ICO, the only icon `<link>` the site publishes — no SVG favicon or apple-touch-icon exists) and `logos/og-image-2.webp` (social card). Reproduce the wordmark as styled text, not a raster crop, when you need the header lockup.

## Voice & tone

**Adjectives:** nocturnal, developer-native, vivid-on-dark, playful-gothic, precise.

**Tone:** Plain, utilitarian product copy for the core free theme — the meta description reads simply "a color scheme for code editors and terminal emulators." Gothic/vampire humor is real but kept for flavor and edge states (variant codenames like Blade, Buffy, Lincoln, Morbius, Van Helsing; the JS-disabled fallback literally reads "JavaScript is resting in its coffin"), not for the core pitch. Dracula Pro's copy shifts register toward craft and precision: "a more refined and mathematical approach," "engineered for relentless precision," WCAG-contrast specifics.

**Messaging pillars:**
- "One theme. All platforms." — one color scheme, ported to 400+ editors/terminals/IDEs.
- "The most famous theme ever created and available everywhere." — footer tagline; leans on incumbency, not novelty.
- "Made for terminals, code editors, and all your favorite tools — designed to be aesthetically pleasing while keeping you focused." — Dracula Pro's positioning line.

**Vocabulary — use:** theme, palette, color scheme, terminal, editor, Pro, Alucard (the light variant), hue circle, focus.
**Vocabulary — avoid:** marketing superlatives ("revolutionary," "game-changing"), generic SaaS buzzwords, corporate/enterprise tone.

## Imagery

Real product screenshots of themed editors/terminals are the primary imagery — not illustration. The one recurring illustrated motif is the moon-and-bat mark; each of the 400+ supported apps gets a small monster-icon reskin (frankenstein, zombie, ghost, pumpkin, skeleton...) standing in for that app's real logo. Images sit directly on the near-black canvas with no card frame or drop shadow — the themed UI itself supplies the color. Avoid stock photography, daylight scenes, gradient-mesh illustrations, and real third-party logos.

Samples saved to `imagery/`: social cover, Dracula Pro hero illustration, two VS Code product screenshots (Pro dark + Alucard light), founder portrait, e-book cover.

## Layout posture

- **Squircle corners everywhere** — CSS `corner-shape:squircle` (a true superellipse), not plain `border-radius`, on buttons, cards, the nav panel, tables, and blockquotes.
- **Three-step radius scale:** 6px (sm — inputs, actions) · 12px (md) · 18px (lg — cards, nav panel).
- **1px hairline borders** drawn from the tertiary background tone, not a dedicated border color — depth comes from tonal steps (background → surface → tertiary), not shadows.
- **One accent active at a time:** the interactive color variable is reassigned per-context (purple site-wide default → green on the homepage nav/filter/search) instead of mixing accents on one surface.
- **Branded text selection** — `::selection` uses the accent purple, a small but consistent signature worth replicating.
- Spacing is rem-based rather than a fixed pixel grid: ~24px/36px page padding (vertical/horizontal) on desktop, ~66px section rhythm, 18px card padding.

## Motion & interaction

Measured from `--duration-*` / `--ease-*` custom properties and applied transitions — quick and slightly elastic, never linear or bouncy-slow:

- **Durations:** 180ms fast · 240ms standard · 300ms slow.
- **Easings:** `--ease-fluid` `cubic-bezier(.36,.66,.6,1)` drives color/outline transitions (focus rings, hover text). `--ease-elastic` `cubic-bezier(.42,0,.58,1.8)` drives transform — buttons/cards overshoot slightly on hover instead of easing flat.
- **Press feedback:** buttons scale to 98% + translateY 1px on `:active` — a physical nudge, not a color flash.
- **Scroll-in:** list cards fade and rise on entry (`opacity .6→1`, `translateY 1em→0`) driven by `animation-timeline: view()` — no JS scroll listener.
- **Micro-detail:** a checkbox/radio checkmark draws itself in via `stroke-dashoffset` (`draw-tick`), ~540ms.

## Design patterns & trust cues

Reusable conventions worth carrying into new pages built on this system:

- **Trust logo wall:** a grayscale row of enterprise logos ("Trusted by creators from:" — Amazon, Apple, Google, Meta, Microsoft, Netflix, Nvidia, Oracle, Salesforce, Samsung...) rather than a badge or stat claim.
- **Testimonials carry provenance:** reviewer name + ISO country code ("Shan Shah — From PK"), plus an exact verified-customer count ("193 verified customers") instead of a round marketing number.
- **Exact, not rounded, social proof:** "11,460 people enjoy it" on the newsletter block, "+23K" GitHub stars in the header — specificity reads as more credible than "10K+".
- **Live product preview over static gallery:** an app-select combobox swaps the hero screenshot live, so the visitor sees *their* tool themed, not a generic carousel.
- **FAQ as disclosure/accordion**, not a wall of text.
- **Accessibility is stated, not implied:** Alucard (the light variant) is explicitly framed as meeting WCAG AA, and Pro copy cites the exact contrast ratio (4.5:1) — accessibility as a feature claim, not fine print.

## Provenance

- Source: https://draculatheme.com/ (rendered dark theme, live-measured via computed styles — not inferred from screenshots).
- theme-color meta (`#0E0D11`) independently confirms the measured background token.
- Not measured / left as a caveat: the site's light-theme (`data-theme="light"`) token set is documented above for reference only and is not carried into the registered design-system roles, which represent the dark (default) experience. No apple-touch-icon or manifest icon set exists to extract.
