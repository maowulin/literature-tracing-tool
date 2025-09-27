import { z } from 'zod'
import { BaseService } from './base/BaseService'
import { Literature, APIResponse, SearchOptions } from './types'

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
  doi: z.string().optional(),
})

const ExaSearchResponseSchema = z.object({
  results: z.array(ExaResultSchema),
  autopromptString: z.string().optional(),
})

export type ExaResult = z.infer<typeof ExaResultSchema>
export type ExaSearchResponse = z.infer<typeof ExaSearchResponseSchema>

interface ExaSearchOptions extends SearchOptions {
  query: string
  type?: 'neural' | 'keyword'
  useAutoprompt?: boolean
  numResults?: number
  startCrawlDate?: string
  endCrawlDate?: string
  startPublishedDate?: string
  endPublishedDate?: string
  includeDomains?: string[]
  excludeDomains?: string[]
  category?: 'research paper' | 'news' | 'company' | 'pdf'
  includeText?: boolean
  includeHighlights?: boolean
  includeSummary?: boolean
}

export class ExaService extends BaseService {
  constructor() {
    const apiKey = process.env.EXA_API_KEY || ''
    super('https://api.exa.ai', {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    })
    
    if (!apiKey) {
      console.warn('EXA_API_KEY is missing from environment variables')
    }
  }

  async search(options: ExaSearchOptions): Promise<ExaResult[]> {
    try {
      const requestBody = {
        query: options.query,
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
        contents: {
          text: options.includeText !== false,
          highlights: options.includeHighlights !== false,
          summary: options.includeSummary || false
        }
      }

      const response = await this.makeRequest<ExaSearchResponse>('/search', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Exa search failed')
      }

      return response.data.results
    } catch (error) {
      console.error('Exa search error:', error)
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchMultipleQueries(queries: string[], options?: Omit<ExaSearchOptions, 'query'>): Promise<ExaResult[][]> {
    const searchPromises = queries.map(query => 
      this.searchWithRetry({ ...options, query })
    )
    
    return Promise.all(searchPromises)
  }

  async searchWithRetry(
    options: ExaSearchOptions, 
    maxRetries: number = 3, 
    baseDelay: number = 1000
  ): Promise<ExaResult[]> {
    return this.makeRequest<ExaSearchResponse>('/search', {
       method: 'POST',
       body: JSON.stringify({
         query: options.query,
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
         contents: {
           text: options.includeText !== false,
           highlights: options.includeHighlights !== false,
           summary: options.includeSummary || false
         }
       })
     }, {
       maxRetries,
       baseDelay: baseDelay
     }).then(response => {
       if (!response.success || !response.data) {
         throw new Error(response.error || 'Exa search failed')
       }
       // EXA API returns { results: ExaResult[] }, so we need to extract the results array
       const validatedData = ExaSearchResponseSchema.parse(response.data)
       return validatedData.results
     })
  }

  // Convert ExaResult to Literature format
  convertToLiterature(exaResult: ExaResult, index: number): Literature {
    return {
      id: index,
      title: exaResult.title,
      authors: exaResult.author ? [exaResult.author] : [],
      journal: this.extractJournalFromUrl(exaResult.url),
      year: this.extractYearFromDate(exaResult.publishedDate),
      doi: exaResult.doi || '',
      verified: false,
      abstract: exaResult.text,
      citationCount: 0,
      impactFactor: 0
    }
  }

  private extractJournalFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '').replace('.com', '').replace('.org', '')
    } catch {
      return 'Unknown Journal'
    }
  }

  private extractYearFromDate(publishedDate?: string): number {
    if (!publishedDate) return new Date().getFullYear()
    
    try {
      return new Date(publishedDate).getFullYear()
    } catch {
      return new Date().getFullYear()
    }
  }
}

export const exaService = new ExaService()