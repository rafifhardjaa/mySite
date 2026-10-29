import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const notes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'id']).default('en'),
    // URL slug for a note. Frontmatter `slug` is a collection-wide key, so an
    // English note and its Indonesian twin cannot share one — the later entry
    // would be dropped. Translations carry `urlPath` instead, for example both
    // `silk-road-marketplace.mdx` and `silk-road-marketplace.id.mdx` resolve to
    // the URL `silk-road-marketplace` in their own locale.
    urlPath: z.string().optional(),
  }),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.object({
      en: z.string(),
      id: z.string(),
    }),
    // A project can carry more than one role, e.g. ["Creator", "Contributor"].
    role: z.array(z.enum(['Creator', 'Maintainer', 'Contributor'])).min(1),
    status: z.enum(['active', 'archived', 'wip']).default('active'),
    featured: z.boolean().default(false),
    techStack: z.array(z.string()),
    links: z.object({
      live: z.string().url().optional(),
      repo: z.string().url().optional(),
    }),
    order: z.number().int().optional(),
  }),
})

const nowItems = defineCollection({
  // NOTE: the pattern must stay '**/*.json' — a bare '*.json' silently matches
  // nothing and every getCollection('now-items') comes back empty.
  loader: glob({ pattern: '**/*.json', base: './src/content/now-items' }),
  schema: z.object({
    // Which /now section renders this entry. One file per entry, both
    // languages nested — same bilingual strategy as the projects collection.
    kind: z.enum(['reading', 'learning', 'listening']),
    title: z.object({
      en: z.string(),
      id: z.string(),
    }),
    // One line on the /now page. The full write-up lives in /notes;
    // point there with noteSlug instead of duplicating it here.
    note: z.object({
      en: z.string(),
      id: z.string(),
    }),
    // External destination (book page, Substack, album on Last.fm…).
    // Internal note links use noteSlug so the locale prefix stays correct.
    href: z.string().url().optional(),
    // Verified store URL for the track (iTunes Store track page, checked by
    // hand — search misses real tracks, so never guess this). The footer
    // teaser links here instead of /now when present.
    storeHref: z.string().url().optional(),
    // Slug of a note under /notes (urlPath form, e.g. "vibe-coding-answer-or-trap").
    noteSlug: z.string().optional(),
    status: z.enum(['active', 'paused', 'done']).default('active'),
    // Month the entry started, YYYY-MM. Rendered as "since …" on the page.
    since: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    // Bump whenever the entry changes. The page-level "last updated" stamp
    // is derived from the newest updatedAt across all entries.
    updatedAt: z.coerce.date(),
    order: z.number().int().default(999),
  }),
})

export const collections = { notes, projects, nowItems }
