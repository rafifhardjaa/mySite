# Technical Architecture — Personal Portfolio Website

## Stack Overview

| Layer | Technology | Reason |
|---|---|---|
| Framework | Astro 5.x | Static-first, zero JS by default, excellent for content sites |
| Styling | Tailwind CSS v4 | Utility-first, consistent design tokens, dark mode support |
| Content | MDX via Astro Content Collections | Type-safe, structured blog/notes authoring |
| Language | TypeScript | Type safety across components and content schemas |
| Package Manager | pnpm | Fast, disk-efficient |
| Deployment | Vercel (or Netlify) | Zero-config Astro support, free tier sufficient |

---

## Project Structure

```
portfolio/
├── public/
│   ├── favicon.svg
│   ├── resume.pdf
│   └── images/           # static assets (og images, etc.)
│
├── src/
│   ├── assets/           # images processed by Astro
│   │
│   ├── components/
│   │   ├── ui/           # primitive components (Button, Badge, etc.)
│   │   ├── layout/       # Navbar, Footer, ThemeToggle, LangToggle
│   │   └── sections/     # HomeHero, ProjectCard, NoteCard, etc.
│   │
│   ├── content/
│   │   ├── config.ts     # Content Collections schema definitions
│   │   ├── notes/        # MDX files for blog posts
│   │   └── projects/     # JSON/MDX files for project data
│   │
│   ├── i18n/
│   │   ├── en.json       # English translations
│   │   ├── id.json       # Indonesian translations
│   │   └── utils.ts      # useTranslation helper
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro      # HTML shell, meta, fonts
│   │   ├── PageLayout.astro      # BaseLayout + Navbar + Footer
│   │   └── NoteLayout.astro      # PageLayout + article wrapper
│   │
│   ├── pages/
│   │   ├── index.astro           # Home
│   │   ├── projects/
│   │   │   └── index.astro
│   │   ├── notes/
│   │   │   ├── index.astro
│   │   │   ├── [slug].astro      # Dynamic note detail
│   │   │   └── rss.xml.ts        # RSS feed endpoint
│   │   ├── now.astro
│   │   ├── archive.astro
│   │   └── resume.astro
│   │
│   ├── styles/
│   │   └── global.css            # Tailwind imports, CSS variables
│   │
│   └── lib/
│       ├── utils.ts              # cn(), formatDate(), readingTime()
│       └── constants.ts          # site metadata, nav links
│
├── astro.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Rendering Strategy

All pages use **Static Site Generation (SSG)** — pre-rendered at build time. No server-side rendering needed for v1.

| Page | Strategy | Notes |
|---|---|---|
| `/` | Static | |
| `/projects` | Static | |
| `/notes` | Static | |
| `/notes/[slug]` | Static (getStaticPaths) | One page per MDX file |
| `/now` | Static | Manually updated |
| `/archive` | Static | |
| `/resume` | Static | |
| `/notes/rss.xml` | Static endpoint | |

---

## Content Collections

Defined in `src/content/config.ts` using Astro's `defineCollection` and `z` (Zod) schemas.

### `notes` collection
Source: `src/content/notes/*.mdx`

### `projects` collection
Source: `src/content/projects/*.json` or `*.mdx`

See `database.md` for full schema definitions.

---

## i18n Architecture

**Approach:** Single routing + JSON-based translation swap (no URL prefix)

```
src/i18n/
├── en.json    # { "nav.home": "Home", "hero.title": "...", ... }
├── id.json    # { "nav.home": "Beranda", "hero.title": "...", ... }
└── utils.ts
```

```ts
// src/i18n/utils.ts
export function useTranslation(lang: 'en' | 'id') {
  return function t(key: string): string {
    const translations = lang === 'en' ? en : id
    return translations[key] ?? key
  }
}
```

Language state is stored in `localStorage` under the key `lang`. A small inline script in `BaseLayout.astro` reads it before first paint to prevent flash.

---

## Theme (Dark/Light Mode)

- CSS variables for colors defined in `global.css` under `:root` (light) and `.dark` (dark)
- Tailwind configured with `darkMode: 'class'`
- `ThemeToggle` component reads/writes `localStorage` key `theme`
- Inline script in `<head>` applies `.dark` class before paint to prevent FOUC

```html
<!-- BaseLayout.astro <head> -->
<script is:inline>
  const theme = localStorage.getItem('theme') 
    ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
</script>
```

---

## Performance Strategy

- Zero JS by default (Astro islands only where needed)
- Fonts: self-hosted via `fontsource` or `@astrojs/google-fonts`
- Images: Astro `<Image />` component with automatic optimization (WebP, lazy loading)
- No third-party scripts in v1 (no analytics, no embeds)
- CSS: Tailwind purges unused styles at build

---

## Deployment

Target: **Vercel**

```
Build command:   pnpm build
Output dir:      dist
Node version:    20.x
```

Environment variables needed: none for v1 (all static).

---

## Dependencies (planned)

```json
{
  "astro": "^5.x",
  "@astrojs/mdx": "^4.x",
  "@astrojs/sitemap": "^3.x",
  "@astrojs/tailwind": "^5.x",
  "tailwindcss": "^4.x",
  "typescript": "^5.x",
  "zod": "^3.x",
  "reading-time": "^1.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```
