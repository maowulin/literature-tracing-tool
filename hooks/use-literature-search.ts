import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: any[]
}

interface SearchResults {
  api1: SentenceResult[]
  api2: SentenceResult[]
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
    api1: [],
    api2: [],
  })
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  
  const { toast } = useToast()

  const loadSearchHistory = useCallback(() => {
    const savedHistory = localStorage.getItem('literature-search-history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error('Failed to parse search history:', error)
      }
    }
  }, [])

  const saveToHistory = useCallback((query: string, results: SearchResults) => {
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      results
    }
    
    const newHistory = [historyItem, ...searchHistory.slice(0, 9)]
    setSearchHistory(newHistory)
    
    try {
      localStorage.setItem('literature-search-history', JSON.stringify(newHistory))
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  }, [searchHistory])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    localStorage.removeItem('literature-search-history')
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
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      setCurrentResults(data)
      saveToHistory(query.trim(), data)
      setRetryCount(0)
      
      return data
    } catch (error) {
      console.error('Search error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Search failed'
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