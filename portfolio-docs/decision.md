# Architecture Decision Records — Personal Portfolio Website

ADRs document key technical decisions, their context, and rationale. Each record is immutable — if a decision is reversed, a new ADR is created.

Format: `[ADR-NNN] Title` — Status: `Accepted | Superseded | Deprecated`

---

## ADR-001: Use Astro as the Framework

**Status:** Accepted  
**Date:** 2026-10-11

### Context

The portfolio is primarily a static content site: home page, project listings, blog posts, and a few auxiliary pages. The site needs to be fast, easy to maintain, and good for SEO. Candidates considered: Astro, SvelteKit, Next.js.

### Decision

Use **Astro 5.x**.

### Rationale

- Astro ships zero JavaScript by default — ideal for a content-heavy site
- Content Collections provide type-safe, schema-validated MDX authoring out of the box
- Astro's island architecture allows adding interactivity only where needed (theme toggle, lang toggle)
- Simpler mental model than Next.js for a personal site with no API routes in v1
- SvelteKit would require more manual setup for MDX, RSS, and sitemap support

### Consequences

- Team (solo dev) must be comfortable with Astro's `.astro` component syntax
- If dynamic features grow significantly in the future (e.g., guestbook with real-time updates), evaluate migrating interactive sections to a Svelte or React island

---

## ADR-002: Use Tailwind CSS v4 for Styling

**Status:** Accepted  
**Date:** 2026-10-11

### Context

Styling approach needed to support: dark mode via class, design tokens (colors, spacing, type), and be maintainable without a separate CSS-in-JS runtime. Options: Tailwind CSS, vanilla CSS with custom properties, UnoCSS.

### Decision

Use **Tailwind CSS v4** with CSS variables for color tokens.

### Rationale

- Tailwind v4's native CSS variable integration (`@theme`) aligns with our design token approach
- Utility-first accelerates development without naming fatigue
- `darkMode: 'class'` integrates cleanly with our inline script FOUC prevention strategy
- `@tailwindcss/typography` handles MDX article styling out of the box
- UnoCSS was considered but Tailwind has better ecosystem support for Astro

### Consequences

- All component styling lives in markup — reviewers must be comfortable reading Tailwind class strings
- No CSS Modules or styled-components patterns allowed (see `rules.md`)

---

## ADR-003: File-agnostic i18n via JSON Translation Files

**Status:** Accepted  
**Date:** 2026-10-11

### Context

The site targets both Indonesian and English-speaking audiences. Two i18n approaches were evaluated:

1. **File-based routing** — separate pages per language: `/en/notes`, `/id/notes`
2. **Single routing + JSON swap** — one set of pages, language swaps content via `localStorage`

### Decision

Use **single routing with JSON translation files** (Option 2).

### Rationale

- Portfolio has limited UI strings — a flat JSON key/value file is sufficient
- Avoids maintaining two parallel sets of `.astro` page files
- URL remains clean and consistent regardless of language
- Simpler implementation for a solo project
- SEO tradeoff is acceptable: `<html lang="">` attribute is updated dynamically; for a portfolio this is sufficient

### Consequences

- Search engines index one URL per page — no hreflang alternate links in v1
- Blog posts (`notes`) are written in a specific language (`lang` frontmatter field) — no auto-translation of post content
- If SEO for multilingual content becomes a priority, revisit with `@astrojs/i18n` and file-based routing (ADR-003-B)

---

## ADR-004: No CMS — File-based Content Only

**Status:** Accepted  
**Date:** 2026-10-11

### Context

Options for content management: headless CMS (Contentful, Sanity), git-based CMS (Decap, Tina), or plain files in the repo.

### Decision

**Plain files in the repository** — MDX for notes, JSON for projects.

### Rationale

- No external service dependency — zero monthly cost, zero vendor lock-in
- Content is versioned alongside code in git
- Astro Content Collections provide schema validation at build time (Zod)
- Writing MDX locally with a code editor is a better experience for a developer than a web CMS
- A CMS adds operational overhead that isn't justified for a solo content author

### Consequences

- No visual editor — content must be authored in MDX/JSON directly
- No draft preview without running the dev server locally
- If content volume grows significantly or a non-developer author is needed in the future, evaluate Tina CMS (git-backed, no database required)

---

## ADR-005: Self-host Fonts via fontsource

**Status:** Accepted  
**Date:** 2026-10-11

### Context

Font loading strategy impacts performance and privacy. Options: Google Fonts CDN, self-hosted via `fontsource`, system font stack.

### Decision

Use **`@fontsource-variable/geist`** and **`@fontsource/geist-mono`** (self-hosted npm packages).

### Rationale

- No external DNS lookup or network request to Google at page load
- GDPR/privacy friendly — no user data sent to third parties
- `fontsource` packages integrate cleanly with Astro's build pipeline
- Geist is clean, highly legible, and modern — appropriate for a developer portfolio
- Variable font (`geist-variable`) reduces HTTP requests vs loading multiple weight files

### Consequences

- Slightly larger initial bundle compared to system fonts
- Font files served from same origin — no cross-origin latency

---

## ADR-006: Vercel as Deployment Target

**Status:** Accepted  
**Date:** 2026-10-11

### Context

Hosting options for a static Astro site: Vercel, Netlify, Cloudflare Pages, GitHub Pages.

### Decision

Deploy to **Vercel**.

### Rationale

- Zero-config Astro support with `@astrojs/vercel` adapter
- Generous free tier sufficient for a personal portfolio
- Automatic preview deployments per pull request
- Edge network CDN globally distributed
- Easy custom domain setup when domain is ready

### Consequences

- Mild vendor dependency on Vercel's build pipeline
- If switching to a different host, remove `@astrojs/vercel` adapter and switch to `@astrojs/netlify` or static output — low migration cost for a fully static site

---

## ADR-007: No Analytics in v1

**Status:** Accepted  
**Date:** 2026-10-11

### Context

Tracking page views and visitor behavior is common for portfolio sites. Options: Google Analytics, Plausible, Fathom, no analytics.

### Decision

**No analytics in v1.**

### Rationale

- Adds an external script that impacts performance (Lighthouse score)
- Privacy-first approach — no visitor tracking without consent mechanism
- v1 goal is to launch a solid site, not optimize for traffic metrics
- Vercel's built-in analytics can be enabled later at zero code cost if needed

### Consequences

- No visibility into page views, traffic sources, or visitor geography in v1
- Can be added later by enabling Vercel Analytics (one flag) or adding Plausible via a single `<script>` tag
