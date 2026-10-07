# Orbit Index (future)

Not built yet — this is the contract the rest of the system already speaks, so it can be added without touching the browser.

```
Crawler → Document processor → Search index → Orbit Search API → Orbit Search UI
```

- **Orbit Search UI**: `apps/search` (exists).
- **Orbit Search API**: `apps/search/src/server.ts` exposes `GET /api/search?q=&type=&page=`. Backends implement `SearchProvider`
  in `packages/search/src/adapters.ts`.
- **Orbit Index service** (to build): any service that answers `GET {ORBIT_INDEX_URL}/search?q=&page=` with
  `{ "results": [{ "title", "url", "snippet", "displayUrl" }], "total": number }`. Set `ORBIT_INDEX_URL` and
  `ORBIT_SEARCH_BACKEND=orbit` and Orbit Search uses it immediately.

Suggested first version: a Node crawler for an **approved list of domains** (respecting robots.txt and rate limits), a
document processor that extracts title/text, and Typesense or Meilisearch as the index, in its own `apps/index` workspace.
It will index a small curated set of sites, not the web, and the UI will say so.
