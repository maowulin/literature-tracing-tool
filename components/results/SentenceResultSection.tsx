import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Brain,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Literature {
  id: number;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi: string;
  verified: boolean;
  supportingPages?: number;
  abstract?: string;
  impactFactor?: number;
  citationCount?: number;
  evaluation?: {
    relevance: { score: number; reason: string };
    credibility: { score: number; reason: string };
    impact: { score: number; reason: string };
    advantages: string[];
    limitations: string[];
  };
  highlightedTitle?: string;
  highlightedAbstract?: string;
}

interface SentenceResult {
  sentence: string;
  sentenceIndex: number;
  literature: Literature[];
}

interface SentenceResultSectionProps {
  result: SentenceResult;
  searchQuery: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function SentenceResultSection({
  result,
  searchQuery,
  isExpanded = false,
  onToggle,
}: SentenceResultSectionProps) {
  const [highlightedSentence, setHighlightedSentence] = useState(
    result.sentence
  );
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<number>>(
    new Set()
  );
  const [evaluatingLiterature, setEvaluatingLiterature] = useState<Set<number>>(
    new Set()
  );
  const [literatureData, setLiteratureData] = useState<Literature[]>(
    result.literature
  );
  const { toast } = useToast();

  // Use backend-provided highlighting for the sentence if available later; currently keep plain text
  useEffect(() => {
    setHighlightedSentence(result.sentence);
  }, [result.sentence]);

  const toggleAbstractExpansion = (litId: number) => {
    setExpandedAbstracts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(litId)) {
        newSet.delete(litId);
      } else {
        newSet.add(litId);
      }
      return newSet;
    });
  };

  const isAbstractLong = (abstract: string) => {
    return abstract.length > 200;
  };

  const getTruncatedAbstract = (abstract?: string) => {
    if (!abstract) return "";
    return abstract.length > 200
      ? abstract.substring(0, 200) + "..."
      : abstract;
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ description: `${type} copied to clipboard` });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        description: `Failed to copy ${type}`,
        variant: "destructive",
      });
    }
  };

  const formatCitation = (lit: Literature) => {
    const authors =
      lit.authors.slice(0, 3).join(", ") +
      (lit.authors.length > 3 ? ", et al." : "");
    return `${authors} (${lit.year}). ${lit.title}. ${lit.journal}. DOI: ${lit.doi}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50";
    if (score >= 6) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "优秀";
    if (score >= 6) return "良好";
    return "一般";
  };

  const evaluateLiterature = async (literature: Literature) => {
    if (evaluatingLiterature.has(literature.id)) return;

    setEvaluatingLiterature((prev) => new Set(prev).add(literature.id));

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          literature: {
            id: literature.id,
            title: literature.title,
            authors: literature.authors,
            journal: literature.journal,
            year: literature.year,
            abstract: literature.abstract,
            doi: literature.doi,
            citationCount: literature.citationCount,
            impactFactor: literature.impactFactor,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLiteratureData((prev) =>
          prev.map((lit) =>
            lit.id === literature.id
              ? { ...lit, evaluation: data.evaluation }
              : lit
          )
        );
        toast({ description: "AI评分完成" });
      } else {
        throw new Error(data.error || "Evaluation failed");
      }
    } catch (error) {
      console.error("Literature evaluation failed:", error);
      toast({
        description: "AI评分失败，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setEvaluatingLiterature((prev) => {
        const newSet = new Set(prev);
        newSet.delete(literature.id);
        return newSet;
      });
    }
  };

  return (
    <Card className="mb-6 border-2 transition-all duration-200 hover:shadow-md">
      <CardHeader
        className={`transition-all duration-200 ${
          onToggle
            ? "cursor-pointer hover:bg-gray-50/80 active:bg-gray-100/80"
            : ""
        } ${isExpanded ? "border-b border-gray-200" : ""}`}
        onClick={onToggle}
      >
        <CardTitle className="text-base flex items-start gap-3">
          <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5 shadow-sm">
            {result.sentenceIndex}
          </span>
          <div
            className="flex-1 leading-relaxed text-gray-800"
            dangerouslySetInnerHTML={{ __html: highlightedSentence }}
          />
          {onToggle && (
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <Badge variant="outline" className="text-xs">
                {result.literature.length} 篇文献
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full hover:bg-gray-200/80 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {literatureData.map((lit) => (
            <Card key={lit.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Title and Basic Info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm leading-tight flex-1 break-words">
                        {lit.highlightedTitle ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: lit.highlightedTitle,
                            }}
                          />
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
                          onClick={() => copyToClipboard(lit.title, "Title")}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <div className="break-words">
                        {lit.authors.join(", ")}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="break-words">
                          {lit.journal} ({lit.year})
                        </span>
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
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <a
                        href={lit.doi}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                      >
                        打开文献
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(lit.doi, "DOI")}
                      className="h-6"
                    >
                      <Copy className="w-3 h-3 mr-1" /> 复制 DOI
                    </Button>
                  </div>

                  {/* Abstract */}
                  {lit.abstract && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-muted-foreground">
                          摘要
                        </div>
                        <div className="flex items-center gap-2">
                          {isAbstractLong(lit.abstract) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAbstractExpansion(lit.id)}
                              className="h-7 px-2 text-blue-600 inline-flex items-center gap-1"
                            >
                              {expandedAbstracts.has(lit.id) ? (
                                <>
                                  收起摘要 <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  展开全文 <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(lit.abstract || "", "Abstract")
                            }
                            className="h-7 px-2"
                          >
                            <Copy className="w-3 h-3 mr-1" /> 复制摘要
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm leading-relaxed break-words">
                        {isAbstractLong(lit.abstract) &&
                        !expandedAbstracts.has(lit.id) ? (
                          <>
                            {lit.highlightedAbstract ? (
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: getTruncatedAbstract(
                                    lit.highlightedAbstract
                                  ),
                                }}
                              />
                            ) : (
                              getTruncatedAbstract(lit.abstract)
                            )}
                          </>
                        ) : (
                          <>
                            {lit.highlightedAbstract ? (
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: lit.highlightedAbstract,
                                }}
                              />
                            ) : (
                              lit.abstract
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Quality Evaluation */}
                  {lit.evaluation ? (
                    <div className="bg-muted/50 border border-border rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-xs ${getScoreColor(
                            lit.evaluation.relevance.score
                          )}`}
                        >
                          相关性:{" "}
                          {getScoreLabel(lit.evaluation.relevance.score)} (
                          {Math.round(lit.evaluation.relevance.score)}/10)
                        </Badge>
                        <Badge
                          className={`text-xs ${getScoreColor(
                            lit.evaluation.credibility.score
                          )}`}
                        >
                          可信度:{" "}
                          {getScoreLabel(lit.evaluation.credibility.score)} (
                          {Math.round(lit.evaluation.credibility.score)}/10)
                        </Badge>
                        <Badge
                          className={`text-xs ${getScoreColor(
                            lit.evaluation.impact.score
                          )}`}
                        >
                          影响力: {getScoreLabel(lit.evaluation.impact.score)} (
                          {Math.round(lit.evaluation.impact.score)}/10)
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
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md p-2 break-words select-text">
                      {formatCitation(lit)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(formatCitation(lit), "Citation")
                        }
                        className="h-6"
                      >
                        <Copy className="w-3 h-3 mr-1" /> 复制引用
                      </Button>
                      {!lit.evaluation && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => evaluateLiterature(lit)}
                          disabled={evaluatingLiterature.has(lit.id)}
                          className="h-6"
                        >
                          {evaluatingLiterature.has(lit.id) ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              评分中...
                            </>
                          ) : (
                            <>
                              <Brain className="w-3 h-3 mr-1" />
                              AI评分
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
