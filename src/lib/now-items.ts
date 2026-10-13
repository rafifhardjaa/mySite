import { getCollection, type CollectionEntry } from 'astro:content'

export type NowItemEntry = CollectionEntry<'nowItems'>
export type NowItemKind = NowItemEntry['data']['kind']

/** Entries of one /now section, in explicit order. */
export async function getNowItems(kind: NowItemKind): Promise<NowItemEntry[]> {
  const items = await getCollection('nowItems', (item) => item.data.kind === kind)

  return items.sort((a, b) => a.data.order - b.data.order)
}

/**
 * Page-level "last updated" stamp: the newest updatedAt across all entries.
 * Bump an entry's updatedAt whenever it changes and the stamp follows —
 * no more hardcoded date literals on the page.
 */
export async function getNowLastUpdated(): Promise<Date> {
  const items = await getCollection('nowItems')

  return items.reduce(
    (latest, item) => (item.data.updatedAt > latest ? item.data.updatedAt : latest),
    new Date(0)
  )
}
