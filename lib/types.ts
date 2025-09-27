// Common types used across the application

export interface Literature {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  verified: boolean
  supportingPages?: number
  abstract?: string
  impactFactor?: number
  citationCount?: number
  evaluation?: LiteratureEvaluation
}

export interface LiteratureEvaluation {
  relevance: { score: number; reason: string }
  credibility: { score: number; reason: string }
  impact: { score: number; reason: string }
  advantages: string[]
  limitations: string[]
}

export interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}

export interface SearchResults {
  exaResults: SentenceResult[]
  crossrefResults: SentenceResult[]
}

export interface SearchHistoryItem {
  query: string
  timestamp: number
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  retryAfter?: number
}

export interface SearchOptions {
  maxResults?: number
  includeAbstract?: boolean
  includeCitations?: boolean
  dateRange?: {
    start?: string
    end?: string
  }
}

export interface HighlightOptions {
  enableAI: boolean
  maxHighlights?: number
  confidenceThreshold?: number
}