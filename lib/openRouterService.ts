interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SemanticSimilarityResult {
  score: number;
  confidence: number;
}

class OpenRouterService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string = 'google/gemini-2.5-pro-preview';
  private cache: Map<string, SemanticSimilarityResult> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found. AI highlighting will be disabled.');
    }
  }

  private async makeRequest(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Literature Tracing Tool'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 50,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private getCacheKey(query: string, text: string): string {
    return `${query}|||${text}`.substring(0, 200);
  }

  async calculateSemanticSimilarity(
    query: string, 
    text: string
  ): Promise<SemanticSimilarityResult> {
    if (!this.apiKey) {
      return { score: 0, confidence: 0 };
    }

    const cacheKey = this.getCacheKey(query, text);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const prompt = `Evaluate the semantic relevance between the query and target text. Return only a decimal number between 0 and 1, where:
- 1.0 = highly relevant/semantically similar
- 0.5 = moderately relevant
- 0.0 = not relevant at all

Query: "${query}"
Target: "${text.substring(0, 500)}"

Score:`;

      const messages: OpenRouterMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.makeRequest(messages);
      const content = response.choices[0]?.message?.content?.trim() || '0';
      
      const score = this.parseScore(content);
      const result: SemanticSimilarityResult = {
        score,
        confidence: score > 0 ? 0.8 : 0.5
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      return { score: 0, confidence: 0 };
    }
  }

  private parseScore(content: string): number {
    const match = content.match(/(\d*\.?\d+)/);
    if (match) {
      const score = parseFloat(match[1]);
      return Math.max(0, Math.min(1, score));
    }
    return 0;
  }

  async batchCalculateSemanticSimilarity(
    query: string,
    texts: string[]
  ): Promise<SemanticSimilarityResult[]> {
    if (!this.apiKey || texts.length === 0) {
      return texts.map(() => ({ score: 0, confidence: 0 }));
    }

    const results: SemanticSimilarityResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => 
        this.calculateSemanticSimilarity(query, text)
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch processing error:', error);
        results.push(...batch.map(() => ({ score: 0, confidence: 0 })));
      }
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const openRouterService = new OpenRouterService();
export type { SemanticSimilarityResult };