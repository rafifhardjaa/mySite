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