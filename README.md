# mySite

Personal portfolio. Static site, two languages, no framework runtime.

Built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com)
and TypeScript. Content lives in collections, translations in flat JSON, and
every page ships a markdown twin and a machine-readable catalogue for agents.

## Run it

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/, plus markdown twins and agent files
npm run preview  # serve the built site
```

## Scripts

| Script                                  | What it does                                                              |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                           | Dev server                                                                |
| `npm run build`                         | `astro build`, then `agent:endpoints`                                     |
| `npm run preview`                       | Serve `dist/`                                                             |
| `npm run format`                        | Prettier over `src/`, `worker/`, `scripts/` and the root configs          |
| `npm run check:notes`                   | Validate Indonesian notes for untranslated fragments                      |
| `npm run measure:overflow`              | Measure horizontal overflow at given viewport widths                      |
| `npm run probe`                         | Set viewport and theme, run JS, report computed styles, take a screenshot |
| `npm run translate` / `translate-notes` | Sync `id.json` and note translations from English                         |
| `npm run agent:endpoints`               | Regenerate the markdown twins and catalogues from `dist/`                 |
| `npm run lint` / `npm run check`        | ESLint (flat config) / `astro check` typecheck                            |
| `npm run assets:og`                     | Regenerate `public/og-image.png` + `apple-touch-icon.png` from the theme  |

## Structure

```
src/
├── assets/          # profile photos, gallery, note screenshots
├── components/
│   ├── layout/      # Navbar, Footer, SettingsMenu, ThemeToggle
│   ├── pages/       # one component per page, shared by both locales
│   ├── sections/    # ContactForm, Gallery, Pfp
│   └── ui/          # Icon, InfoRow, ExternalLink, NoteRow, NowItemList,
│                    # ProjectCard, SectionLabel, TableOfContents
├── content/
│   ├── notes/       # MDX notes, `.id.mdx` for the Indonesian twin
│   ├── now-items/   # JSON entries for the /now Reading/Learning/Listening rows
│   └── projects/    # JSON project entries
├── i18n/            # en.json, id.json, locale helpers
├── layouts/         # Base, Page, Note, Docs
├── lib/             # site constants, notes + now-items queries, small utilities
├── pages/           # routes; /id/ mirrors every route
└── styles/          # global.css, theme tokens, motion preferences
scripts/             # dev and verification tooling wired into package.json
scripts/lib/         # shared fetch/retry/env (util) and headless-Chrome (chrome) helpers
worker/              # Cloudflare Worker: contact form + Last.fm routes, deployed
```

## Pages

Home, Notes, Projects, Now, Uses, Contact, Resume and Privacy — each with an
`/id/` counterpart. Notes have an RSS feed at `/notes/rss.xml`, and every route
ships a markdown twin at `<route>/index.md` with frontmatter carrying title,
description, url and lang. Send `Accept: text/markdown` to get it; see
`vercel.json`.

Machine-readable catalogues, generated at build time from the built HTML so
they cannot drift from the site:

- `/.well-known/api-catalog.json`
- `/.well-known/agent-skills/index.json`
- `/openapi.json`

## Live music (Last.fm)

The footer teaser and the /now Listening section stay fresh without a
rebuild. Same-origin Worker routes proxy the read-only Last.fm API so the
key never reaches the browser:

- `GET /api/now-playing` — latest scrobble (footer)
- `GET /api/top-tracks` — weekly top 3 (playcounts included)

Both cache for five minutes and answer 502 on any failure, in which case
the pages silently keep their curated fallback content. Setup:

- `LASTFM_API_KEY` in `.dev.vars` for local runs, `npx wrangler secret put
LASTFM_API_KEY` + redeploy for production
- The API routes only exist under `wrangler dev` and in production — under
  `npm run dev` (Astro only) the fetch 404s and the curated fallback shows
- Restart the dev server after changing `content.config.ts`; one `wrangler
dev` instance at a time (stale instances serve stale worker code)

## Notes on the build

- `SITE_ORIGIN` env var sets the absolute URLs in the generated files. It
  defaults to the production domain; override it per environment when needed.
- The contact form renders disabled until `PUBLIC_CONTACT_ENDPOINT` and
  `PUBLIC_TURNSTILE_SITE_KEY` are set. See `worker/contact.ts` and `wrangler.toml`.

## Roadmap

- Custom 404 and `robots.txt`

## License

MIT — see [LICENSE](./LICENSE).
