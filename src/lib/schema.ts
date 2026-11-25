// Shared shape for the BlogPosting JSON-LD emitted on note pages.
export interface ArticleSchema {
  title: string
  description?: string
  publishedAt: Date
  updatedAt?: Date
}
