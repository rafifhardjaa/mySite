# Data & Content Schema — Personal Portfolio Website

## Overview

This site has no database. All content is file-based and managed through Astro Content Collections. Schemas are enforced via Zod at build time — invalid frontmatter will throw a build error.

---

## Content Collections

Defined in `src/content/config.ts`.

```ts
import { defineCollection, z } from 'astro:content'

export const collections = {
  notes: notesCollection,
  projects: projectsCollection,
}
```

---

## Collection: `notes`

**Location:** `src/content/notes/*.mdx`

**Purpose:** Blog posts / technical writing.

### Schema

```ts
const notesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'id']).default('en'),
  }),
})
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Article title, shown in list and `<title>` tag |
| `description` | string | ✅ | Short excerpt for list and meta description |
| `publishedAt` | date | ✅ | Publication date (`YYYY-MM-DD`) |
| `updatedAt` | date | ❌ | Last updated date, shown if different from publishedAt |
| `tags` | string[] | ❌ | Categorization tags, not rendered as pages in v1 |
| `draft` | boolean | ❌ | If `true`, excluded from production build |
| `lang` | `'en' \| 'id'` | ❌ | Language the post is written in (defaults to `'en'`) |

### Example Frontmatter

```mdx
---
title: "How I Structure My Fullstack Projects"
description: "A practical look at the folder structure and conventions I use across my projects."
publishedAt: 2026-10-01
tags: ["architecture", "fullstack"]
draft: false
lang: en
---

Content starts here...
```

### File Naming Convention

```
src/content/notes/
├── how-i-structure-fullstack-projects.mdx
├── belajar-typescript-dari-nol.mdx
└── tanstack-query-beyond-server-state.mdx
```

- Use `kebab-case`
- Filename becomes the URL slug: `/notes/how-i-structure-fullstack-projects`
- Indonesian posts can be in the same folder — distinguished by `lang` field

---

## Collection: `projects`

**Location:** `src/content/projects/*.json`

**Purpose:** Showcase of personal and professional projects.

### Schema

```ts
const projectsCollection = defineCollection({
  type: 'data',
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
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Project name |
| `description.en` | string | ✅ | Short description in English |
| `description.id` | string | ✅ | Short description in Indonesian |
| `role` | enum | ✅ | Your role: `Creator`, `Maintainer`, `Contributor` |
| `status` | enum | ❌ | `active`, `archived`, or `wip` |
| `featured` | boolean | ❌ | If `true`, shown on Home page |
| `techStack` | string[] | ✅ | Technologies used (shown as badges) |
| `links.live` | URL | ❌ | Live site URL |
| `links.repo` | URL | ❌ | GitHub/GitLab repo URL |
| `order` | number | ❌ | Manual sort order for display |

### Example File

```json
// src/content/projects/my-project.json
{
  "title": "MyProject",
  "description": {
    "en": "An open-source tool to automate deployment pipelines.",
    "id": "Alat open-source untuk mengotomasi pipeline deployment."
  },
  "role": "Creator",
  "status": "active",
  "featured": true,
  "techStack": ["TypeScript", "Node.js", "Docker"],
  "links": {
    "live": "https://myproject.dev",
    "repo": "https://github.com/yourusername/myproject"
  },
  "order": 1
}
```

---

## Static / Non-Collection Data

### Site Metadata

Defined in `src/lib/constants.ts`:

```ts
export const SITE = {
  name: 'Your Name',
  role: {
    en: 'Fullstack Software Engineer',
    id: 'Software Engineer Fullstack',
  },
  bio: {
    en: 'I build things for the web.',
    id: 'Saya membangun hal-hal untuk web.',
  },
  url: 'https://yourdomain.com',      // update when domain is ready
  github: 'https://github.com/yourusername',
  linkedin: 'https://linkedin.com/in/yourusername',
  email: 'you@email.com',
} as const
```

### Navigation Links

```ts
export const NAV_LINKS = [
  { href: '/',         label: { en: 'Home',    id: 'Beranda' } },
  { href: '/notes',    label: { en: 'Notes',   id: 'Catatan' } },
  { href: '/now',      label: { en: 'Now',     id: 'Sekarang' } },
  { href: '/archive',  label: { en: 'Archive', id: 'Arsip' } },
] as const
```

---

## i18n Translation Files

**Location:** `src/i18n/en.json` and `src/i18n/id.json`

### Structure

```json
// en.json
{
  "nav.home": "Home",
  "nav.notes": "Notes",
  "nav.now": "Now",
  "nav.archive": "Archive",

  "home.hero.greeting": "Hi, I'm",
  "home.hero.bio": "I build things for the web. Fullstack engineer focused on shipping.",
  "home.projects.heading": "Projects",
  "home.notes.heading": "Latest Notes",
  "home.notes.cta": "Browse all notes",
  "home.contact.heading": "Got something interesting?",
  "home.contact.body": "I'm always up for an interesting project or a good conversation.",
  "home.contact.cta": "Send a message",

  "notes.heading": "Notes",
  "notes.empty": "No notes yet.",
  "note.readingTime": "{n} min read",
  "note.backToNotes": "Back to Notes",

  "projects.heading": "Projects",
  "projects.live": "Live",
  "projects.repo": "Repository",

  "now.heading": "Now",
  "now.lastUpdated": "Last updated",

  "archive.heading": "Archive",

  "footer.source": "Source",
  "footer.rights": "All rights reserved."
}
```

```json
// id.json — mirrors same keys, Indonesian values
{
  "nav.home": "Beranda",
  "nav.notes": "Catatan",
  "nav.now": "Sekarang",
  "nav.archive": "Arsip",

  "home.hero.greeting": "Halo, saya",
  "home.hero.bio": "Saya membangun hal-hal untuk web. Fullstack engineer yang fokus pada pengiriman produk.",
  "home.projects.heading": "Proyek",
  "home.notes.heading": "Catatan Terbaru",
  "home.notes.cta": "Lihat semua catatan",
  "home.contact.heading": "Ada sesuatu yang menarik?",
  "home.contact.body": "Saya selalu terbuka untuk proyek menarik atau obrolan yang baik.",
  "home.contact.cta": "Kirim pesan",

  "notes.heading": "Catatan",
  "notes.empty": "Belum ada catatan.",
  "note.readingTime": "{n} menit baca",
  "note.backToNotes": "Kembali ke Catatan",

  "projects.heading": "Proyek",
  "projects.live": "Lihat",
  "projects.repo": "Repositori",

  "now.heading": "Sekarang",
  "now.lastUpdated": "Terakhir diperbarui",

  "archive.heading": "Arsip",

  "footer.source": "Sumber",
  "footer.rights": "Hak cipta dilindungi."
}
```

---

## localStorage Keys

| Key | Values | Purpose |
|---|---|---|
| `theme` | `'light' \| 'dark'` | Persisted theme preference |
| `lang` | `'en' \| 'id'` | Persisted language preference |
