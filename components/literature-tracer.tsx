"use client"

import { useState, useEffect } from "react"
import { useLiteratureSearch } from "@/hooks/use-literature-search"
import { useAIHighlight } from "@/hooks/use-ai-highlight"
import { SearchInput } from "@/components/search/SearchInput"
import { SearchResults } from "@/components/results/SearchResults"

export default function LiteratureTracer() {
  const [query, setQuery] = useState('')
  
  // Use custom hooks for search and AI highlighting
  const {
    isSearching,
    hasSearched,
    searchError,
    retryCount,
    currentResults,
    searchHistory,
    performSearch,
    retrySearch,
    loadSearchHistory,
    clearHistory,
    loadFromHistory
  } = useLiteratureSearch(query)
  
  const {
    aiHighlightEnabled,
    highlightRelevantText,
    toggleAIHighlight
  } = useAIHighlight()

  // Load search history on component mount
  useEffect(() => {
    loadSearchHistory()
  }, [loadSearchHistory])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">文献溯源工具</h1>
        <p className="text-muted-foreground">
          输入文本内容，智能检索相关学术文献并提供AI质量评估
        </p>
      </div>

      <div className="space-y-8">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSearch={performSearch}
          onRetry={retrySearch}
          isSearching={isSearching}
          searchError={searchError}
          retryCount={retryCount}
          searchHistory={searchHistory}
          onLoadFromHistory={loadFromHistory}
          onClearHistory={clearHistory}
          aiHighlightEnabled={aiHighlightEnabled}
          onToggleAIHighlight={toggleAIHighlight}
        />

        {hasSearched && (
          <SearchResults
            results={currentResults}
            highlightRelevantText={highlightRelevantText}
            searchQuery={query}
          />
        )}
      </div>
    </div>
  )
}
