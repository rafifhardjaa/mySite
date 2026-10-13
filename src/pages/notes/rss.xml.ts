import type { APIContext } from 'astro'
import { getNotesRss } from '@/lib/notes'

export async function GET(context: APIContext) {
  return getNotesRss('en', context.site)
}
