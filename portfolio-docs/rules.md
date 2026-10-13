# Development Rules & Conventions — Personal Portfolio Website

This document defines the standards that all code in this project must follow. It exists so that both the developer and any AI agent working on this codebase produce consistent, predictable output.

---

## General Principles

1. **Readability over cleverness** — simple, explicit code is preferred over terse, clever code
2. **Minimal dependencies** — do not add a package if it can be reasonably done in < 20 lines of code
3. **No premature abstraction** — abstract only when the same pattern appears 3+ times
4. **File-by-feature** — keep related files close together; avoid deep nesting
5. **One responsibility per file** — a component does one thing; a utility does one thing

---

## File & Folder Naming

| Type | Convention | Example |
|---|---|---|
| Astro components | `PascalCase.astro` | `ProjectCard.astro` |
| Layout files | `PascalCase.astro` | `BaseLayout.astro` |
| Page files | `kebab-case.astro` | `index.astro`, `now.astro` |
| Dynamic pages | `[param].astro` | `[slug].astro` |
| Utility files | `camelCase.ts` | `utils.ts`, `constants.ts` |
| i18n files | `lowercase.json` | `en.json`, `id.json` |
| Content files | `kebab-case.mdx` / `.json` | `my-first-post.mdx` |
| CSS files | `kebab-case.css` | `global.css` |

---

## TypeScript Rules

- **Strict mode on** — `tsconfig.json` must have `"strict": true`
- **No `any`** — use `unknown` and narrow with type guards if the type is genuinely unknown
- **Prefer `type` over `interface`** for object shapes unless you need declaration merging
- **Explicit return types** on all exported functions
- **No unused variables or imports** — enforced by linter

```ts
// ✅ Good
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

// ❌ Bad
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}
```

---

## Component Rules

### Astro Components

- Props must be typed with an explicit `interface Props` at the top of the component script
- Destructure props immediately — do not reference `Astro.props` inline in the template

```astro
---
// ✅ Good
interface Props {
  title: string
  href: string
  external?: boolean
}

const { title, href, external = false } = Astro.props
---
```

- Use `<slot />` for content projection — do not pass HTML as a string prop
- Prefer Astro components for static UI; only use framework components (Svelte, React) when interactivity is required

### Component Size

- If an `.astro` file exceeds ~150 lines, consider splitting it
- UI primitives go in `src/components/ui/`
- Page-level sections go in `src/components/sections/`
- Navigation / structural components go in `src/components/layout/`

---

## Styling Rules

- **Tailwind utility classes first** — `<style>` blocks in `.astro` files only for effects utilities cannot express: pseudo-element state machines, `:hover` on non-utility targets, keyframes. See `Pfp.astro` for the accepted pattern.
- **No raw hex/rgb values** — use CSS variables defined in `global.css` or Tailwind tokens
- **Dark mode** via `dark:` variant — always test both themes when adding a new component
- **Class ordering** — follow Tailwind's recommended order: layout → sizing → spacing → typography → color → effects

```astro
<!-- ✅ Good -->
<a class="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors">

<!-- ❌ Bad -->
<a style="color: #6b7280; font-size: 14px;">
```

### Surface Colours Belong in CSS, Not on `<body>`

Page background and text colour are declared once in `@layer base` in `global.css`. Do not put `bg-bg text-text` on `<body>` as a Tailwind utility class.

A layout refactor that replaces the body's class list — for example swapping it to `flex min-h-dvh flex-col` — silently drops those utilities with the rest. The result is a body with `background-color: rgba(0, 0, 0, 0)`, so the page falls back to the viewport's white while every panel that still uses `bg-bg` renders correctly in the dark palette. That reads as "the theme toggle only half works" and is very hard to spot from a screenshot of one region.

`<body>` also owns `color-scheme` (`light` / `:root.dark { dark }`) so form controls, scrollbars, and the default canvas follow the theme.

### Multiple Instances of a Control Need Delegation

`ThemeToggle` renders twice — top bar on desktop, bottom dock on mobile. Never bind it by `id`: a duplicated id is invalid HTML and `getElementById` silently binds only the first instance, leaving the second visibly dead.

Use a data attribute plus one delegated listener on `document`, guarded so it attaches once:

```astro
<button type="button" data-theme-toggle>
```
```ts
if (!document.documentElement.dataset.themeToggleReady) {
  document.documentElement.dataset.themeToggleReady = 'true'
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('[data-theme-toggle]')
    if (!button) return
    // …
  })
}
```

The same applies to popovers that exist in two places — give each its own id and point `aria-controls` at it, so the targets stay unique.

### Custom Base Styles Must Live in a Layer

Tailwind v4 puts everything in `@layer theme, base, components, utilities`. **Unlayered CSS beats every layer**, regardless of specificity — so a bare `h2 { font-family: … }` written at the top level of `global.css` will silently override `font-mono`, `font-serif`, or any other font utility applied to that element, and no amount of specificity will win against it.

Put base resets in `@layer base` and component overrides in `@layer components`, so utilities stay able to win:

```css
@layer base {
  h1, h2, h3, h4 { font-family: var(--font-serif); }
}

@layer components {
  .prose :is(h1, h2, h3, h4) { font-family: var(--font-serif); }
}
```

Symptom when this is wrong: a Tailwind font utility renders in the wrong typeface with nothing wrong in the class list. Verify with computed style, not by reading the markup:

```astro
<script>console.log(getComputedStyle(document.querySelector('footer h2')).fontFamily)</script>
```

### Inline `style` Attributes

Inline `style` is allowed **only for values computed at build time** — grid geometry, per-item offsets, staggered animation delays. Never for static visual values.

```astro
<!-- ✅ Good — computed geometry, cannot be expressed as a utility -->
<div style={`grid-template-columns: repeat(${cols}, minmax(0, 1fr))`}>

<!-- ✅ Good — staggered animation delay -->
<img style={`--pfp-delay: ${delay}ms`} />

<!-- ❌ Bad — static styling belongs in a utility class -->
<span style="font-weight: 600; color: var(--color-text)">
```

### Layout Width

Content width is controlled by the `layout-container` utility — **not** `max-w-prose`.

`max-w-prose` compiles to a hardcoded `65ch` in Tailwind v4, so it cannot respond to a runtime preference. `layout-container` reads `var(--layout-max)`, which is driven by `data-layout` on `<html>`.

```astro
<div class="mx-auto layout-container px-6 py-16">
```

Long-form reading surfaces (note articles) should additionally cap themselves so text stays readable when the reader picks a wide layout:

```astro
<div class="prose prose-neutral max-w-[70ch] dark:prose-invert">
```

### Use `cn()` utility (clsx + tailwind-merge) for conditional class composition:

```ts
import { cn } from '@/lib/utils'

cn('text-sm text-muted', isActive && 'text-accent font-medium')
```

---

## Content Rules

### Notes (MDX)

- Every note must have all required frontmatter fields: `title`, `description`, `publishedAt`
- `draft: true` must be set for any unfinished post — drafts are excluded from production
- One topic per post — do not combine unrelated subjects
- Code blocks must specify a language: ` ```ts `, ` ```bash `, etc.
- Images in posts go in `src/assets/notes/<slug>/` and use Astro's `<Image />` component

### Projects (JSON)

- Both `description.en` and `description.id` must be filled — no empty strings
- `techStack` items use the official name casing: `"TypeScript"` not `"typescript"`, `"Node.js"` not `"nodejs"`
- `featured: true` is reserved for 3–4 projects maximum on the home page

---

## i18n Rules

- All user-visible text must come from the translation file — no hardcoded strings in `.astro` templates
- Both `en.json` and `id.json` must be kept in sync — if a key exists in one, it must exist in the other
- Translation keys follow dot-notation: `section.subsection.element` (e.g., `home.hero.bio`)
- Do not use translation keys for dynamic content (project titles, note titles) — those are authored per language in the content file itself

### Never Hand-Edit `id.json`

`src/i18n/en.json` is the **single source of truth**. `id.json` is generated.

```bash
pnpm translate            # fills only keys missing from id.json
pnpm translate -- --force # re-translates every key, discarding manual tweaks
```

Rules:

- Add new UI strings to `en.json`, then run `pnpm translate`. Do not open `id.json` to add a key.
- `pnpm translate` **preserves existing values** by default. Hand-tuning a translation in `id.json` is fine — `--force` will wipe it, so reach for `--force` deliberately.
- Pick a provider by env var; the script is provider-agnostic and needs no code change to switch.

  | `PROVIDER` | Needs | Free allowance |
  |---|---|---|
  | `gemini` | `GEMINI_API_KEY` | generous free tier |
  | `openai` | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) | covers Groq / DeepSeek / Mistral / Ollama |
  | `google` | `GOOGLE_API_KEY` | 200k chars/month |
  | `libretranslate` | nothing (self-hosted) | unlimited |

  LLM providers (`gemini`, `openai`) accept the tone instruction in the script. Generic translators (`google`, `libretranslate`) cannot — expect literal phrasing from those.
- Machine translation is a **draft**, not an authority. Read the diff before committing. The Indonesian tone target is *santai tapi profesional* — natural, not stiff, not slang.
- Commit the regenerated `id.json`. It is a real source file, not a build artifact.
- Content authored in a single language (note titles and bodies, project `techStack`) is never translated by this script — only the UI dictionaries.

### Keys Are Flat, Not Nested

`en.json` and `id.json` store **flat** keys — the whole dotted string is a single JSON property:

```json
{ "settings.language": "Language" }
```

This is NOT a nested object. `useTranslation` therefore resolves a key in two steps: exact flat lookup first, then dot-path traversal as a fallback. Getting this wrong silently falls back to rendering the raw key to the user, so **after adding any key, verify the rendered HTML does not contain the key string**.

```ts
// src/i18n/utils.ts
const flat = dictionary[key]
if (typeof flat === 'string') return flat
return getNested(dictionary, key.split('.')) ?? key
```

### Runtime Language Swap

Pages are statically generated, so `getLang()` returns `'en'` during build — there is no `window` at build time. The server always renders English; Indonesian is applied in the browser.

`BaseLayout.astro` carries **two** inline scripts, and both matter:

1. **In `<head>`** — reads `theme`, `lang`, `layout`, `animation` from `localStorage` and sets the corresponding `<html>` attributes before the body is parsed. This is what makes `[data-lang]` content (`.lang-en` / `.lang-id` spans) correct from the first paint.
2. **At the end of `<body>`** — a **classic** inline `<script>` (`is:inline` + `define:vars`) that swaps `textContent` of every `[data-i18n]` element.

Why classic and not a normal Astro `<script>`: a bundled script becomes `type="module"`, which is deferred — it runs after parsing, so the page paints English first and then flips. That was the original flash bug. A classic inline script runs during parsing, before the first paint.

**Do not add an early return for `lang === 'en'`.** Skipping the swap is tempting as an optimisation, but after a runtime switch away from English the original text has already been overwritten — skipping means switching *back* to English silently does nothing. Always look up the dictionary for the current language.

Anything a `[data-i18n]` element wraps **must be text only** — `textContent` replaces children, so an icon or nested element inside will be deleted. Wrap the label in its own `<span data-i18n="...">`.

Content authored in one language only — note titles and bodies — is never swapped. `lang` in the note frontmatter decides, per ADR-003.

### Verifying there is no language flash

Do not eyeball this — a flash is a timing bug and eyeballing catches it only when you get lucky. Measure it with `scripts/measure-fcp.mjs`, which drives headless Chrome over CDP, seeds `localStorage.lang=id` before first parse, and compares when the swap ran against First Contentful Paint:

```bash
npm run build
npx serve dist &            # or any static server
node scripts/measure-fcp.mjs http://localhost:PORT/index.html
```

`swap at` must be lower than `FCP`. It currently lands around 40–90 ms against an FCP of 200–260 ms. The same run also exercises the `i18n:change` path in both directions, which is how the broken English-return bug was caught.

Note: `file://` will not work for this — absolute `/_astro/*.css` paths fail to resolve and all Tailwind styles are dropped, which changes the timing you are trying to measure.

### Keys Are Flat, Not Nested

`en.json` and `id.json` store **flat** keys — the whole dotted string is a single JSON property:

```json
{ "settings.language": "Language" }
```

This is NOT a nested object. `useTranslation` therefore resolves a key in two steps: exact flat lookup first, then dot-path traversal as a fallback. Getting this wrong silently falls back to rendering the raw key to the user, so **after adding any key, verify the rendered HTML does not contain the key string**.

```ts
// src/i18n/utils.ts
const flat = dictionary[key]
if (typeof flat === 'string') return flat
return getNested(dictionary, key.split('.')) ?? key
```

### Runtime Language Swap

Pages are statically generated, so `getLang()` returns `'en'` during build — there is no `window` at build time. Language is therefore applied in two passes:

1. **Server pass** — `t(key)` renders the English string into the HTML, wrapped in `data-i18n="key"`. A reader with JavaScript disabled, or one who picks English, gets correct markup with zero client work.
2. **Client pass** — the script in `BaseLayout.astro` bundles both dictionaries and, when the stored language is not English, replaces `textContent` of every `[data-i18n]` element. It listens for `i18n:change`, dispatched by the settings menu, so switching language never reloads the page.

Anything a `[data-i18n]` element wraps **must be text only**. `textContent` replaces children — putting an icon or any nested element inside will delete it. Wrap the label in its own `<span data-i18n="...">` instead.

Content that exists in both languages in the content files (`SITE.bio`, `SITE.role`, `project.data.description`) renders **both** variants and toggles them with CSS on `<html data-lang>`:

```astro
<span class="lang-en">{SITE.bio.en}</span>
<span class="lang-id">{SITE.bio.id}</span>
```

Content authored in one language only — note titles and bodies — is never swapped. A post written in Indonesian stays Indonesian; `lang` in the note frontmatter decides, per ADR-003.

`data-lang` is also set by the pre-paint inline script so the correct variant is chosen before first paint.

---

## User Preferences

Preferences live in `localStorage` and are applied to `<html>` **before first paint** by the inline script in `BaseLayout.astro`, so there is no flash of the wrong theme or layout.

| Key | Values | `<html>` attribute |
|---|---|---|
| `theme` | `light` \| `dark` | `.dark` class |
| `lang` | `en` \| `id` | — |
| `animation` | `system` \| `on` \| `off` | `data-animation` (omitted when `system`) |
| `layout` | `default` \| `wide` \| `wider` | `data-layout` |

### Rules

- Any new preference must be applied in **both** places: the pre-paint inline script in `BaseLayout.astro` and the `sync()` function in `SettingsMenu.astro`. The inline script prevents FOUC; `sync()` keeps the UI in step afterwards.
- `system` means "defer to `prefers-reduced-motion`" — never delete the `@media` fallback in `global.css` when adding animation settings.
- Preference widgets that are a single-choice group use `role="radiogroup"` / `role="radio"` with `aria-checked` and roving `tabindex`, not `aria-pressed`. Keyboard support: arrow keys move and select, `Home` / `End` jump to first and last.
- A component rendered more than once on a page must guard its script against duplicate global listeners:

```ts
if (!document.documentElement.dataset.settingsReady) {
  document.documentElement.dataset.settingsReady = 'true'
  // attach listeners here
}
```

- Visible group labels may be dropped in favour of `aria-label` when the design calls for a label-less menu. The accessible name must survive.

---

## Icons

Icons come from **Lucide**, via `astro-icon` + `@iconify-json/lucide`. Always go through `src/components/ui/Icon.astro` — never import from `astro-icon/components` directly in a page.

```astro
<Icon name="github" class="h-4 w-4 text-text-muted" />
```

Rules:

- `IconName` is a closed union of **semantic** names (`github`, `layout-wide`), not icon-set names. `Icon.astro` owns the mapping to `lucide:*`. This keeps icon-set churn out of the components and lets one Lucide icon serve several meanings later.
- Adding an icon means: add the name to the `IconName` union, add its `lucide:` entry to the `ICONS` record. Do not widen `IconName` to `string` — the union is the only thing catching typos in icon names.
- `astro-icon()` must stay registered in `astro.config.mjs`. Without it the build fails on `virtual:astro-icon`, not at runtime.
- Astro inlines the SVG at build time; the client ships no icon JS. Do not switch to `astro-icon`'s client-side mode.
- Icon-only buttons need `aria-label`. Decorative icons take `aria-hidden="true"`.
- Keep the collection minimal. Adding a second icon set (e.g. Simple Icons for brands) is only justified when Lucide lacks a glyph; Lucide does carry `github` and `linkedin`, so it does not.

---

## Motion

Restraint still governs (see `design.md`). The allowed list gains exactly one expressive effect: **the profile picture mosaic dissolve**.

Everything else must remain a colour or opacity transition of `150–200ms`.

### Mosaic Dissolve — the one accepted implementation

`src/components/sections/Pfp.astro` slices the base image into a grid of tiles that fade out on hover with randomised per-tile delays, revealing a second image underneath.

Preserve this structure if you touch it:

- The revealing image is a **single** plain `<img>` as the bottom layer. Only the top image is sliced.
- Each tile is `position: relative; overflow: hidden` and contains **one** `<img>` sized to `cols * 100%` in both dimensions, offset by `-{col * 100}%` / `-{row * 100}%`.

  The offset unit is **one tile width**, not one grid cell of the oversized image — do not divide by `cols`. `left: -16.67%` shifts the image by a sixth of a tile and stacks every tile on nearly the same strip; `-500%` is the correct shift for `col = 5`.

  The oversized image keeps `object-fit: cover` semantics accurate per tile — do not "simplify" it to `background-image`, which cannot express `cover` and distorts non-square sources.
- **`.pfp-tile-img` must set `max-width: none`.** Tailwind v4 preflight ships `img { max-width: 100% }`, and `max-width` constrains the used width regardless of an inline `width`. Without `max-width: none` every oversized image collapses to its tile's width and the slice silently degrades into vertical stripes. Inline styles cannot fix this — it is a different property, not a specificity fight.
- Do not put `will-change: opacity` on the tiles. Promoting all 36 tiles to their own compositor layer produces hairline seams at tile boundaries from subpixel rounding, and costs GPU memory for no benefit at this size. A plain `transition: opacity` does not need it.
- Delays come from a **deterministic** pseudo-random function in the frontmatter. No `Math.random()` — that would differ between builds and make snapshots unstable.
- The grid container **must** declare `display: grid`. `grid-template-*` without it is silently ignored and every tile collapses to a 0×0 inline box, leaving only the base image visible.

### Verifying the mosaic

Do not eyeball this from a screenshot or reason it through — both have already produced false conclusions here. Build, serve `dist/` over HTTP (`file://` breaks the `/_astro/*.css` absolute paths and silently drops all Tailwind styles), inject a script that dumps `getBoundingClientRect()` for the container, grid and a few tiles, and check the numbers:

```
pfp  = 128x128          (or 112x112 at the `sm` breakpoint)
grid = 126x126          (container minus its 1px border)
tile = 21x21            (grid / 6)
img  = 126x126          (tile * 6 — this is the assertion that catches preflight)
```

Then screenshot both states — resting, and hover forced with `.pfp .pfp-tile-img { opacity: 0 !important }` — to confirm each image is centred and seam-free.

Accessibility: the container carries `role="img"` and `aria-label`; all inner `<img>` elements take `alt="" aria-hidden="true"` so screen readers announce one name, not `cols²`.

The effect is suppressed automatically when the reader sets Animation to `Off` or the OS reports `prefers-reduced-motion` — no extra code path needed.

---

## Accessibility Rules

- Every `<img>` must have a meaningful `alt` attribute — empty `alt=""` only for decorative images
- Interactive elements (`<button>`, `<a>`) must have visible focus styles — do not `outline: none` without a replacement
- Icon-only buttons must have `aria-label`
- Use semantic HTML elements: `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`
- Color must not be the only way to convey information
- All pages must have a unique, descriptive `<title>` and `<meta name="description">`

---

## Performance Rules

- Do not import heavy libraries client-side — check bundle impact before adding a dependency
- Images must use Astro's `<Image />` component — never a plain `<img>` for local assets
- Fonts must be self-hosted via `fontsource` — no runtime Google Fonts requests
- No `client:load` directive unless the component requires immediate interactivity; prefer `client:idle` or `client:visible`
- Avoid global client-side JavaScript — use Astro islands surgically

---

## Git Conventions

### Branch Naming

```
feat/add-project-card
fix/dark-mode-flash
content/add-note-typescript-tips
chore/update-dependencies
```

### Commit Messages

Follow Conventional Commits:

```
feat: add project card component
fix: resolve dark mode FOUC on initial load
content: add note on Astro content collections
chore: bump astro to 5.2.0
style: apply consistent spacing to note list
```

- Present tense imperative: "add" not "added" / "adds"
- No period at end of subject line
- Subject line ≤ 72 characters

### Workflow

- `main` branch is always deployable
- Feature work done on short-lived branches
- Merge via PR (even solo — keeps history clean)
- No force-push to `main`

---

## Linting & Formatting

| Tool | Config file | Purpose |
|---|---|---|
| ESLint | `.eslintrc.mjs` | TypeScript and Astro linting |
| Prettier | `.prettierrc` | Code formatting |
| `astro check` | built-in | Type checking for `.astro` files |

### Prettier Config

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

- Run `pnpm lint` before committing
- Run `pnpm format` to auto-fix formatting
- `astro check` must pass with zero errors before merging

---

## Environment & Secrets

- No secrets in this project for v1 — all content is public and static
- If secrets are added later (e.g., contact form API key), they go in `.env.local` — never committed to git
- `.env.local` must be added to `.gitignore`
- Environment variables accessed only via `import.meta.env` in Astro, never `process.env`

---

## What AI Agents Must Not Do

When an AI agent works on this codebase:

- Do not add new dependencies without it being explicitly requested
- Do not change the project structure defined in `architecture.md`
- Do not hardcode strings — use translation keys
- Do not create files with names that deviate from the naming conventions above
- Do not add `// @ts-ignore` or `any` types to work around TypeScript errors — fix the root cause
- Do not add animations beyond what is specified in `design.md` and the Mosaic Dissolve section above
- Do not nest elements inside a `data-i18n` element — it is replaced wholesale via `textContent`
- Do not translate note titles or bodies; only UI strings and content that exists in both languages
- Do not import `astro-icon/components` outside `Icon.astro`, and do not add a second icon collection
- Do not replace `layout-container` with `max-w-prose`
- Do not apply a user preference in only one of the two places described under User Preferences
- Do not reintroduce `window.location.reload()` to switch language — dispatch `i18n:change` instead
- Do not widen `IconName` to `string`, and do not use `Math.random()` for build-time animation staggering
- Always run `astro check` mentally before considering a task complete — components must be type-safe
- After any change to translation files, grep the build output for raw keys (`grep -o 'settings\.[a-z]*' dist/index.html`) — a key rendering literally means the lookup failed
- After any change to a scoped `<style>` block, confirm the rules survived into `dist/`. Astro inlines small stylesheets into the HTML, so a missing `dist/_astro/*.css` rule does not mean the rule is absent — check the inlined `<style>` too
