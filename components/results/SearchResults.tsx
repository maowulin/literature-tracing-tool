import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SentenceResultSection } from './SentenceResultSection'

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: any[]
}

interface SearchResults {
  api1: SentenceResult[]
  api2: SentenceResult[]
}

interface SearchResultsProps {
  results: SearchResults
  highlightRelevantText: (text: string, query: string) => Promise<string>
  searchQuery: string
}

export function SearchResults({ 
  results, 
  highlightRelevantText, 
  searchQuery 
}: SearchResultsProps) {
  const api1Count = results.api1.reduce((sum, result) => sum + result.literature.length, 0)
  const api2Count = results.api2.reduce((sum, result) => sum + result.literature.length, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            检索结果
            <Badge variant="secondary">
              共找到 {api1Count + api2Count} 篇文献
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="exa" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="exa" className="flex items-center gap-2">
                Exa API
                <Badge variant="outline" className="ml-1">
                  {api1Count}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="crossref" className="flex items-center gap-2">
                Crossref API
                <Badge variant="outline" className="ml-1">
                  {api2Count}
                </Badge>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="exa" className="mt-6">
              {results.api1.length > 0 ? (
                <div className="space-y-4">
                  {results.api1.map((result, index) => (
                    <SentenceResultSection
                      key={`exa-${index}`}
                      result={result}
                      highlightRelevantText={highlightRelevantText}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Exa API 暂无相关文献结果
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="crossref" className="mt-6">
              {results.api2.length > 0 ? (
                <div className="space-y-4">
                  {results.api2.map((result, index) => (
                    <SentenceResultSection
                      key={`crossref-${index}`}
                      result={result}
                      highlightRelevantText={highlightRelevantText}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Crossref API 暂无相关文献结果
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}