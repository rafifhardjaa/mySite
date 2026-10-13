# Product Requirements Document — Personal Portfolio Website

## Overview

Personal portfolio website for a fullstack software engineer. The goal is a clean, minimal, and content-focused site — inspired by the aesthetic of rimzzlabs.com — that serves as a professional presence for both Indonesian and international audiences.

## Goals

- Present professional identity clearly and quickly
- Showcase projects and technical work
- Publish technical writing (notes/blog)
- Provide easy contact channels for potential employers and clients
- Reach both Indonesian and English-speaking audiences

## Non-Goals

- Not a SaaS product or multi-user platform
- No complex animations or heavy visual effects
- No e-commerce or payment features
- Guestbook is out of scope for v1

---

## Target Users

| User | Need |
|---|---|
| Recruiters / HR | Quickly assess experience, skills, and past work |
| Potential clients | Understand capabilities and how to reach out |
| Fellow developers | Read technical notes, explore open source work |
| General visitors | Learn who you are, what you do |

---

## Pages & Features

### 1. Home `/`

- Hero section: name, role (Fullstack Software Engineer), one-liner bio
- Featured projects (3–4 items)
- Latest notes (3–5 items)
- CTA: link to resume + contact form anchor

### 2. Projects `/projects`

- List of all projects
- Each project card includes: title, short description, tech stack badges, role (Creator / Maintainer / Contributor), links (live site + GitHub repo)
- No filter needed for v1

### 3. Notes `/notes`

- List of all blog posts/articles, sorted by date descending
- Each item shows: title, date, short excerpt
- Supports MDX format
- RSS feed at `/notes/rss.xml`

### 4. Note Detail `/notes/[slug]`

- Full article content rendered from MDX
- Reading time estimate
- Published date
- Back to notes navigation
- No comments for v1

### 5. Now `/now`

- Single page, manually updated
- What you're currently working on, learning, reading, or thinking about
- Last updated timestamp

### 6. Archive `/archive`

- Flat, bare list of all notes with date — no pagination, no excerpts
- Useful for quick browsing

### 7. Resume `/resume`

- Links to downloadable PDF
- Or a rendered page with experience, skills, and education

---

## UI Features

### Dark / Light Mode
- Toggle button in navbar
- Persists via `localStorage`
- Defaults to system preference (`prefers-color-scheme`)

### Bilingual (ID / EN)
- Language toggle in navbar (ID | EN)
- Translation via JSON files (`src/i18n/id.json`, `src/i18n/en.json`)
- URL remains the same — only content swaps
- Persists via `localStorage`
- Default language: EN

### Responsive Design
- Mobile-first
- Breakpoints: mobile (< 640px), tablet (640–1024px), desktop (> 1024px)

---

## Performance Requirements

- Lighthouse score ≥ 90 on all categories
- First Contentful Paint < 1.5s
- No render-blocking resources
- Images optimized via Astro's `<Image />` component

## Accessibility Requirements

- WCAG 2.1 AA compliance
- All images have descriptive `alt` text
- Keyboard navigable
- Sufficient color contrast in both light and dark mode

---

## Out of Scope (v1)

- Guestbook
- Search functionality
- Comment system
- Analytics dashboard
- CMS integration
