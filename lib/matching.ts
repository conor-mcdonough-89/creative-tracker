import type { CreatorPattern } from './types'

/**
 * Check if an ad name matches a creator pattern
 * Pattern matching is case-insensitive substring match
 */
export function matchesPattern(adName: string, pattern: string): boolean {
  return adName.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * Find the first matching creator pattern for an ad name
 */
export function findMatchingPattern(
  adName: string,
  patterns: CreatorPattern[]
): CreatorPattern | null {
  return patterns.find(p => matchesPattern(adName, p.pattern)) || null
}

/**
 * Find all ads that match a given pattern
 */
export function findMatchingAds<T extends { ad_name: string }>(
  ads: T[],
  pattern: string
): T[] {
  return ads.filter(ad => matchesPattern(ad.ad_name, pattern))
}

/**
 * Group ads by creator based on patterns
 */
export function groupAdsByCreator<T extends { ad_name: string }>(
  ads: T[],
  patterns: Array<CreatorPattern & { creator_name: string }>
): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>()

  // Initialize with unassigned group
  groups.set(null, [])

  for (const ad of ads) {
    const matchingPattern = patterns.find(p =>
      matchesPattern(ad.ad_name, p.pattern)
    )

    if (matchingPattern) {
      const creatorId = matchingPattern.creator_id
      if (!groups.has(creatorId)) {
        groups.set(creatorId, [])
      }
      groups.get(creatorId)!.push(ad)
    } else {
      groups.get(null)!.push(ad)
    }
  }

  return groups
}

/**
 * Get unique ad names from performance records
 */
export function getUniqueAdNames(
  records: Array<{ ad_name: string }>
): string[] {
  return [...new Set(records.map(r => r.ad_name))]
}

/**
 * Count how many unique ads match a pattern
 */
export function countMatchingAds(
  adNames: string[],
  pattern: string
): number {
  return adNames.filter(name => matchesPattern(name, pattern)).length
}

/**
 * Build SQL ILIKE pattern from a simple pattern string
 * For use with Supabase/PostgreSQL queries
 */
export function buildILikePattern(pattern: string): string {
  // Escape special SQL LIKE characters
  const escaped = pattern
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `%${escaped}%`
}

/**
 * Parse ad name to extract potential creator handle
 * This is a heuristic that looks for @mentions or common patterns
 */
export function extractPotentialHandle(adName: string): string | null {
  // Look for @handle pattern
  const atMatch = adName.match(/@(\w+)/)
  if (atMatch) {
    return atMatch[1]
  }

  // Look for "by <name>" pattern
  const byMatch = adName.match(/\bby\s+(\w+)/i)
  if (byMatch) {
    return byMatch[1]
  }

  return null
}
