import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, ExternalLink, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Literature {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  verified: boolean
  supportingPages?: number
  abstract?: string
  impactFactor?: number
  citationCount?: number
  evaluation?: {
    relevance: { score: number; reason: string }
    credibility: { score: number; reason: string }
    impact: { score: number; reason: string }
    advantages: string[]
    limitations: string[]
  }
  highlightedTitle?: string
  highlightedAbstract?: string
}

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}

interface SentenceResultSectionProps {
  result: SentenceResult
  searchQuery: string
}

export function SentenceResultSection({ 
  result, 
  searchQuery 
}: SentenceResultSectionProps) {
  const [highlightedSentence, setHighlightedSentence] = useState(result.sentence)
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<number>>(new Set())
  const { toast } = useToast()

  // Use backend-provided highlighting for the sentence if available later; currently keep plain text
  useEffect(() => {
    setHighlightedSentence(result.sentence)
  }, [result.sentence])

  const toggleAbstractExpansion = (litId: number) => {
    setExpandedAbstracts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(litId)) {
        newSet.delete(litId)
      } else {
        newSet.add(litId)
      }
      return newSet
    })
  }

  const isAbstractLong = (abstract: string) => {
    return abstract.length > 200
  }

  const getTruncatedAbstract = (abstract?: string) => {
    if (!abstract) return ''
    return abstract.length > 200 ? abstract.substring(0, 200) + '...' : abstract
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ description: `${type} copied to clipboard` })
    } catch (error) {
      console.error('Failed to copy:', error)
      toast({ 
        description: `Failed to copy ${type}`, 
        variant: 'destructive' 
      })
    }
  }

  const formatCitation = (lit: Literature) => {
    const authors = lit.authors.slice(0, 3).join(', ') + (lit.authors.length > 3 ? ', et al.' : '')
    return `${authors} (${lit.year}). ${lit.title}. ${lit.journal}. DOI: ${lit.doi}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50'
    if (score >= 6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 8) return '优秀'
    if (score >= 6) return '良好'
    return '一般'
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-start gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
            {result.sentenceIndex + 1}
          </span>
          <div 
            className="flex-1 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedSentence }}
          />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {result.literature.map((lit) => (
          <Card key={lit.id} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Title and Basic Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm leading-tight flex-1 break-words">
                      {lit.highlightedTitle ? (
                        <div dangerouslySetInnerHTML={{ 
                          __html: lit.highlightedTitle 
                        }} />
                      ) : (
                        lit.title
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {lit.verified && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(lit.title, 'Title')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <div className="break-words">{lit.authors.join(', ')}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="break-words">{lit.journal} ({lit.year})</span>
                      {lit.impactFactor && (
                        <Badge variant="secondary" className="text-xs">
                          IF: {lit.impactFactor}
                        </Badge>
                      )}
                      {lit.citationCount && (
                        <Badge variant="outline" className="text-xs">
                          引用: {lit.citationCount}
                        </Badge>
                      )}
                      {lit.supportingPages && (
                        <Badge variant="secondary" className="text-xs">
                          支持页码: {lit.supportingPages}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* DOI and Links */}
                <div className="flex items-center gap-2 text-sm">
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    asChild
                  >
                    <a href={`https://doi.org/${lit.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                      打开文献
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(lit.doi, 'DOI')}
                    className="h-6"
                  >
                    复制 DOI
                  </Button>
                </div>

                {/* Abstract */}
                {lit.abstract && (
                  <div className="space-y-2">
                    <div className="text-sm leading-relaxed break-words">
                      {isAbstractLong(lit.abstract) && !expandedAbstracts.has(lit.id) ? (
                        <>
                          {lit.highlightedAbstract ? (
                            <div dangerouslySetInnerHTML={{ 
                              __html: getTruncatedAbstract(lit.highlightedAbstract) 
                            }} />
                          ) : (
                            getTruncatedAbstract(lit.abstract)
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAbstractExpansion(lit.id)}
                            className="h-6 p-0 text-blue-600 inline-flex items-center gap-1 ml-1"
                          >
                            展开全文 <ChevronDown className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {lit.highlightedAbstract ? (
                            <div dangerouslySetInnerHTML={{ 
                              __html: lit.highlightedAbstract 
                            }} />
                          ) : (
                            lit.abstract
                          )}
                          {isAbstractLong(lit.abstract) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAbstractExpansion(lit.id)}
                              className="h-6 p-0 text-blue-600 inline-flex items-center gap-1 ml-1"
                            >
                              收起摘要 <ChevronUp className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(lit.abstract || '', 'Abstract')}
                        className="h-6"
                      >
                        复制摘要
                      </Button>
                    </div>
                  </div>
                )}

                {/* AI Quality Evaluation */}
                {lit.evaluation ? (
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getScoreColor(lit.evaluation.relevance.score)}`}>
                        相关性: {getScoreLabel(lit.evaluation.relevance.score)} ({lit.evaluation.relevance.score}/10)
                      </Badge>
                      <Badge className={`text-xs ${getScoreColor(lit.evaluation.credibility.score)}`}>
                        可信度: {getScoreLabel(lit.evaluation.credibility.score)} ({lit.evaluation.credibility.score}/10)
                      </Badge>
                      <Badge className={`text-xs ${getScoreColor(lit.evaluation.impact.score)}`}>
                        影响力: {getScoreLabel(lit.evaluation.impact.score)} ({lit.evaluation.impact.score}/10)
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-0.5" />
                        <div>
                          <div className="font-medium">优势</div>
                          <ul className="list-disc list-inside">
                            {lit.evaluation.advantages.map((adv, idx) => (
                              <li key={idx}>{adv}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-2">
                        <AlertCircle className="w-3 h-3 mt-0.5" />
                        <div>
                          <div className="font-medium">限制</div>
                          <ul className="list-disc list-inside">
                            {lit.evaluation.limitations.map((lim, idx) => (
                              <li key={idx}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Citation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(formatCitation(lit), 'Citation')}
                    className="h-6"
                  >
                    复制引用
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}