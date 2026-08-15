---
name: "Dracula Theme for 400+ apps"
category: Brands
surface: web
colors:
  void: "#0e0d11"
  crypt: "#1c1b22"
  moth: "#c2c0ce"
  fog: "#b2afc0"
  hairline: "#383645"
  vampire-purple: "#7359f8"
  slime-green: "#66f859"
---

# Dracula Theme for 400+ apps

> Category: Brands

> Surface: web

*One theme. All platforms.*

Dracula is a color scheme for code editors and terminal emulators such as Vim, Notepad++, iTerm, VSCode, Terminal.app, ZSH, and much more.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Void | `#0e0d11` | page canvas — measured html[data-theme=dark] --background-color-primary, matches <meta name="theme-color"> |
| surface | Crypt | `#1c1b22` | cards / raised surfaces — --background-color-secondary (nav panel, theme list cards) |
| foreground | Moth | `#c2c0ce` | body text — default <body> color-body; headings run one step brighter at #d3d1db |
| muted | Fog | `#b2afc0` | secondary text — --color-caption (nav labels, figure captions) |
| border | Hairline | `#383645` | hairlines / dividers — --background-color-tertiary, used directly as border-color on hr/table/blockquote |
| accent | Vampire Purple | `#7359f8` | primary interactive color — html::selection background, default --color for prose links/focus rings |
| accent-secondary | Slime Green | `#66f859` | secondary accent — homepage search/filter active state, Team Pick badge |

## Typography
- **Display:** DM Sans — weights 400, 500, 600, 700 — fallbacks: system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif
- **Body:** DM Sans — weights 400, 500, 600, 700 — fallbacks: system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif
- **Mono:** DM Mono — weights 400 — fallbacks: ui-monospace, SFMono-Regular, Menlo, monospace

## Voice & Tone

- **Adjectives:** nocturnal, developer-native, vivid-on-dark, playful-gothic, precise
- **Tone:** Plain, utilitarian product copy for the core theme ("a color scheme for code editors and terminal emulators") with gothic humor kept for flavor, not the pitch — vampire/horror references show up in variant codenames and error states, not marketing hype. Dracula Pro's copy adds a more considered, craft-focused register: precision, mathematics, and productivity ("a more refined and mathematical approach", "engineered for relentless precision").

### Messaging pillars
- One theme. All platforms. — a single color scheme ported to 400+ editors, terminals, IDEs and tools.
- The most famous theme ever created and available everywhere. — footer tagline, leaning on incumbency and ubiquity rather than novelty.
- Made for terminals, code editors, and all your favorite tools — designed to be aesthetically pleasing while keeping you focused. — Dracula Pro's positioning quote.

### Vocabulary
- **Use:** theme, palette, color scheme, terminal, editor, Pro, Alucard (the light variant), hue circle, focus, off-grid / castle (playful, used sparingly for empty/error states)
- **Avoid:** marketing superlatives ("revolutionary", "game-changing"), generic SaaS buzzwords, corporate/enterprise tone

## Imagery

- **Style:** Real product screenshots of code editors and terminals wearing the Dracula palette are the primary imagery, not illustration. The one recurring illustrated motif is a moon-and-bat mark; each of the 400+ supported apps gets a small monster-themed icon reskin (frankenstein, zombie, ghost, pumpkin, skeleton...) instead of the app's real logo.
- **Subjects:** themed editor/terminal UI screenshots, the moon-and-bat hero mark, monster-icon reskins standing in for each supported app's logo, founder portrait (Zeno Rocha), geometric hue-circle color-theory diagrams
- **Treatment:** Dark-canvas-first: screenshots and photos sit directly on the near-black page background with no card chrome or drop shadow, so the themed editor UI itself supplies the color. Squircle-rounded image corners, generous negative space, minimal captioning.
- **Avoid:** generic stock photography of people/offices, bright daylight scenes, gradient-mesh illustrations, real third-party app logos (replaced by monster-icon reskins by design)

## Layout

- **Radius:** 6px / 12px / 18px — three-step scale (--radius-sm/md/lg), applied as CSS corner-shape:squircle rather than plain border-radius
- **Border weight:** 1px
- **Spacing:** rem-based, not a fixed grid — page padding 24px vertical / 36px horizontal desktop, section rhythm ~66px desktop / ~42px mobile, card padding 18px

### Posture rules
- Squircle corners everywhere (superellipse via CSS corner-shape), not plain rounded rects — buttons, cards, nav panel, tables, blockquotes.
- Depth comes from tonal steps between background/surface/tertiary layers, not shadows or borders-as-accent.
- One accent active at a time: the interactive color variable is reassigned contextually (purple site-wide default -> green on the homepage nav/filter/search) rather than mixing accents on one surface.
- Text selection is branded — html::selection uses the accent purple, a small but consistent signature detail worth replicating.
- Six-color 'vampire' swatch set — purple #7359f8, pink #f859a8, cyan #5cf5db, green #66f859, red #f87359, orange #f8b659, yellow #f8f859 (dark theme) — is reserved for theme-swatch UI and editor previews, never used as general page chrome.
- Images sit directly on the page background with no card frame; the themed screenshot itself is the decoration.
- Motion is quick and elastic, not linear: durations 180ms (fast) / 240ms (standard) / 300ms (slow); easings --ease-fluid cubic-bezier(.36,.66,.6,1) for color/outline transitions, --ease-elastic cubic-bezier(.42,0,.58,1.8) for transform (buttons overshoot slightly on hover). Press feedback is a 2% scale-down + 1px translateY, not a color flash. Cards fade up on scroll (opacity .6->1, translateY 1em->0, animation-timeline:view()).
- Trust and conversion cues are logo-wall + verified-count, not badges: a grayscale 'Trusted by' row of enterprise logos (Amazon, Apple, Google, Meta, Microsoft, Netflix...), testimonials tagged with reviewer name + ISO country code, an exact subscriber count ('11,460 people enjoy it'), and a live app-picker that swaps the hero screenshot instead of a static gallery.
