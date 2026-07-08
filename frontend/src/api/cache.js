/**
 * Simple in-memory + localStorage cache for API responses.
 * ponytail: swap to SWR/React Query when multi-tab sync or mutation needed.
 */
const CACHE_PREFIX = 'app_cache_'
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function getCached(key, ttl = DEFAULT_TTL) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded — silently ignore */ }
}

export function clearCache(key) {
  if (key) localStorage.removeItem(CACHE_PREFIX + key)
  else Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k))
}
