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
| `npm run format`                        | Prettier over `src/`                                                      |
| `npm run check:notes`                   | Validate Indonesian notes for untranslated fragments                      |
| `npm run measure:fcp`                   | Check the language swap happens before first paint                        |
| `npm run measure:overflow`              | Measure horizontal overflow at given viewport widths                      |
| `npm run probe`                         | Set viewport and theme, run JS, report computed styles, take a screenshot |
| `npm run translate` / `translate-notes` | Sync `id.json` and note translations from English                         |
| `npm run agent:endpoints`               | Regenerate the markdown twins and catalogues from `dist/`                 |

`lint` and `check` are declared but have no config yet — see the roadmap below.

## Structure

```
src/
├── assets/          # profile photos, gallery, note screenshots
├── components/
│   ├── layout/      # Navbar, Footer, SettingsMenu, ThemeToggle
│   ├── pages/       # one component per page, shared by both locales
│   ├── sections/    # ContactForm, Gallery, Pfp
│   └── ui/          # Icon, NoteRow, ProjectCard, SectionLabel, TableOfContents
├── content/
│   ├── notes/       # MDX notes, `.id.mdx` for the Indonesian twin
│   └── projects/    # JSON project entries
├── i18n/            # en.json, id.json, locale helpers
├── layouts/         # Base, Page, Note, Docs
├── lib/             # site constants, note queries, small utilities
├── pages/           # routes; /id/ mirrors every route
└── styles/          # global.css, theme tokens, motion preferences
scripts/             # dev and verification tooling wired into package.json
worker/              # Cloudflare Worker for the contact form (not deployed yet)
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

## Notes on the build

- `SITE_ORIGIN` env var sets the absolute URLs in the generated files. It
  defaults to the placeholder domain; set it to the real one before launch.
- The contact form renders disabled until `PUBLIC_CONTACT_ENDPOINT` and
  `PUBLIC_TURNSTILE_SITE_KEY` are set. See `worker/contact.ts` and `wrangler.toml`.
- `SITE.url`, `SITE.linkedin` and `SITE.email` in `src/lib/constants.ts` are
  still placeholders.

## Roadmap

- ESLint flat config + `@astrojs/check` so `lint` and `check` actually run
- Custom 404, `robots.txt`, Open Graph / Twitter card meta
- Deploy the contact worker (KV, Turnstile and Resend secrets)
- Point `SITE.url` and `astro.config.mjs` at the real domain

## License

MIT — see [LICENSE](./LICENSE).
