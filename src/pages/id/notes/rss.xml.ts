import type { APIContext } from 'astro'
import { getNotesRss } from '@/lib/notes'

export async function GET(context: APIContext) {
  return getNotesRss('id', context.site)
}
