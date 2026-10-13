# Design System & UI Guidelines — Personal Portfolio Website

## Design Philosophy

- **Content first** — typography and whitespace do the heavy lifting
- **Minimal but not sterile** — personality through writing, not decoration
- **No gratuitous animation** — motion only for functional feedback (hover, focus, transition)
- **Readable at all times** — both light and dark mode must have excellent contrast

Inspired by: rimzzlabs.com, paco.me, leerob.com

---

## Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| Body & UI | `Geist` | `system-ui, sans-serif` |
| Headings (display) | `Source Serif 4` | `Georgia, serif` |
| Code / Monospace | `Geist Mono` | `ui-monospace, monospace` |

Source: `fontsource` (self-hosted, no Google Fonts request at runtime)

```css
/* global.css */
@import '@fontsource-variable/geist';
@import '@fontsource-variable/source-serif-4';
@import '@fontsource/geist-mono';
```

Headings (`h1`–`h4`) are set to the serif stack globally, with `letter-spacing: -0.015em`. Body text stays on Geist. `Source Serif 4` is the closest free stand-in for the serif Anthropic uses for display type.

### Type Scale

| Token | Size | Usage |
|---|---|---|
| `text-xs` | 12px | Labels, badges, metadata |
| `text-sm` | 14px | Secondary text, captions |
| `text-base` | 16px | Body text, nav links |
| `text-lg` | 18px | Lead paragraphs |
| `text-xl` | 20px | Card titles |
| `text-2xl` | 24px | Section headings (h2) |
| `text-3xl` | 30px | Page headings (h1 mobile) |
| `text-4xl` | 36px | Hero heading (desktop) |

### Type Rules

- Line height: `leading-relaxed` (1.625) for body, `leading-tight` for headings
- Max line length: `max-w-prose` (65ch) for article content
- Font weight: 400 body, 500 nav, 600 headings

---

## Color System

All colors defined as CSS variables in `global.css`, consumed via Tailwind. Inspired by Anthropic / Claude warm, editorial palette.

### Light Mode (`:root`)

```css
:root {
  --color-bg:          #faf9f5;   /* Warm cream */
  --color-bg-subtle:   #f2f1ec;   /* Slightly darker cream */
  --color-border:      #e6e4dc;   /* Subtle warm border */
  --color-text:        #2a2523;   /* Warm brown charcoal */
  --color-text-muted:  #6f6862;   /* Muted warm brown */
  --color-accent:      #c25e38;   /* Claude terracotta / burnt orange */
  --color-accent-hover:#a84e2c;   /* Darker terracotta */
}
```

### Dark Mode (`.dark`)

```css
.dark {
  --color-bg:          #141413;   /* Deep warm dark */
  --color-bg-subtle:   #1c1c1a;   /* Slightly lighter dark */
  --color-border:      #292825;   /* Dark warm border */
  --color-text:        #e8e2d8;   /* Warm cream */
  --color-text-muted:  #9a9188;   /* Muted warm taupe */
  --color-accent:      #d97757;   /* Bright terracotta */
  --color-accent-hover:#e08c6f;   /* Hover terracotta */
}
```

### Usage Rules

- Use `--color-text-muted` for dates, metadata, secondary labels
- Use `--color-accent` for links and interactive elements only
- Never use raw hex values in components — always go through CSS variables or Tailwind tokens
- Background of pages: `--color-bg`, subtle sections: `--color-bg-subtle`

---

## Spacing & Layout

### Container

```css
/* max width for main content */
.container {
  max-width: 680px;   /* narrow, editorial feel */
  margin: 0 auto;
  padding: 0 1.5rem;
}
```

- Narrow container (680px) for all main content — enforces readability
- Full-width only for navbar and footer

### Spacing Scale

Follow Tailwind's default spacing scale. Key values used:

| Usage | Value |
|---|---|
| Section gap | `gap-16` / `mb-16` |
| Component gap | `gap-8` / `mb-8` |
| Internal padding | `p-4` / `p-6` |
| Inline gap | `gap-2` / `gap-3` |

---

## Components

### Navbar

- Fixed or sticky at top
- Items: Home, Notes, Now, Archive — right side: Lang toggle, Theme toggle
- Mobile: hamburger or simplified inline (links collapse below logo)
- No background blur or heavy glassmorphism — subtle border-bottom in light mode

### Theme Toggle

- Icon only: sun (light) / moon (dark)
- `aria-label="Toggle theme"`
- No animation required, just swap icon

### Lang Toggle

- Text button: `EN` / `ID`
- Active lang is visually distinct (font-weight or underline)
- `aria-label="Switch language"`

### Project Card

```
┌─────────────────────────────────┐
│ Title                    Role   │
│ Short description               │
│                                 │
│ [Tech] [Stack] [Badges]         │
│                                 │
│ ↗ Live   ↗ GitHub               │
└─────────────────────────────────┘
```

- No heavy card shadow — subtle border or borderless with hover underline
- Role badge: small, muted — `Creator`, `Maintainer`, `Contributor`

### Note Card (list item)

```
Sep 27, 2026  —  Title of the Note
```

- Date on the left, title on the right
- Minimal — no card box, just a row
- Hover: accent color on title

### Badge (tech stack)

- Small pill: `text-xs`, `px-2 py-0.5`, rounded-full
- Background: `--color-bg-subtle`, border: `--color-border`
- No color coding per technology in v1

---

## Motion & Animation

**Principle: restraint.**

Allowed:
- `transition-colors duration-150` on links and buttons (hover state)
- `transition-opacity duration-200` on page load fade (optional, very subtle)

Not allowed:
- Scroll-triggered animations
- Entrance animations on page load
- Parallax effects
- Loading skeletons with shimmer

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

---

## Icons

Lucide, via `astro-icon` + `@iconify-json/lucide`, wrapped by `src/components/ui/Icon.astro`. Components pass semantic names (`github`, `layout-wide`); the mapping to `lucide:*` lives in that one file. SVGs are inlined at build — no icon JavaScript ships to the reader.

Icons in use:
- `contrast` — theme toggle
- `sliders` — settings menu
- `languages`, `check`, `monitor`, `power`, `layout-*` — settings menu options
- `github` / `linkedin` / `mail` — social links
- `rss` — RSS feed
- `arrow-up-right` — external links

Line weight is Lucide's default and is deliberately left alone — matching the reference required no stroke overrides.

---

## Profile Picture

The hero avatar is a circular frame holding two images. On hover the top image dissolves into a grid of blocks with randomised per-block delays, revealing the second one underneath. See the Mosaic Dissolve section in `rules.md` for the implementation contract.

- Round, like a social platform avatar
- Positioned left of the hero heading on desktop, above it on mobile
- The only expressive effect on the site; every other motion stays a 150–200ms colour or opacity transition

---

## MDX Article Styles

Applied via `prose` class from `@tailwindcss/typography`, customized:

- Headings: no `#` prefix styling — clean hierarchy
- Code blocks: monospace, subtle background, no line numbers in v1
- Inline code: `bg-subtle`, rounded, small padding
- Blockquote: left border accent color, muted text
- Links: accent color, underline on hover

---

## Responsive Breakpoints

| Name | Min width | Usage |
|---|---|---|
| `sm` | 640px | Tablet start |
| `md` | 768px | Layout shifts |
| `lg` | 1024px | Desktop baseline |

Mobile-first approach. Default styles target mobile, `md:` and `lg:` override upward.

---

## Do's and Don'ts

**Do:**
- Use whitespace generously
- Keep nav links to 4–5 max
- Let the writing speak
- Maintain consistent vertical rhythm

**Don't:**
- Add hero illustrations or 3D elements
- Add background gradients to section headers
- Add a fourth font family
- Use more than 2 accent colors
