import rss from '@astrojs/rss'
import { getCollection, type CollectionEntry } from 'astro:content'
import { SITE } from './constants'
import { assertUniqueNotePaths, noteHref, noteUrlSlug, type LangKey } from '@/i18n/utils'

export type NoteEntry = CollectionEntry<'notes'>

/** Non-draft notes in one locale, newest first. */
export async function getPublishedNotes(lang: LangKey): Promise<NoteEntry[]> {
  const notes = await getCollection('notes', (n) => n.data.lang === lang && !n.data.draft)

  return notes.sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
}

/** Static paths for a locale's note detail routes, failing the build on duplicate URLs. */
export async function getNoteStaticPaths(lang: LangKey) {
  const notes = await getPublishedNotes(lang)

  assertUniqueNotePaths(notes, lang)

  return notes.map((note) => ({ params: { slug: noteUrlSlug(note) }, props: { note } }))
}

/**
 * Whether a note URL exists in the other locale. Pointing the language switch
 * at a missing translation produced a 404, so the switch is hidden instead.
 */
export async function hasNoteTranslation(notePath: string, otherLang: LangKey): Promise<boolean> {
  const notes = await getCollection('notes')

  return notes.some((note) => noteUrlSlug(note) === notePath && note.data.lang === otherLang)
}

/** A locale's notes feed. Both locales share this; only the language differs. */
export async function getNotesRss(lang: LangKey, site: URL | string | undefined) {
  const notes = await getPublishedNotes(lang)

  return rss({
    title: lang === 'id' ? `${SITE.name} - Catatan` : `${SITE.name} - Notes`,
    description: SITE.description[lang],
    site: site?.toString() ?? SITE.url,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      link: `${noteHref(note, lang)}/`,
      pubDate: note.data.publishedAt,
    })),
    customData: `<language>${lang}</language>`,
  })
}
