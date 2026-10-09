import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const PAGES = [
  '',
  '/features',
  '/download',
  '/search',
  '/themes',
  '/privacy',
  '/changelog',
  '/about',
  '/support',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.7,
  }))
}
