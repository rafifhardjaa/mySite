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
    role: z.enum(['Creator', 'Maintainer', 'Contributor']),
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

export const collections = { notes, projects }
