#!/usr/bin/env node
/**
 * Generates the machine-readable surface of the site:
 *
 *   <route>.md                            a markdown twin of every page
 *   /.well-known/api-catalog.json         what routes exist
 *   /.well-known/agent-skills/index.json  how an agent should use this site
 *   /openapi.json                         the same catalogue, OpenAPI shaped
 *
 * Markdown is derived from the built HTML rather than from the source, so it
 * can never drift from what a visitor actually sees. Run it after `astro build`:
 *
 *   node scripts/generate-agent-endpoints.mjs
 *
 * Serving `.md` in response to `Accept: text/markdown` is the host's job. On
 * Vercel that is a header rewrite in vercel.json, already wired to these paths.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://rafifhardja.xyz'

// ---------------------------------------------------------------- html -> md

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source'])
const SKIP = new Set(['script', 'style', 'svg', 'noscript', 'template'])

function decode(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}

function absolute(href) {
  if (!href) return ''
  if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('#'))
    return href
  return href.startsWith('/') ? href : `/${href}`
}

/**
 * Small converter covering the tags Astro actually emits. A dependency-free
 * converter is deliberate: the output only has to be good for the few dozen
 * pages on a personal site, and adding a parser for that is not worth it.
 */
function toMarkdown(html) {
  let out = ''
  let i = 0

  const tagAt = (from) => {
    const open = html.indexOf('<', from)
    if (open === -1) return null
    const close = html.indexOf('>', open)
    if (close === -1) return null
    const raw = html.slice(open + 1, close).trim()
    const closing = raw.startsWith('/')
    // Closing tags arrive as "/li", which no name pattern would match.
    const bare = closing ? raw.slice(1).trim() : raw
    const name = (bare.match(/^[a-zA-Z][a-zA-Z0-9-]*/) ?? [''])[0].toLowerCase()
    const selfClosing = bare.endsWith('/')
    return { open, close, raw, bare, name, closing, selfClosing }
  }

  while (i < html.length) {
    const open = html.indexOf('<', i)
    if (open === -1) {
      out += decode(html.slice(i))
      break
    }
    out += decode(html.slice(i, open))

    const tag = tagAt(open)
    if (!tag) {
      out += decode(html.slice(open))
      break
    }
    const { name, closing, selfClosing, raw, close } = tag

    if (SKIP.has(name)) {
      // Drop the element and everything inside it.
      if (!closing && !selfClosing) {
        const end = html.toLowerCase().indexOf(`</${name}>`, close)
        i = end === -1 ? html.length : end + name.length + 3
      } else {
        i = close + 1
      }
      continue
    }

    if (closing) {
      const closes = {
        h1: '\n\n',
        h2: '\n\n',
        h3: '\n\n',
        h4: '\n\n',
        h5: '\n\n',
        h6: '\n\n',
        p: '\n\n',
        li: '\n',
        blockquote: '\n\n',
        pre: '\n\n',
        ul: '\n',
        ol: '\n',
        div: '\n',
        section: '\n\n',
        nav: '\n',
        header: '\n',
        footer: '\n\n',
      }
      if (closes[name]) out += closes[name]
      if (name === 'a') out += ''
      i = close + 1
      continue
    }

    const attr = (key) => (raw.match(new RegExp(`${key}="([^"]*)"`)) ?? [])[1]

    if (name === 'img') {
      const alt = decode(attr('alt') ?? '')
      const src = absolute(attr('src'))
      if (alt) out += `![${alt}](${src})`
      i = close + 1
      continue
    }
    if (name === 'br') {
      out += '\n'
      i = close + 1
      continue
    }
    if (name === 'hr') {
      out += '\n\n---\n\n'
      i = close + 1
      continue
    }
    if (name === 'a') {
      // Resolved as a whole element so the href and the label stay together;
      // tracking them across open and close tags loses one or the other.
      const end = html.toLowerCase().indexOf('</a>', close)
      const inner = end === -1 ? '' : html.slice(close + 1, end)
      const label = decode(inner.replace(/<[^>]+>/g, '')).trim()
      const href = absolute(attr('href') ?? '')
      out += label ? `[${label}](${href}) ` : ''
      i = end === -1 ? html.length : end + 4
      continue
    }

    if (/^h[1-6]$/.test(name)) {
      const level = Number(name[1])
      const end = html.toLowerCase().indexOf(`</${name}>`, close)
      const inner = end === -1 ? '' : html.slice(close + 1, end)
      const text = decode(inner.replace(/<[^>]+>/g, '')).trim()
      if (text) out += `\n${'#'.repeat(level)} ${text}\n\n`
      i = end === -1 ? html.length : end + name.length + 3
      continue
    }

    if (name === 'li') {
      out += '- '
      i = close + 1
      continue
    }

    if (name === 'strong' || name === 'b') {
      out += '**'
      i = close + 1
      continue
    }
    if (name === 'em' || name === 'i') {
      out += '_'
      i = close + 1
      continue
    }
    if (name === 'code' && !VOID.has(name)) {
      // Inline code only. Block code is handled by the <pre> branch.
      out += '`'
      i = close + 1
      continue
    }
    if (name === 'pre') {
      const end = html.toLowerCase().indexOf('</pre>', close)
      const inner = end === -1 ? '' : html.slice(close + 1, end)
      const code = decode(inner.replace(/<[^>]+>/g, '')).replace(/^\n+|\n+$/g, '')
      if (code) out += `\n\n\`\`\`\n${code}\n\`\`\`\n\n`
      i = end === -1 ? html.length : end + 6
      continue
    }

    i = close + 1
  }

  // Close any inline emphasis the converter opened.
  return (
    out
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      // Unwrap a label that never got an href, so it is not mistaken for a link.
      .replace(/\[([^\]]*)\](?!\()/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  )
}

// ------------------------------------------------------------------ helpers

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (entry.endsWith('.html')) found.push(full)
  }
  return found
}

function pageMeta(html) {
  const title = decode((html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '')
  const description = decode(
    (html.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? ''
  )
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) ?? [])[1] ?? ''
  const lang = (html.match(/<html lang="([^"]*)"/) ?? [])[1] ?? 'en'
  return { title, description, canonical, lang }
}

/** The visible article, without nav, footer, or any script. */
function mainHtml(html) {
  const start = html.indexOf('<main')
  const end = html.lastIndexOf('</main>')
  if (start === -1 || end === -1) return html
  return html.slice(start, end)
}

/**
 * Removes an element identified by a marker, honouring nesting.
 *
 * The table of contents is page chrome, not content. It sits inside <main>, and
 * the mobile variant is a <div> containing further <div>s, so a plain
 * indexOf of the closing tag would cut the element in half.
 */
function stripElement(html, marker) {
  const at = html.indexOf(marker)
  if (at === -1) return html

  const open = html.lastIndexOf('<', at)
  if (open === -1) return html

  const name = (html.slice(open).match(/^<([a-zA-Z][a-zA-Z0-9-]*)/) ?? [])[1]
  if (!name) return html

  const scanner = new RegExp(`<${name}\\b|</${name}\\s*>`, 'gi')
  scanner.lastIndex = open
  let depth = 0
  let match
  while ((match = scanner.exec(html))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) return html.slice(0, open) + html.slice(scanner.lastIndex)
    } else {
      depth += 1
    }
  }
  return html
}

// --------------------------------------------------------------------- main

if (!readdirSync(DIST).includes('index.html')) {
  console.error('dist/index.html tidak ada — jalankan `npm run build` dulu.')
  process.exit(1)
}

const routes = []
const files = walk(DIST).sort()

for (const file of files) {
  const rel = relative(DIST, file).split(sep).join('/')

  // Error pages are not content: no markdown twin, no catalogue entry.
  // They also break the index.html-per-directory assumption below
  // (the root one is a bare 404.html file, not a folder).
  if (/(^|\/)(404|500)(\.html$|\/index\.html$)/.test(rel)) continue

  const html = readFileSync(file, 'utf8')

  // /notes/foo/index.html -> /notes/foo/
  let path = `/${rel.replace(/index\.html$/, '')}`
  if (path === '//') path = '/'

  const meta = pageMeta(html)
  const lang = path.startsWith('/id/') ? 'id' : meta.lang === 'id' ? 'id' : 'en'
  const body = toMarkdown(
    stripElement(stripElement(mainHtml(html), 'data-toc-disclosure'), '<aside')
  )

  const front = ['---', `title: ${JSON.stringify(meta.title)}`]
  if (meta.description) front.push(`description: ${JSON.stringify(meta.description)}`)
  front.push(`url: ${JSON.stringify(meta.canonical || `${SITE_ORIGIN}${path}`)}`)
  front.push(`lang: ${lang}`)
  front.push('---')

  const md = `${front.join('\n')}\n\n${body}\n`
  const target = join(DIST, path.replace(/^\//, ''), 'index.md')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, md)

  routes.push({
    path,
    url: meta.canonical || `${SITE_ORIGIN}${path}`,
    title: meta.title,
    description: meta.description,
    lang,
    markdown: `${path}${path.endsWith('/') ? '' : '/'}index.md`,
  })
}

// The homepage twin is served at /index.md as well as /md consumers expect /.
routes.sort((a, b) => a.path.localeCompare(b.path))

const languages = [...new Set(routes.map((r) => r.lang))].sort()

const catalog = {
  $schema: 'https://api-catalog.org/schema.json',
  name: 'mySite',
  description: 'Personal portfolio: notes, projects and pages.',
  url: `${SITE_ORIGIN}/`,
  version: '1.0.0',
  updated: new Date().toISOString().slice(0, 10),
  languages,
  formats: ['text/html', 'text/markdown', 'application/rss+xml', 'application/json'],
  feeds: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'Notes',
      href: `${SITE_ORIGIN}/notes/rss.xml`,
    },
  ],
  routes: routes.map(({ path, url, title, description, lang, markdown }) => ({
    path,
    url,
    lang,
    title,
    description,
    representations: [
      { type: 'text/html', href: url },
      { type: 'text/markdown', href: `${url.replace(/\/$/, '')}/index.md` },
    ],
    markdown,
  })),
}

mkdirSync(join(DIST, '.well-known'), { recursive: true })
writeFileSync(
  join(DIST, '.well-known', 'api-catalog.json'),
  `${JSON.stringify(catalog, null, 2)}\n`
)

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'mySite',
    version: '1.0.0',
    description: catalog.description,
    url: `${SITE_ORIGIN}/`,
  },
  'x-catalog': { languages, formats: catalog.formats },
  paths: Object.fromEntries(
    routes.map((r) => [
      r.path,
      {
        get: {
          summary: r.title,
          description: r.description || undefined,
          parameters: [
            {
              name: 'Accept',
              in: 'header',
              required: false,
              description: 'Send `text/markdown` to receive the markdown twin of this page.',
              schema: { type: 'string', examples: ['text/html', 'text/markdown'] },
            },
          ],
          responses: {
            200: {
              description: r.title,
              content: {
                'text/html': { schema: { type: 'string' } },
                'text/markdown': { schema: { type: 'string' } },
              },
            },
          },
        },
      },
    ])
  ),
}

writeFileSync(join(DIST, 'openapi.json'), `${JSON.stringify(openapi, null, 2)}\n`)

const skills = {
  $schema: 'https://agent-skills.org/index.json',
  site: `${SITE_ORIGIN}/`,
  updated: catalog.updated,
  skills: [
    {
      id: 'read-page',
      name: 'Read any page',
      summary: 'Fetch a page as HTML or as markdown.',
      description:
        'Every route answers text/html by default. Send `Accept: text/markdown` to get a markdown twin with YAML frontmatter carrying title, description, url and lang.',
      input: { route: 'Route path, for example /notes/ or /id/now/' },
      output: 'The page as markdown.',
      example: { request: 'GET /notes/ with Accept: text/markdown', result: '/notes/index.md' },
    },
    {
      id: 'list-routes',
      name: 'Enumerate the site',
      summary: 'List every route with its title, language and representations.',
      description:
        'The catalogue is generated at build time from the built HTML, so it cannot drift from the site.',
      output: 'A JSON catalogue.',
      example: { request: 'GET /.well-known/api-catalog.json', result: routes.length + ' routes' },
    },
    {
      id: 'follow-notes',
      name: 'Follow the notes feed',
      summary: 'Subscribe to new notes.',
      description:
        'The notes feed lists published notes with their links and dates. Indonesian notes live under /id/.',
      output: 'RSS 2.0.',
      example: { request: 'GET /notes/rss.xml', result: 'RSS feed' },
    },
    {
      id: 'machine-readable-catalog',
      name: 'Read the OpenAPI description',
      summary: 'The catalogue in OpenAPI 3.1 form.',
      description: 'Same content as the API catalogue, shaped for OpenAPI tooling.',
      output: 'JSON.',
      example: { request: 'GET /openapi.json', result: 'OpenAPI 3.1 document' },
    },
  ],
}

mkdirSync(join(DIST, '.well-known', 'agent-skills'), { recursive: true })
writeFileSync(
  join(DIST, '.well-known', 'agent-skills', 'index.json'),
  `${JSON.stringify(skills, null, 2)}\n`
)

console.log(`markdown twin ditulis: ${routes.length} halaman`)
console.log(
  'ditulis: /.well-known/api-catalog.json, /.well-known/agent-skills/index.json, /openapi.json'
)
