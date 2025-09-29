import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: any[]
}

interface SearchResults {
  results: SentenceResult[]
}

interface SearchHistoryItem {
  id: string
  query: string
  timestamp: Date
  results: SearchResults
}

export function useLiteratureSearch(query: string) {
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [currentResults, setCurrentResults] = useState<SearchResults>({
    results: [],
  })
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  
  const { toast } = useToast()

  const loadSearchHistory = useCallback(() => {
    if (typeof window === 'undefined') return
    
    try {
      const savedHistory = localStorage.getItem('literature-search-history')
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory)
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      }
    } catch (error) {
      console.error('Failed to parse search history:', error)
    }
  }, [])

  const compressResults = (results: SearchResults): SearchResults => {
    return {
      results: results.results.map(result => ({
        sentence: result.sentence,
        sentenceIndex: result.sentenceIndex,
        literature: result.literature.map(lit => ({
          id: lit.id,
          title: lit.title.length > 100 ? lit.title.substring(0, 100) + '...' : lit.title,
          authors: lit.authors.slice(0, 3),
          journal: lit.journal,
          year: lit.year,
          doi: lit.doi,
          verified: lit.verified,
          supportingPages: lit.supportingPages,
          abstract: lit.abstract ? (lit.abstract.length > 200 ? lit.abstract.substring(0, 200) + '...' : lit.abstract) : undefined,
          impactFactor: lit.impactFactor,
          citationCount: lit.citationCount
        })).slice(0, 5)
      })).slice(0, 10)
    }
  }

  const getStorageSize = (data: string): number => {
    return new Blob([data]).size
  }

  const saveToHistory = useCallback((query: string, results: SearchResults) => {
    if (typeof window === 'undefined') return
    
    try {
      const compressedResults = compressResults(results)
      const historyItem: SearchHistoryItem = {
        id: Date.now().toString(),
        query,
        timestamp: new Date(),
        results: compressedResults
      }
      
      let currentHistory: SearchHistoryItem[] = []
      try {
        const stored = localStorage.getItem('literature-search-history')
        if (stored) {
          currentHistory = JSON.parse(stored)
        }
      } catch (parseError) {
        console.error('Failed to parse existing search history:', parseError)
        currentHistory = []
      }
      
      let newHistory = [historyItem, ...currentHistory]
      
      const maxStorageSize = 2 * 1024 * 1024
      let historyData = JSON.stringify(newHistory)
      
      while (getStorageSize(historyData) > maxStorageSize && newHistory.length > 1) {
        newHistory = newHistory.slice(0, -1)
        historyData = JSON.stringify(newHistory)
      }
      
      newHistory = newHistory.slice(0, 5)
      setSearchHistory(newHistory)
      
      localStorage.setItem('literature-search-history', JSON.stringify(newHistory))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          localStorage.removeItem('literature-search-history')
          setSearchHistory([])
          toast({ 
            description: 'Storage quota exceeded. Search history has been cleared.',
            variant: 'destructive'
          })
        } catch (clearError) {
          console.error('Failed to clear storage:', clearError)
        }
      } else {
        console.error('Failed to save search history:', error)
      }
    }
  }, [toast])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('literature-search-history')
    }
    toast({ description: 'Search history cleared' })
  }, [toast])

  const loadFromHistory = useCallback((item: SearchHistoryItem) => {
    setCurrentResults(item.results)
    setHasSearched(true)
    toast({ description: 'Search loaded from history' })
    return item.query
  }, [toast])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    setSearchError(null)
    setHasSearched(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query.trim() }),
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // If response is not JSON, use the default HTTP error message
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setCurrentResults(data)
      saveToHistory(query.trim(), data)
      setRetryCount(0)
      
      return data
    } catch (error) {
      console.error('Search error:', error)
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setSearchError(errorMessage)
      setRetryCount(prev => prev + 1)
      throw error
    } finally {
      setIsSearching(false)
    }
  }, [saveToHistory])

  const retrySearch = useCallback((query: string) => {
    if (retryCount < 3) {
      return performSearch(query)
    } else {
      toast({
        title: 'Maximum retries reached',
        description: 'Please try again later or contact support',
        variant: 'destructive'
      })
      return Promise.reject(new Error('Maximum retries reached'))
    }
  }, [retryCount, performSearch, toast])

  return {
    // State
    isSearching,
    hasSearched,
    searchError,
    retryCount,
    currentResults,
    searchHistory,
    
    // Actions
    performSearch,
    retrySearch,
    loadSearchHistory,
    saveToHistory,
    clearHistory,
    loadFromHistory,
    
    // Setters for external control
    setHasSearched,
    setSearchError,
    setCurrentResults
  }
}