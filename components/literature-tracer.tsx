"use client"

import { useState, useEffect } from "react"
import { Search, ExternalLink, Copy, ChevronDown, Users, BookOpen, Calendar, Info, AlertCircle, RefreshCw, History, Trash2 } from "lucide-react"
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

const sampleQueries = [
  "子宫疤痕会影响胎盘。子宫疤痕可能导致罕见但严重的并发症，如剖宫产疤痕异位妊娠，涉及胎盘异常生长和出血风险。",
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
  const { toast } = useToast()

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery)
    setSearchError(null)
  }

  const handleSearch = async (isRetry = false) => {
    if (!query.trim()) return

    setIsSearching(true)
    setSearchError(null)
    
    if (!isRetry) {
      setRetryCount(0)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: query.trim() }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Search failed: ${response.status} ${response.statusText}. ${errorText}`)
      }

      const data = await response.json()
      
      if (!data || (!data.api1 && !data.api2)) {
        throw new Error('Invalid response format from search API')
      }

      setCurrentResults(data)
      setHasSearched(true)
      setSearchError(null)
      setRetryCount(0)
      
      toast({ 
        description: "搜索完成！找到相关文献", 
        variant: "default" 
      })
    } catch (error) {
      console.error('Search failed:', error)
      
      let errorMessage = "搜索失败，请稍后重试"
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "搜索超时，请检查网络连接后重试"
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "网络连接失败，请检查网络后重试"
        } else if (error.message.includes('500')) {
          errorMessage = "服务器内部错误，请稍后重试"
        } else if (error.message.includes('429')) {
          errorMessage = "请求过于频繁，请稍后重试"
        }
      }
      
      setSearchError(errorMessage)
      setRetryCount(prev => prev + 1)
      
      toast({ 
        description: errorMessage, 
        variant: "destructive" 
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleRetry = () => {
    handleSearch(true)
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
