import { openRouterService, type SemanticSimilarityResult } from './openRouterService';

interface HighlightSegment {
  text: string;
  isHighlighted: boolean;
  score: number;
  method: 'keyword' | 'semantic' | 'hybrid';
}

interface HighlightOptions {
  enableAI: boolean;
  keywordThreshold: number;
  semanticThreshold: number;
  hybridMode: boolean;
}

class AIHighlightService {
  private chineseStopwords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么', '可以', '他', '她', '它', '我们', '你们', '他们', '这个', '那个', '这些', '那些', '这样', '那样', '如何', '为什么', '怎么', '哪里', '什么时候', '多少', '哪个', '哪些'
  ]);

  private englishStopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    
    const chineseMatches = text.match(/[\u4e00-\u9fff]+/g) || [];
    chineseMatches.forEach(match => {
      for (let i = 0; i < match.length - 1; i++) {
        const twoChar = match.substring(i, i + 2);
        if (!this.chineseStopwords.has(twoChar)) {
          keywords.push(twoChar);
        }
      }
      if (match.length >= 3) {
        for (let i = 0; i < match.length - 2; i++) {
          const threeChar = match.substring(i, i + 3);
          keywords.push(threeChar);
        }
      }
    });

    const englishMatches = text.match(/[a-zA-Z]+/g) || [];
    englishMatches.forEach(word => {
      const lowerWord = word.toLowerCase();
      if (lowerWord.length >= 3 && !this.englishStopwords.has(lowerWord)) {
        keywords.push(lowerWord);
      }
    });

    return [...new Set(keywords)];
  }

  private calculateKeywordSimilarity(query: string, text: string): number {
    const queryKeywords = this.extractKeywords(query.toLowerCase());
    const textKeywords = this.extractKeywords(text.toLowerCase());
    
    if (queryKeywords.length === 0) return 0;

    let matches = 0;
    queryKeywords.forEach(keyword => {
      if (textKeywords.some(textKeyword => 
        textKeyword.includes(keyword) || keyword.includes(textKeyword)
      )) {
        matches++;
      }
    });

    return matches / queryKeywords.length;
  }

  async highlightText(
    query: string, 
    text: string, 
    options: HighlightOptions = {
      enableAI: true,
      keywordThreshold: 0.1,
      semanticThreshold: 0.3,
      hybridMode: true
    }
  ): Promise<string> {
    if (!query.trim() || !text.trim()) {
      return text;
    }

    try {
      const segments = await this.analyzeText(query, text, options);
      return this.renderHighlightedText(segments);
    } catch (error) {
      console.error('Error in AI highlighting:', error);
      return this.fallbackHighlight(query, text);
    }
  }

  private async analyzeText(
    query: string, 
    text: string, 
    options: HighlightOptions
  ): Promise<HighlightSegment[]> {
    const sentences = this.splitIntoSentences(text);
    const segments: HighlightSegment[] = [];

    for (const sentence of sentences) {
      const keywordScore = this.calculateKeywordSimilarity(query, sentence);
      let semanticScore = 0;
      let finalScore = keywordScore;
      let method: 'keyword' | 'semantic' | 'hybrid' = 'keyword';

      if (options.enableAI && openRouterService.isAvailable()) {
        if (options.hybridMode && keywordScore > options.keywordThreshold) {
          try {
            const semanticResult = await openRouterService.calculateSemanticSimilarity(query, sentence);
            semanticScore = semanticResult.score;
            finalScore = Math.max(keywordScore, semanticScore * 0.8);
            method = 'hybrid';
          } catch (error) {
            console.warn('Semantic analysis failed, using keyword only:', error);
          }
        } else if (!options.hybridMode) {
          try {
            const semanticResult = await openRouterService.calculateSemanticSimilarity(query, sentence);
            semanticScore = semanticResult.score;
            finalScore = semanticScore;
            method = 'semantic';
          } catch (error) {
            console.warn('Semantic analysis failed, fallback to keyword:', error);
            finalScore = keywordScore;
            method = 'keyword';
          }
        }
      }

      const threshold = method === 'semantic' ? options.semanticThreshold : options.keywordThreshold;
      const isHighlighted = finalScore > threshold;

      segments.push({
        text: sentence,
        isHighlighted,
        score: finalScore,
        method
      });
    }

    return segments;
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/([.!?。！？；;][\s]*|[\n\r]+)/)
      .filter(segment => segment.trim().length > 0)
      .map(segment => segment.trim());
  }

  private renderHighlightedText(segments: HighlightSegment[]): string {
    return segments
      .map(segment => {
        if (segment.isHighlighted) {
          const intensity = Math.min(segment.score, 1);
          const opacity = Math.max(0.3, intensity);
          return `<mark style="background-color: rgba(255, 255, 0, ${opacity}); padding: 1px 2px; border-radius: 2px;" data-score="${segment.score.toFixed(2)}" data-method="${segment.method}">${segment.text}</mark>`;
        }
        return segment.text;
      })
      .join('');
  }

  private fallbackHighlight(query: string, text: string): string {
    const keywords = this.extractKeywords(query);
    let highlightedText = text;

    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark style="background-color: rgba(255, 255, 0, 0.3);">$1</mark>');
    });

    return highlightedText;
  }

  async batchHighlight(
    query: string,
    texts: string[],
    options?: HighlightOptions
  ): Promise<(string | null)[]> {
    if (!openRouterService.isAvailable()) {
      // Fallback to keyword-based highlighting if AI service is not available
      return texts.map(text => this.fallbackHighlight(query, text));
    }

    const highlightPromises = texts.map(text => 
      this.highlightText(query, text, options).catch(error => {
        console.error(`Error highlighting text: "${text.substring(0, 50)}..."`, error);
        return this.fallbackHighlight(query, text); // Fallback for individual error
      })
    );

    try {
      return await Promise.all(highlightPromises);
    } catch (error) {
      console.error('Batch highlighting failed:', error);
      // Broad fallback in case Promise.all fails unexpectedly
      return texts.map(text => this.fallbackHighlight(query, text));
    }
  }

  getServiceStatus(): {
    aiAvailable: boolean;
    cacheSize: number;
  } {
    return {
      aiAvailable: openRouterService.isAvailable(),
      cacheSize: openRouterService.getCacheSize()
    };
  }

  clearCache(): void {
    openRouterService.clearCache();
  }
}

export const aiHighlightService = new AIHighlightService();
export type { HighlightOptions, HighlightSegment };