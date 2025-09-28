import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SentenceResultSection } from './SentenceResultSection'

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: any[]
}

interface SearchResults {
  results: SentenceResult[]
}

interface SearchResultsProps {
  results: SearchResults
  searchQuery: string
}

export function SearchResults({ 
  results, 
  searchQuery 
}: SearchResultsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(results.results.length > 0 ? [0] : [])
  )
  
  const totalCount = results.results.reduce((sum, result) => sum + result.literature.length, 0)

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            检索结果
            <Badge variant="secondary">
              共找到 {totalCount} 篇文献
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.results.length > 0 ? (
            <div className="space-y-4">
              {results.results.map((result, index) => (
                <SentenceResultSection
                  key={`result-${index}`}
                  result={result}
                  searchQuery={searchQuery}
                  isExpanded={expandedSections.has(index)}
                  onToggle={() => toggleSection(index)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  暂无相关文献结果
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}