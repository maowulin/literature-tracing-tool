import { Literature } from '../types'

// Text processing utilities
export const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

export const cleanTitle = (title: string): string => {
  return decodeHtmlEntities(title).replace(/\s+/g, ' ').trim()
}

export const truncateText = (text: string, maxLength: number = 300): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// Data validation utilities
export const isValidDOI = (doi: string): boolean => {
  const doiRegex = /^10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/
  return doiRegex.test(doi)
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidYear = (year: number): boolean => {
  const currentYear = new Date().getFullYear()
  return year >= 1900 && year <= currentYear + 1
}

// Array utilities
export const removeDuplicates = <T>(array: T[], keyFn: (item: T) => string | number): T[] => {
  const seen = new Set<string | number>()
  return array.filter(item => {
    const key = keyFn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export const groupBy = <T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<K, T[]>)
}

// Literature-specific utilities
export const calculateRelevanceScore = (
  query: string,
  title: string,
  abstract?: string
): number => {
  const queryWords = query.toLowerCase().split(/\s+/)
  const titleWords = title.toLowerCase().split(/\s+/)
  const abstractWords = abstract?.toLowerCase().split(/\s+/) || []
  
  let score = 0
  const totalWords = queryWords.length
  
  queryWords.forEach(word => {
    if (titleWords.includes(word)) score += 2
    if (abstractWords.includes(word)) score += 1
  })
  
  return Math.min(10, (score / totalWords) * 5)
}

export const sortLiteratureByRelevance = (
  literature: Literature[],
  query: string
): Literature[] => {
  return literature.sort((a, b) => {
    const scoreA = calculateRelevanceScore(query, a.title, a.abstract)
    const scoreB = calculateRelevanceScore(query, b.title, b.abstract)
    return scoreB - scoreA
  })
}

// Date utilities
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export const parsePublicationDate = (dateString: string): Date | null => {
  try {
    return new Date(dateString)
  } catch {
    return null
  }
}

// Error handling utilities
export const createErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout')
  }
  return false
}

// Storage utilities
export const safeJSONParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

export const safeJSONStringify = (data: unknown): string => {
  try {
    return JSON.stringify(data)
  } catch {
    return '{}'
  }
}