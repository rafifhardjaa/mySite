import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import icon from 'astro-icon'

export default defineConfig({
  site: 'https://yourdomain.com',
  integrations: [mdx(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
  // Speculative prefetch + prerender for every same-origin link, on hover.
  // The browser renders the hovered page in the background, so the following
  // navigation is near-instant even on a slow connection. External links,
  // mailto: and same-page anchors are never eligible; the RSS feed is opted
  // out per link because prerendering an XML document buys nothing.
  // No ClientRouter is involved: this only hints the browser, it changes no
  // navigation behaviour and runs no extra page JS until a real visit.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  markdown: {
    shikiConfig: {
      // Warm light code for the default theme, neutral dark code for dark mode.
      // NoteLayout CSS switches token colours with Shiki's --shiki-dark variables.
      themes: { light: 'rose-pine-dawn', dark: 'github-dark' },
      defaultColor: 'light',
    },
  },
  i18n: {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    // English keeps the bare paths (/notes/…), Indonesian is prefixed (/id/notes/…).
    // That means existing links and any inbound URLs stay valid.
    routing: {
      prefixDefaultLocale: false,
      // An /id/ page that has no Indonesian translation yet is served from the
      // English page at the same URL, rather than 404ing.
      fallbackType: 'rewrite',
    },
    fallback: {
      id: 'en',
    },
  },
})
