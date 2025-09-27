"use client"

import { useState, useEffect } from "react"
import { useLiteratureSearch } from "@/hooks/use-literature-search"
import { SearchInput } from "@/components/search/SearchInput"
import { SearchResults } from "@/components/results/SearchResults"

export default function LiteratureTracer() {
  const [query, setQuery] = useState("")
  
  const {
    currentResults,
    isSearching,
    hasSearched,
    searchError,
    retryCount,
    searchHistory,
    performSearch,
    retrySearch,
    loadSearchHistory,
    clearHistory,
    loadFromHistory
  } = useLiteratureSearch(query)

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
        />

        {hasSearched && (
          <SearchResults
            results={currentResults}
            searchQuery={query}
          />
        )}
      </div>
    </div>
  )
}
