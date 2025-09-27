import { openRouterService } from './openRouterService';

interface ContentSegment {
  text: string;
  type: 'title' | 'abstract' | 'introduction' | 'method' | 'result' | 'conclusion' | 'reference' | 'general';
  importance: number; // 0-1, importance in the paper
  relevanceScore: number; // 0-1, relevance to query
  highlightLevel: 'none' | 'low' | 'medium' | 'high';
  concepts: string[]; // extracted key concepts
}

interface SmartHighlightOptions {
  enableAI: boolean;
  relevanceThreshold: number;
  contextWindow: number; // sentences to consider for context
  prioritizeStructure: boolean; // prioritize abstract, conclusion etc.
}

interface LiteratureContent {
  title: string;
  abstract?: string;
  authors: string[];
  journal: string;
  year: number;
  fullText?: string; // if available
}

class SmartHighlightService {
  private readonly SECTION_PATTERNS = {
    abstract: /(?:abstract|摘要|概要)/i,
    introduction: /(?:introduction|引言|前言|背景)/i,
    method: /(?:method|methodology|approach|方法|实验方法)/i,
    result: /(?:result|finding|outcome|结果|实验结果)/i,
    conclusion: /(?:conclusion|summary|讨论|结论|总结)/i,
    reference: /(?:reference|bibliography|参考文献)/i
  };

  private readonly CONCEPT_PATTERNS = {
    // Scientific concepts
    technical: /\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\s*(?:\([^)]+\))?\b/g,
    // Chinese technical terms
    chineseTech: /[\u4e00-\u9fff]{2,8}(?:理论|方法|算法|模型|系统|技术|原理|机制)/g,
    // Numbers and measurements
    measurements: /\d+(?:\.\d+)?\s*(?:%|mm|cm|m|kg|g|°C|°F|Hz|MHz|GHz)/g,
    // Chemical formulas
    formulas: /[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)*/g
  };

  /**
   * Analyze literature content and generate smart highlights
   */
  async analyzeAndHighlight(
    query: string,
    literature: LiteratureContent,
    options: SmartHighlightOptions = {
      enableAI: true,
      relevanceThreshold: 0.3,
      contextWindow: 3,
      prioritizeStructure: true
    }
  ): Promise<{
    highlightedTitle: string;
    highlightedAbstract: string;
    segments: ContentSegment[];
    overallRelevance: number;
  }> {
    try {
      // Step 1: Segment the content
      const segments = await this.segmentContent(literature);
      
      // Step 2: Analyze relevance for each segment
      const analyzedSegments = await this.analyzeRelevance(query, segments, options);
      
      // Step 3: Generate highlights
      const highlightedTitle = await this.highlightText(query, literature.title, 'title', options);
      const highlightedAbstract = literature.abstract 
        ? await this.highlightText(query, literature.abstract, 'abstract', options)
        : '';
      
      // Step 4: Calculate overall relevance
      const overallRelevance = this.calculateOverallRelevance(analyzedSegments);
      
      return {
        highlightedTitle,
        highlightedAbstract,
        segments: analyzedSegments,
        overallRelevance
      };
    } catch (error) {
      console.error('Smart highlight analysis failed:', error);
      // Fallback to simple highlighting
      return this.fallbackHighlight(query, literature);
    }
  }

  /**
   * Segment content into meaningful parts
   */
  private async segmentContent(literature: LiteratureContent): Promise<ContentSegment[]> {
    const segments: ContentSegment[] = [];
    
    // Add title segment
    if (literature.title) {
      segments.push({
        text: literature.title,
        type: 'title',
        importance: 1.0,
        relevanceScore: 0,
        highlightLevel: 'none',
        concepts: this.extractConcepts(literature.title)
      });
    }
    
    // Add abstract segment
    if (literature.abstract) {
      segments.push({
        text: literature.abstract,
        type: 'abstract',
        importance: 0.9,
        relevanceScore: 0,
        highlightLevel: 'none',
        concepts: this.extractConcepts(literature.abstract)
      });
    }
    
    // If full text is available, segment it
    if (literature.fullText) {
      const textSegments = this.segmentFullText(literature.fullText);
      segments.push(...textSegments);
    }
    
    return segments;
  }

  /**
   * Segment full text into sections
   */
  private segmentFullText(fullText: string): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const sentences = this.splitIntoSentences(fullText);
    
    let currentSection: ContentSegment['type'] = 'general';
    let currentText = '';
    
    for (const sentence of sentences) {
      // Detect section changes
      const detectedSection = this.detectSection(sentence);
      if (detectedSection && detectedSection !== currentSection) {
        // Save previous section
        if (currentText.trim()) {
          segments.push({
            text: currentText.trim(),
            type: currentSection,
            importance: this.getSectionImportance(currentSection),
            relevanceScore: 0,
            highlightLevel: 'none',
            concepts: this.extractConcepts(currentText)
          });
        }
        currentSection = detectedSection;
        currentText = sentence;
      } else {
        currentText += ' ' + sentence;
      }
    }
    
    // Add final section
    if (currentText.trim()) {
      segments.push({
        text: currentText.trim(),
        type: currentSection,
        importance: this.getSectionImportance(currentSection),
        relevanceScore: 0,
        highlightLevel: 'none',
        concepts: this.extractConcepts(currentText)
      });
    }
    
    return segments;
  }

  /**
   * Analyze relevance of each segment to the query
   */
  private async analyzeRelevance(
    query: string,
    segments: ContentSegment[],
    options: SmartHighlightOptions
  ): Promise<ContentSegment[]> {
    const analyzedSegments: ContentSegment[] = [];
    
    for (const segment of segments) {
      let relevanceScore = 0;
      
      if (options.enableAI && openRouterService.isAvailable()) {
        // Use AI for semantic relevance analysis
        try {
          const prompt = `
            Analyze the relevance between the user query and the literature segment.
            
            User Query: "${query}"
            Literature Segment: "${segment.text}"
            Segment Type: ${segment.type}
            
            Rate the relevance on a scale of 0-1 where:
            - 0.8-1.0: Highly relevant, directly addresses the query
            - 0.5-0.7: Moderately relevant, related concepts or methods
            - 0.2-0.4: Somewhat relevant, background or supporting information
            - 0.0-0.1: Not relevant
            
            Consider:
            1. Semantic similarity between query and content
            2. Technical concepts and terminology overlap
            3. Methodological relevance
            4. Contextual importance in research
            
            Respond with only a number between 0 and 1.
          `;
          
          const result = await openRouterService.calculateSemanticSimilarity(query, segment.text);
          const score = result.score;
          if (!isNaN(score) && score >= 0 && score <= 1) {
            relevanceScore = score;
          }
        } catch (error) {
          console.warn('AI relevance analysis failed, using fallback:', error);
          relevanceScore = this.calculateKeywordRelevance(query, segment.text);
        }
      } else {
        // Fallback to keyword-based relevance
        relevanceScore = this.calculateKeywordRelevance(query, segment.text);
      }
      
      // Adjust score based on section importance
      if (options.prioritizeStructure) {
        relevanceScore *= segment.importance;
      }
      
      // Determine highlight level
      const highlightLevel = this.determineHighlightLevel(relevanceScore, options.relevanceThreshold);
      
      analyzedSegments.push({
        ...segment,
        relevanceScore,
        highlightLevel
      });
    }
    
    return analyzedSegments;
  }

  /**
   * Generate highlighted text for a specific segment
   */
  private async highlightText(
    query: string,
    text: string,
    type: ContentSegment['type'],
    options: SmartHighlightOptions
  ): Promise<string> {
    if (!text.trim()) return text;
    
    const relevanceScore = options.enableAI && openRouterService.isAvailable()
      ? await this.getAIRelevanceScore(query, text)
      : this.calculateKeywordRelevance(query, text);
    
    const highlightLevel = this.determineHighlightLevel(relevanceScore, options.relevanceThreshold);
    
    if (highlightLevel === 'none') return text;
    
    // Apply highlighting based on level
    return this.applyHighlighting(text, query, highlightLevel);
  }

  /**
   * Extract key concepts from text
   */
  private extractConcepts(text: string): string[] {
    const concepts: string[] = [];
    
    // Extract technical terms
    Object.values(this.CONCEPT_PATTERNS).forEach(pattern => {
      const matches = text.match(pattern) || [];
      concepts.push(...matches);
    });
    
    // Remove duplicates and filter
    return [...new Set(concepts)]
      .filter(concept => concept.length > 2)
      .slice(0, 10); // Limit to top 10 concepts
  }

  /**
   * Detect section type from text
   */
  private detectSection(text: string): ContentSegment['type'] | null {
    for (const [section, pattern] of Object.entries(this.SECTION_PATTERNS)) {
      if (pattern.test(text)) {
        return section as ContentSegment['type'];
      }
    }
    return null;
  }

  /**
   * Get importance score for different sections
   */
  private getSectionImportance(type: ContentSegment['type']): number {
    const importanceMap: Record<ContentSegment['type'], number> = {
      title: 1.0,
      abstract: 0.9,
      conclusion: 0.8,
      result: 0.7,
      method: 0.6,
      introduction: 0.5,
      reference: 0.2,
      general: 0.4
    };
    return importanceMap[type] || 0.4;
  }

  /**
   * Calculate keyword-based relevance
   */
  private calculateKeywordRelevance(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (textWords.some(textWord => textWord.includes(queryWord) || queryWord.includes(textWord))) {
        matches++;
      }
    }
    
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Get AI-based relevance score
   */
  private async getAIRelevanceScore(query: string, text: string): Promise<number> {
    try {
      const result = await openRouterService.calculateSemanticSimilarity(query, text);
      return result.score;
    } catch (error) {
      return this.calculateKeywordRelevance(query, text);
    }
  }

  /**
   * Determine highlight level based on relevance score
   */
  private determineHighlightLevel(score: number, threshold: number): ContentSegment['highlightLevel'] {
    if (score < threshold) return 'none';
    if (score < threshold + 0.2) return 'low';
    if (score < threshold + 0.4) return 'medium';
    return 'high';
  }

  /**
   * Apply highlighting to text based on level
   */
  private applyHighlighting(text: string, query: string, level: ContentSegment['highlightLevel']): string {
    if (level === 'none') return text;
    
    // Extract meaningful keywords from query, including Chinese terms
    const queryWords = this.extractKeywords(query);
    let highlightedText = text;
    
    const highlightClass = {
      low: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-yellow-200 text-yellow-900',
      high: 'bg-yellow-300 text-yellow-900 font-medium'
    }[level];
    
    for (const word of queryWords) {
      // Escape special regex characters
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlightedText = highlightedText.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    }
    
    return highlightedText;
  }

  /**
   * Extract meaningful keywords from query text
   */
  private extractKeywords(query: string): string[] {
    const keywords: string[] = [];
    
    // Extract Chinese technical terms (2-6 characters, avoiding overly long matches)
    const chineseTerms = query.match(/[\u4e00-\u9fff]{2,6}/g) || [];
    // Filter and add meaningful Chinese terms
    for (const term of chineseTerms) {
      if (term.length >= 2) {
        keywords.push(term);
        // Also add shorter meaningful substrings for better matching
        if (term.length > 3) {
          for (let i = 0; i <= term.length - 2; i++) {
            const substring = term.substring(i, i + 2);
            if (substring.length === 2) {
              keywords.push(substring);
            }
          }
        }
      }
    }
    
    // Extract English words (3+ characters)
    const englishWords = query.match(/[a-zA-Z]{3,}/g) || [];
    keywords.push(...englishWords);
    
    // Add common technical terms that might be split
    const commonTerms = ['深度学习', '医学图像', '图像分析', '机器学习', '神经网络', '人工智能'];
    for (const term of commonTerms) {
      if (query.includes(term)) {
        keywords.push(term);
      }
    }
    
    // Remove duplicates and filter out common stop words
    const stopWords = new Set(['的', '在', '中', '和', '与', '及', '等', '或', '是', '应用', 'the', 'in', 'of', 'and', 'or', 'for', 'with']);
    return [...new Set(keywords)].filter(word => !stopWords.has(word.toLowerCase()) && word.length >= 2);
  }

  /**
   * Calculate overall relevance of the literature
   */
  private calculateOverallRelevance(segments: ContentSegment[]): number {
    if (segments.length === 0) return 0;
    
    const weightedSum = segments.reduce((sum, segment) => {
      return sum + (segment.relevanceScore * segment.importance);
    }, 0);
    
    const totalWeight = segments.reduce((sum, segment) => sum + segment.importance, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?。！？；;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Fallback highlighting when AI analysis fails
   */
  private fallbackHighlight(query: string, literature: LiteratureContent): {
    highlightedTitle: string;
    highlightedAbstract: string;
    segments: ContentSegment[];
    overallRelevance: number;
  } {
    const highlightedTitle = this.applyHighlighting(literature.title, query, 'medium');
    const highlightedAbstract = literature.abstract 
      ? this.applyHighlighting(literature.abstract, query, 'medium')
      : '';
    
    const segments: ContentSegment[] = [
      {
        text: literature.title,
        type: 'title',
        importance: 1.0,
        relevanceScore: this.calculateKeywordRelevance(query, literature.title),
        highlightLevel: 'medium',
        concepts: this.extractConcepts(literature.title)
      }
    ];
    
    if (literature.abstract) {
      segments.push({
        text: literature.abstract,
        type: 'abstract',
        importance: 0.9,
        relevanceScore: this.calculateKeywordRelevance(query, literature.abstract),
        highlightLevel: 'medium',
        concepts: this.extractConcepts(literature.abstract)
      });
    }
    
    return {
      highlightedTitle,
      highlightedAbstract,
      segments,
      overallRelevance: this.calculateOverallRelevance(segments)
    };
  }
}

export const smartHighlightService = new SmartHighlightService();
export type { ContentSegment, SmartHighlightOptions, LiteratureContent };