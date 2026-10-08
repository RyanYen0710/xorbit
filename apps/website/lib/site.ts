export const VERSION = '0.1.4'
export const CHANNEL = 'BETA'
// NEXT_PUBLIC_SITE_URL wins; on Vercel fall back to its production URL; locally use localhost.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
/** "owner/repo" whose GitHub Releases host the installers. Unset → download buttons stay disabled. */
/** Chrome Web Store listing URL. Unset → the "Add to Chrome" button stays disabled. */
export const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL ?? ''
export const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? ''

/** The separate Support Center site (apps/support-center) where tickets are created. */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'https://xorbit-support-center.vercel.app'

export const NAV = [
  { href: '/features', label: 'Browser' },
  { href: '/search', label: 'Search' },
  { href: '/themes', label: 'Themes' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/download', label: 'Download' },
]

export interface Asset {
  name: string
  url: string
  size: number
}
export interface Release {
  version: string
  date: string
  notes: string
  assets: Asset[]
}

/** Latest release (pre-releases included) from GitHub. Null when no repo is configured or none is published. */
export async function getRelease(): Promise<Release | null> {
  if (!REPO) return null
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!r.ok) return null
    const list = (await r.json()) as any[]
    const rel = list.find((x) => !x.draft)
    if (!rel) return null
    return {
      version: String(rel.tag_name).replace(/^v/, ''),
      date: rel.published_at,
      notes: rel.body ?? '',
      assets: (rel.assets ?? []).map((a: any) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })),
    }
  } catch {
    return null
  }
}

export const pick = (rel: Release | null, re: RegExp) =>
  rel?.assets.find((a) => re.test(a.name)) ?? null
export const fmtSize = (n: number) => `${(n / 1048576).toFixed(0)} MB`
