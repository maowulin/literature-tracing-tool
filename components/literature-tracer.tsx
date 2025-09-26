"use client"

import { useState, useEffect } from "react"
import { Search, ExternalLink, Copy, ChevronDown, Users, BookOpen, Calendar, Info, AlertCircle, RefreshCw, History, Trash2, Star, TrendingUp, Shield, Award, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { CitationFormatter } from "@/lib/citationFormatter"
import { Literature as LiteratureType } from "@/app/api/search/route"

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: LiteratureType[]
}

interface SearchHistoryItem {
  id: string
  query: string
  timestamp: Date
  results: { api1: SentenceResult[]; api2: SentenceResult[] }
}

const sampleQueries = [
  "子宫scar痕会影响胎盘。子宫scar痕可能导致罕见但严重的并发症，如剖宫产scar痕异位妊娠，涉及胎盘异常生长和出血风险。",
  "机器学习在医学诊断中的应用越来越广泛。深度学习算法可以自动分析医学图像。人工智能系统能够辅助临床决策。",
  "气候变化对生物多样性产生重大影响。全球变暖改变了物种分布模式。生态系统在气候压力下面临韧性挑战。",
  "量子计算为优化问题提供了新的解决方案。量子算法在某些计算任务上具有指数级优势。",
  "CRISPR基因编辑技术在治疗应用中显示出巨大潜力。基因治疗为遗传疾病提供了新的治疗途径。",
]

const decodeHtmlEntities = (s: string): string => {
  const txt = document.createElement("textarea")
  txt.innerHTML = s
  return txt.value
}

const cleanTitle = (raw: string): string => {
  return decodeHtmlEntities(raw).replace(/\s+/g, " ").trim()
}

export function LiteratureTracer() {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [currentResults, setCurrentResults] = useState<{ api1: SentenceResult[]; api2: SentenceResult[] }>({
    api1: [],
    api2: [],
  })
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<number>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    const savedHistory = localStorage.getItem("literature-search-history")
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error("Failed to parse search history:", error)
      }
    }
  }, [])

  const saveToHistory = (query: string, results: { api1: SentenceResult[]; api2: SentenceResult[] }) => {
    const historyItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      results
    }
    
    const newHistory = [historyItem, ...searchHistory.slice(0, 9)]
    setSearchHistory(newHistory)
    
    try {
      localStorage.setItem("literature-search-history", JSON.stringify(newHistory))
    } catch (error) {
      console.error("Failed to save search history:", error)
    }
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem("literature-search-history")
    toast({ description: "Search history cleared" })
  }

  const loadFromHistory = (item: SearchHistoryItem) => {
    setQuery(item.query)
    setCurrentResults(item.results)
    setHasSearched(true)
    setShowHistory(false)
    toast({ description: "Search loaded from history" })
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    setSearchError(null)
    setHasSearched(true)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query.trim() }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      setCurrentResults(data)
      saveToHistory(query.trim(), data)
      setRetryCount(0)
    } catch (error) {
      console.error("Search error:", error)
      setSearchError(error instanceof Error ? error.message : "Search failed")
      setRetryCount(prev => prev + 1)
    } finally {
      setIsSearching(false)
    }
  }

  const handleRetry = () => {
    if (retryCount < 3) {
      handleSearch()
    } else {
      toast({
        title: "Maximum retries reached",
        description: "Please try again later or contact support",
        variant: "destructive"
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      handleSearch()
    }
  }

  const useSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery)
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ description: `${label} copied` })
    } catch (error) {
      console.error("Failed to copy:", error)
      toast({ description: `Failed to copy ${label}`, variant: "destructive" })
    }
  }

  const toggleAbstract = (literatureId: number) => {
    setExpandedAbstracts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(literatureId)) {
        newSet.delete(literatureId)
      } else {
        newSet.add(literatureId)
      }
      return newSet
    })
  }

  const truncateText = (text: string, maxLength: number = 300) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  const highlightRelevantText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 1)
    let highlightedText = text
    
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })
    
    return highlightedText
  }

  const LiteratureCard = ({ literature, index }: { literature: LiteratureType; index: number }) => {
    const isExpanded = expandedAbstracts.has(literature.id)
    const abstractText = literature.abstract || ""
    const shouldTruncate = abstractText.length > 300
    const displayText = isExpanded || !shouldTruncate ? abstractText : truncateText(abstractText)
    const highlightedText = highlightRelevantText(displayText, query)

    return (
      <Card className="border border-border hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-medium text-foreground leading-snug break-words">
                  {cleanTitle(literature.title)}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span className="break-words">{literature.authors.join(", ")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span className="break-words">{literature.journal}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{literature.year}</span>
                  </div>
                  {literature.verified && (
                    <Badge variant="secondary" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              {literature.impactFactor && (
                <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                  <span className="font-medium">IF:</span>
                  <span className="font-semibold">{literature.impactFactor}</span>
                </div>
              )}
              {literature.citationCount && (
                <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded-md">
                  <span className="font-medium">引用:</span>
                  <span className="font-semibold">{literature.citationCount}</span>
                </div>
              )}
            </div>

            {literature.evaluation && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">AI质量评估</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs text-gray-600">相关性</span>
                    <span className="text-sm font-semibold text-purple-700">
                      {literature.evaluation.relevanceScore.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-gray-600">可信度</span>
                    <span className="text-sm font-semibold text-purple-700">
                      {literature.evaluation.credibilityScore.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    <span className="text-xs text-gray-600">影响力</span>
                    <span className="text-sm font-semibold text-purple-700">
                      {literature.evaluation.impactScore.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-3 h-3 text-purple-500" />
                    <span className="text-xs text-gray-600">综合</span>
                    <span className="text-sm font-semibold text-purple-700">
                      {literature.evaluation.overallScore.toFixed(1)}/10
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-purple-700 leading-relaxed break-words">
                  <strong>评估理由：</strong>{literature.evaluation.reasoning}
                </div>
                
                {literature.evaluation.strengths.length > 0 && (
                  <div className="mt-2 text-xs">
                    <span className="font-medium text-green-700">优势：</span>
                    <span className="text-green-600 break-words">{literature.evaluation.strengths.join(', ')}</span>
                  </div>
                )}
                
                {literature.evaluation.limitations.length > 0 && (
                  <div className="mt-1 text-xs">
                    <span className="font-medium text-orange-700">局限：</span>
                    <span className="text-orange-600 break-words">{literature.evaluation.limitations.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {literature.abstract && (
              <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary/30">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-foreground">摘要</h5>
                  {shouldTruncate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAbstract(literature.id)}
                      className="h-6 px-2 text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3 mr-1" />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3 mr-1" />
                          展开
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div 
                  className="text-sm text-muted-foreground leading-relaxed break-words overflow-hidden max-w-full"
                  dangerouslySetInnerHTML={{ __html: highlightedText }}
                />
              </div>
            )}

            <div className="bg-warning/10 border-l-4 border-warning p-3 rounded-r">
              <p className="text-sm text-warning-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>温馨提示：请点击 DOI 链接查看完整文献，选择最合适的论文进行引用</span>
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground break-words max-w-[60%]">
                <span className="font-medium">DOI:</span> {literature.doi}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-transparent"
                  onClick={() => window.open(`https://doi.org/${literature.doi}`, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-4 h-4" />
                  Access
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <Copy className="w-4 h-4" />
                      Copy
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => copyToClipboard(cleanTitle(literature.title), "Title")}>
                      Copy Title
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyToClipboard(literature.doi, "DOI")}>
                      Copy DOI
                    </DropdownMenuItem>
                    {literature.abstract && (
                      <DropdownMenuItem onClick={() => copyToClipboard(literature.abstract ?? "", "Abstract")}>
                        Copy Abstract
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        copyToClipboard(
                          CitationFormatter.formatAPA(literature),
                          "APA Citation",
                        )
                      }
                    >
                      Copy Citation (APA)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        copyToClipboard(
                          CitationFormatter.formatIEEE(literature),
                          "IEEE Citation",
                        )
                      }
                    >
                      Copy Citation (IEEE)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const SentenceResultSection = ({ sentenceResult }: { sentenceResult: SentenceResult }) => (
    <div className="mb-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {sentenceResult.sentenceIndex}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-foreground leading-relaxed break-words">{sentenceResult.sentence}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Supporting References ({sentenceResult.literature.length} papers)
          </p>
        </div>
      </div>

      <div className="ml-12 space-y-3">
        {sentenceResult.literature.map((literature, index) => (
          <LiteratureCard key={literature.id} literature={literature} index={index} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="border border-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="输入要查询的文本内容（支持多句话）..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  disabled={isSearching}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    搜索中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    搜索
                  </>
                )}
              </Button>
              <DropdownMenu open={showHistory} onOpenChange={setShowHistory}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <History className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between p-2 border-b">
                    <span className="text-sm font-medium">Search History</span>
                    {searchHistory.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearHistory}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {searchHistory.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No search history
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {searchHistory.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="flex flex-col items-start p-3 cursor-pointer"
                        >
                          <div className="text-sm font-medium truncate w-full">{item.query}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleString()}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">示例查询：</span>
              {sampleQueries.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => useSampleQuery(sample)}
                  className="text-xs h-7"
                  disabled={isSearching}
                >
                  示例 {index + 1}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {searchError && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Search Error</p>
                <p className="text-sm text-muted-foreground">{searchError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={isSearching}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry ({3 - retryCount} left)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasSearched && !searchError && (
        <div className="space-y-6">
          {isSearching ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-lg font-medium">正在搜索相关文献...</p>
              <p className="text-sm text-muted-foreground mt-2">这可能需要几秒钟时间</p>
            </div>
          ) : (
            <>
              <Tabs defaultValue="api1" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="api1">
                    Exa API ({currentResults.api1.reduce((acc, result) => acc + result.literature.length, 0)} 篇文献)
                  </TabsTrigger>
                  <TabsTrigger value="api2">
                    Crossref API ({currentResults.api2.reduce((acc, result) => acc + result.literature.length, 0)} 篇文献)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="api1" className="mt-6">
                  <div className="space-y-6">
                    {currentResults.api1.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Exa API 暂无结果</p>
                      </div>
                    ) : (
                      currentResults.api1.map((sentenceResult, index) => (
                        <SentenceResultSection key={index} sentenceResult={sentenceResult} />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="api2" className="mt-6">
                  <div className="space-y-6">
                    {currentResults.api2.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Crossref API 暂无结果</p>
                      </div>
                    ) : (
                      currentResults.api2.map((sentenceResult, index) => (
                        <SentenceResultSection key={index} sentenceResult={sentenceResult} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      )}

      {!hasSearched && !isSearching && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>输入文本内容开始文献溯源</p>
          <p className="text-sm mt-2">系统会自动按句子拆分并为每句话找到相关文献</p>
        </div>
      )}
    </div>
  )
}
