import en from './en.json' with { type: 'json' }
import id from './id.json' with { type: 'json' }

export type LangKey = 'en' | 'id'

export const LOCALES: LangKey[] = ['en', 'id']
export const DEFAULT_LANG: LangKey = 'en'

const dictionaries: Record<LangKey, Record<string, string>> = { en, id }

function getNested(source: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = source

  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' ? current : undefined
}

export function useTranslation(lang: LangKey) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    const dictionary = dictionaries[lang]
    const flat = dictionary[key]
    const template =
      typeof flat === 'string' ? flat : (getNested(dictionary, key.split('.')) ?? key)

    if (!vars) return template

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match
    )
  }
}

export function isLang(value: unknown): value is LangKey {
  return value === 'en' || value === 'id'
}

/**
 * Resolves the locale for the current route.
 *
 * Language lives in the URL (`/notes/x` is English, `/id/notes/x` is Indonesian),
 * so this is a pure function of `Astro.currentLocale` — there is no stored
 * preference and no client-side swap to keep in sync.
 */
export function getLang(currentLocale?: string): LangKey {
  return isLang(currentLocale) ? currentLocale : DEFAULT_LANG
}

/**
 * The two-line opener of every localised page in one call. `Astro.currentLocale`
 * goes in, the resolved language and its translator come out.
 */
export function useLocale(currentLocale?: string) {
  const lang = getLang(currentLocale)
  return { lang, t: useTranslation(lang) }
}

/**
 * Prefixes a path with the locale when it is not the default one.
 *
 * Anything that is not an internal path (absolute URL, `mailto:`, `tel:`, anchor,
 * protocol-relative) is returned untouched — prefixing those produced URLs like
 * `/idmailto:someone@example.com`.
 */
export function localePath(lang: LangKey, path: string): string {
  const isInternal = path.startsWith('/') && !path.startsWith('//')

  if (!isInternal) return path

  const clean = path === '/' ? '' : path.replace(/\/$/, '')

  if (lang === DEFAULT_LANG) return clean === '' ? '/' : clean

  return `/id${clean}`
}

/** Strips the `/id` locale prefix from a pathname, e.g. `/id/notes/x` → `/notes/x`. */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/id(?=\/|$)/, '') || '/'
}

export interface LocaleOption {
  code: LangKey
  label: string
  /** Null for the current locale, and for a missing translation. */
  href: string | null
  active: boolean
  /** True when the other locale has no page for this route (untranslated note). */
  missing: boolean
}

/**
 * Both language switchers (navbar pill, settings menu) show the same two
 * options with the same rules: the current locale is marked active, the other
 * one links to the same page, and the link is disabled when the other locale
 * has no counterpart page. `localeSwitchHref === null` signals that case;
 * `undefined` means "same path, other locale".
 */
export function getLocaleOptions({
  lang,
  localeFree,
  localeSwitchHref,
}: {
  lang: LangKey
  localeFree: string
  localeSwitchHref?: string | null
}): LocaleOption[] {
  return LOCALES.map((code) => {
    const active = code === lang
    const href = active ? null : (localeSwitchHref ?? localePath(code, localeFree))
    const missing = !active && localeSwitchHref === null

    return {
      code,
      label: code === 'id' ? 'Indonesia' : 'English',
      href: missing ? null : href,
      active,
      missing,
    }
  })
}

/**
 * URL slug for a note.
 *
 * Content-layer entries are keyed by file path (`entry.id`), so an English
 * note and its Indonesian twin can never share an id. Translations therefore
 * carry `urlPath` instead, and both resolve to the same clean URL in their own
 * locale — for example `silk-road-marketplace.mdx` and
 * `silk-road-marketplace.id.mdx` both serve `/notes/silk-road-marketplace/`.
 */
export function noteUrlSlug(note: { id: string; data: { urlPath?: string } }): string {
  return note.data.urlPath ?? note.id
}

/**
 * Fails the build on two notes in one locale resolving to the same URL.
 *
 * Without this, a duplicate only shows up as a missing page in `dist/`.
 */
export function assertUniqueNotePaths(
  notes: { id: string; data: { urlPath?: string } }[],
  lang: string
): void {
  const seen = new Map<string, string>()

  for (const note of notes) {
    const path = noteUrlSlug(note)
    const previous = seen.get(path)

    if (previous) {
      throw new Error(
        `[notes] Duplicate URL "/${path}" for locale "${lang}": ` +
          `"${previous}" and "${note.id}". Give one of them a distinct "urlPath".`
      )
    }

    seen.set(path, note.id)
  }
}

/** Locale-aware URL of a note detail page, e.g. `/id/notes/silk-road-marketplace`. */
export function noteHref(note: { id: string; data: { urlPath?: string } }, lang: LangKey): string {
  return localePath(lang, `/notes/${noteUrlSlug(note)}`)
}

/** Publication date in the page locale, e.g. `Oct 12, 2026` vs `12 Okt 2026`. */
export function formatShortDate(date: Date, lang: LangKey): string {
  return date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
