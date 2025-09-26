"use client"

import { useState, useEffect } from "react"
import { Search, ExternalLink, Copy, ChevronDown, Users, BookOpen, Calendar, Info, AlertCircle, RefreshCw, History, Trash2, Star, TrendingUp, Shield, Award } from "lucide-react"
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
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

const cleanTitle = (raw: string): string => {
  const stripped = raw.replace(/<[^>]+>/g, "")
  return decodeHtmlEntities(stripped)
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
  const { toast } = useToast()

  // Load search history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('literature-search-history')
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
        setSearchHistory(parsedHistory)
      } catch (error) {
        console.error('Failed to load search history:', error)
      }
    }
  }, [])



  const addToHistory = (query: string, results: { api1: SentenceResult[]; api2: SentenceResult[] }) => {
    console.log('addToHistory called with:', { query, results })
    const newHistoryItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      results
    }

    setSearchHistory(prev => {
      // Remove duplicate queries and keep only the latest 10 items
      const filtered = prev.filter(item => item.query !== query)
      const newHistory = [newHistoryItem, ...filtered].slice(0, 10)
      
      console.log('Saving to localStorage:', newHistory)
      // Save to localStorage
      localStorage.setItem('literature-search-history', JSON.stringify(newHistory))
      
      return newHistory
    })
  }

  const loadFromHistory = (historyItem: SearchHistoryItem) => {
    setQuery(historyItem.query)
    setCurrentResults(historyItem.results)
    setHasSearched(true)
    setShowHistory(false)
    setSearchError(null)
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('literature-search-history')
    toast({
      title: "历史记录已清空",
      description: "所有搜索历史记录已被删除",
    })
  }

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery)
    setSearchError(null)
  }

  const handleSearch = async () => {
    console.log('handleSearch called with query:', query.trim())
    
    if (!query.trim()) {
      console.log('Empty query, returning early')
      return
    }

    setIsSearching(true)
    setSearchError(null)
    console.log('Starting search process')

    try {
      console.log('About to call API with query:', query.trim())
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: query.trim() }),
      })

      console.log('API response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('API response data:', data)
      
      setCurrentResults(data)
      setHasSearched(true)
      
      console.log('About to call addToHistory')
      addToHistory(query.trim(), data)
      console.log('addToHistory call completed')
      
    } catch (error) {
      console.error('Search error:', error)
      setSearchError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setIsSearching(false)
      console.log('Search process completed')
    }
  }

  const handleRetry = () => {
    handleSearch()
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: `${label} copied` })
  }

  const LiteratureCard = ({ literature, index }: { literature: LiteratureType; index: number }) => (
    <Card className="mb-4 border border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              {index + 1}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              {literature.verified && (
                <Badge className="bg-verified text-verified-foreground hover:bg-verified/90">Crossref Verified</Badge>
              )}
            </div>

            <h4 className="text-base font-medium text-foreground leading-relaxed">{cleanTitle(literature.title)}</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{literature.authors.join(", ")}</span>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>{literature.journal}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{literature.year}</span>
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

              {/* GPT-5 Quality Evaluation */}
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
                  
                  <div className="text-xs text-purple-700 leading-relaxed">
                    <strong>评估理由：</strong>{literature.evaluation.reasoning}
                  </div>
                  
                  {literature.evaluation.strengths.length > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium text-green-700">优势：</span>
                      <span className="text-green-600">{literature.evaluation.strengths.join(', ')}</span>
                    </div>
                  )}
                  
                  {literature.evaluation.limitations.length > 0 && (
                    <div className="mt-1 text-xs">
                      <span className="font-medium text-orange-700">局限：</span>
                      <span className="text-orange-600">{literature.evaluation.limitations.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {literature.abstract && (
              <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary/30">
                <h5 className="text-sm font-medium text-foreground mb-2">摘要</h5>
                <p className="text-sm text-muted-foreground leading-relaxed">{literature.abstract}</p>
              </div>
            )}

            <div className="bg-warning/10 border-l-4 border-warning p-3 rounded-r">
              <p className="text-sm text-warning-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>温馨提示：请点击 DOI 链接查看完整文献，选择最合适的论文进行引用</span>
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground">
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
        </div>
      </CardContent>
    </Card>
  )

  const SentenceResultSection = ({ sentenceResult }: { sentenceResult: SentenceResult }) => (
    <div className="mb-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {sentenceResult.sentenceIndex}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-foreground leading-relaxed">{sentenceResult.sentence}</h3>
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
    <div className="space-y-6">
      {/* 搜索区域 */}
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
                  onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearch()}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <DropdownMenu open={showHistory} onOpenChange={setShowHistory}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-12 w-12" disabled={searchHistory.length === 0}>
                    <History className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between p-2 border-b">
                    <span className="text-sm font-medium">搜索历史</span>
                    {searchHistory.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="h-6 px-2 text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        清空
                      </Button>
                    )}
                  </div>
                  {searchHistory.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      暂无搜索历史
                    </div>
                  ) : (
                    searchHistory.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="flex flex-col items-start p-3 cursor-pointer"
                      >
                        <div className="text-sm font-medium line-clamp-2 mb-1">
                          {item.query}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleString('zh-CN')} • 
                          API1: {item.results.api1.length} 句 • 
                          API2: {item.results.api2.length} 句
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => handleSearch()} disabled={isSearching || !query.trim()} className="h-12 px-6">
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    搜索中...
                  </>
                ) : (
                  "搜索文献"
                )}
              </Button>
            </div>

            {/* Error message and retry */}
            {searchError && (
              <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">{searchError}</span>
                </div>
                {retryCount < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isSearching}
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    重试 ({retryCount}/3)
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">试试这些示例查询：</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sampleQueries.map((sampleQuery, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSampleQuery(sampleQuery)}
                    className="text-xs text-left h-auto py-2 px-3 whitespace-normal leading-relaxed"
                  >
                    {sampleQuery}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 结果区域 */}
      {isSearching && (
        <div className="space-y-4">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium">正在搜索相关文献...</p>
            <p className="text-sm text-muted-foreground mt-2">这可能需要几秒钟时间</p>
          </div>
        </div>
      )}

      {hasSearched && !isSearching && (
        <div className="space-y-4">
          {currentResults.api1.length === 0 && currentResults.api2.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">未找到相关文献</p>
              <p className="text-sm text-muted-foreground mt-2">请尝试使用不同的关键词或调整查询内容</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                为查询内容找到相关文献，按句子展示溯源结果
              </div>

              <Tabs defaultValue="api1" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="api1">
                    接口一结果 ({currentResults.api1.reduce((acc, result) => acc + result.literature.length, 0)} 篇文献)
                  </TabsTrigger>
                  <TabsTrigger value="api2">
                    接口二结果 ({currentResults.api2.reduce((acc, result) => acc + result.literature.length, 0)} 篇文献)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="api1" className="mt-6">
                  <div className="space-y-6">
                    {currentResults.api1.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>接口一暂无结果</p>
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
                        <p>接口二暂无结果</p>
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
