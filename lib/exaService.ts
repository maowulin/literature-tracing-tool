import Exa from 'exa-js';
import { z } from 'zod';

// Exa API response schemas
const ExaResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  highlightScores: z.array(z.number()).optional(),
  score: z.number().optional(),
});

const ExaSearchResponseSchema = z.object({
  results: z.array(ExaResultSchema),
  autopromptString: z.string().optional(),
});

export type ExaResult = z.infer<typeof ExaResultSchema>;
export type ExaSearchResponse = z.infer<typeof ExaSearchResponseSchema>;

export interface ExaSearchOptions {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startCrawlDate?: string;
  endCrawlDate?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
  useAutoprompt?: boolean;
  type?: 'neural' | 'keyword';
  category?: 'research paper' | 'news' | 'company' | 'pdf';
  includeText?: boolean;
  includeHighlights?: boolean;
  includeSummary?: boolean;
}

export class ExaService {
  private exa: Exa;

  constructor(apiKey: string) {
    this.exa = new Exa(apiKey);
  }

  async search(options: ExaSearchOptions): Promise<ExaResult[]> {
    try {
      // Prepare search options for exa-js SDK
      const searchOptions: any = {
        numResults: options.numResults || 5,
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startCrawlDate: options.startCrawlDate,
        endCrawlDate: options.endCrawlDate,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        useAutoprompt: options.useAutoprompt !== false,
        type: options.type || 'neural',
        category: options.category || 'research paper',
      };

      // Prepare contents options
      const contentsOptions: any = {};
      if (options.includeText !== false) {
        contentsOptions.text = true;
      }
      if (options.includeHighlights !== false) {
        contentsOptions.highlights = true;
      }
      if (options.includeSummary) {
        contentsOptions.summary = true;
      }

      // Use searchAndContents with query as first parameter and options as second
      const response = await this.exa.searchAndContents(options.query, {
        ...searchOptions,
        ...contentsOptions,
      });
      
      // Transform the response to match our schema
      const transformedResults = response.results.map((result: any) => ({
        id: result.id,
        title: result.title,
        url: result.url,
        publishedDate: result.publishedDate,
        author: result.author,
        text: result.text,
        highlights: result.highlights,
        highlightScores: result.highlightScores,
        score: result.score,
      }));

      return ExaResultSchema.array().parse(transformedResults);
    } catch (error) {
      console.error('Exa search error:', error);
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchMultipleQueries(queries: string[], options?: Omit<ExaSearchOptions, 'query'>): Promise<ExaResult[][]> {
    const searchPromises = queries.map(query => 
      this.searchWithRetry({ ...options, query })
    );
    
    return Promise.all(searchPromises);
  }

  async searchWithRetry(
    options: ExaSearchOptions, 
    maxRetries: number = 3, 
    baseDelay: number = 1000
  ): Promise<ExaResult[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.search(options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Exa search attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}