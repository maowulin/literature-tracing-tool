import type { Literature } from "@/app/api/search/route"

interface NormalizedLiterature extends Literature {
  normalizedKey: string
}

export class DeduplicationService {
  /**
   * Normalize title by removing extra whitespace, punctuation, and converting to lowercase
   */
  private static normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Generate a unique key for literature item
   * Priority: DOI > normalized title + first author + year
   */
  private static generateKey(literature: Literature): string {
    // If DOI exists and is not 'N/A', use it as the primary key
    if (literature.doi && literature.doi !== 'N/A' && literature.doi.trim() !== '') {
      return `doi:${literature.doi.toLowerCase().trim()}`
    }

    // Fallback to title + first author + year combination
    const normalizedTitle = this.normalizeTitle(literature.title)
    const firstAuthor = literature.authors[0] || 'unknown'
    const normalizedAuthor = firstAuthor.toLowerCase().replace(/[^\w\s]/g, '').trim()
    
    return `title:${normalizedTitle}|author:${normalizedAuthor}|year:${literature.year}`
  }

  /**
   * Deduplicate literature array based on DOI and title+author+year combination
   */
  static deduplicate(literatureList: Literature[]): Literature[] {
    const seenKeys = new Set<string>()
    const deduplicatedList: Literature[] = []

    for (const literature of literatureList) {
      const key = this.generateKey(literature)
      
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        deduplicatedList.push(literature)
      }
    }

    return deduplicatedList
  }

  /**
   * Merge duplicate literature items, preferring Crossref verified data
   */
  static mergeAndDeduplicate(literatureList: Literature[]): Literature[] {
    const keyToLiterature = new Map<string, Literature>()

    for (const literature of literatureList) {
      const key = this.generateKey(literature)
      const existing = keyToLiterature.get(key)

      if (!existing) {
        keyToLiterature.set(key, literature)
      } else {
        // Merge logic: prefer verified (Crossref) data over unverified (Exa) data
        const merged = this.mergeLiteratureItems(existing, literature)
        keyToLiterature.set(key, merged)
      }
    }

    return Array.from(keyToLiterature.values())
  }

  /**
   * Merge two literature items, preferring verified data
   */
  private static mergeLiteratureItems(item1: Literature, item2: Literature): Literature {
    // If one is verified and the other is not, prefer the verified one
    if (item1.verified && !item2.verified) {
      return { ...item1, abstract: item1.abstract || item2.abstract }
    }
    if (item2.verified && !item1.verified) {
      return { ...item2, abstract: item2.abstract || item1.abstract }
    }

    // If both have same verification status, prefer the one with more complete data
    const item1Score = this.calculateCompletenessScore(item1)
    const item2Score = this.calculateCompletenessScore(item2)

    const preferred = item1Score >= item2Score ? item1 : item2
    const other = item1Score >= item2Score ? item2 : item1

    // Merge abstracts if one is missing
    return {
      ...preferred,
      abstract: preferred.abstract || other.abstract,
      citationCount: preferred.citationCount || other.citationCount,
      impactFactor: preferred.impactFactor || other.impactFactor,
      supportingPages: preferred.supportingPages || other.supportingPages,
    }
  }

  /**
   * Calculate completeness score for literature item
   */
  private static calculateCompletenessScore(literature: Literature): number {
    let score = 0
    
    if (literature.doi && literature.doi !== 'N/A') score += 3
    if (literature.abstract) score += 2
    if (literature.citationCount) score += 1
    if (literature.impactFactor) score += 1
    if (literature.authors.length > 1) score += 1
    if (literature.journal && literature.journal !== 'Unknown Journal') score += 1
    
    return score
  }

  /**
   * Sort literature by relevance and quality
   */
  static sortByRelevanceAndQuality(literatureList: Literature[]): Literature[] {
    return literatureList.sort((a, b) => {
      // First priority: verified status (Crossref verified items first)
      if (a.verified !== b.verified) {
        return a.verified ? -1 : 1
      }

      // Second priority: citation count (higher first)
      const aCitations = a.citationCount || 0
      const bCitations = b.citationCount || 0
      if (aCitations !== bCitations) {
        return bCitations - aCitations
      }

      // Third priority: impact factor (higher first)
      const aImpact = a.impactFactor || 0
      const bImpact = b.impactFactor || 0
      if (aImpact !== bImpact) {
        return bImpact - aImpact
      }

      // Fourth priority: publication year (newer first)
      if (a.year !== b.year) {
        return b.year - a.year
      }

      // Fifth priority: completeness score
      const aScore = this.calculateCompletenessScore(a)
      const bScore = this.calculateCompletenessScore(b)
      return bScore - aScore
    })
  }
}