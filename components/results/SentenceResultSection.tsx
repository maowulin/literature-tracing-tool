import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
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
}

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}

interface SentenceResultSectionProps {
  result: SentenceResult
  highlightRelevantText: (text: string, query: string) => Promise<string>
  searchQuery: string
}

export function SentenceResultSection({ 
  result, 
  highlightRelevantText, 
  searchQuery 
}: SentenceResultSectionProps) {
  const [highlightedSentence, setHighlightedSentence] = useState(result.sentence)
  const { toast } = useToast()

  useEffect(() => {
    const updateHighlight = async () => {
      try {
        const highlighted = await highlightRelevantText(result.sentence, searchQuery)
        setHighlightedSentence(highlighted)
      } catch (error) {
        console.error('Failed to highlight text:', error)
        setHighlightedSentence(result.sentence)
      }
    }
    
    updateHighlight()
  }, [result.sentence, searchQuery, highlightRelevantText])

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
                    <h4 className="font-semibold text-sm leading-tight flex-1">
                      {lit.title}
                    </h4>
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
                    <div>{lit.authors.join(', ')}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span>{lit.journal} ({lit.year})</span>
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
                    </div>
                  </div>
                </div>

                {/* DOI and Actions */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">DOI:</span>
                  <code className="bg-muted px-1 py-0.5 rounded text-xs flex-1">
                    {lit.doi}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(lit.doi, 'DOI')}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://doi.org/${lit.doi}`, '_blank')}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>

                {/* Abstract */}
                {lit.abstract && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">摘要</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(lit.abstract!, 'Abstract')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {lit.abstract}
                    </p>
                  </div>
                )}

                {/* AI Quality Evaluation */}
                {lit.evaluation && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">AI质量评估</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className={`text-lg font-bold rounded-md px-2 py-1 ${getScoreColor(lit.evaluation.relevance.score)}`}>
                          {lit.evaluation.relevance.score}/10
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          相关性 ({getScoreLabel(lit.evaluation.relevance.score)})
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold rounded-md px-2 py-1 ${getScoreColor(lit.evaluation.credibility.score)}`}>
                          {lit.evaluation.credibility.score}/10
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          可信度 ({getScoreLabel(lit.evaluation.credibility.score)})
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold rounded-md px-2 py-1 ${getScoreColor(lit.evaluation.impact.score)}`}>
                          {lit.evaluation.impact.score}/10
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          影响力 ({getScoreLabel(lit.evaluation.impact.score)})
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-medium text-green-700 mb-1">优势</div>
                        <ul className="space-y-1 text-muted-foreground">
                          {lit.evaluation.advantages.map((advantage, idx) => (
                            <li key={idx}>• {advantage}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-orange-700 mb-1">局限</div>
                        <ul className="space-y-1 text-muted-foreground">
                          {lit.evaluation.limitations.map((limitation, idx) => (
                            <li key={idx}>• {limitation}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Citation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">引用格式</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatCitation(lit), 'Citation')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    {formatCitation(lit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}