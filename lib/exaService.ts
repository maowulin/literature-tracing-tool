import { z } from "zod"

// Exa API response types
const ExaResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  summary: z.string().optional(),
})

const ExaSearchResponseSchema = z.object({
  results: z.array(ExaResultSchema),
  requestId: z.string(),
})

type ExaResult = z.infer<typeof ExaResultSchema>
type ExaSearchResponse = z.infer<typeof ExaSearchResponseSchema>

// Exa search options
interface ExaSearchOptions {
  type?: "neural" | "keyword" | "auto"
  category?: "research_paper" | "news_article" | "company" | "pdf"
  numResults?: number
  useAutoprompt?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
  startPublishedDate?: string
  endPublishedDate?: string
  text?: {
    includeHtmlTags?: boolean
    maxCharacters?: number
  }
  highlights?: {
    query?: string
    numSentences?: number
    highlightsPerUrl?: number
  }
  summary?: {
    query?: string
  }
}

class ExaService {
  private apiKey: string
  private baseUrl = "https://api.exa.ai"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string, options: ExaSearchOptions = {}): Promise<ExaResult[]> {
    const defaultOptions: ExaSearchOptions = {
      type: "neural",
      category: "research_paper",
      numResults: 10,
      useAutoprompt: true,
      text: {
        maxCharacters: 1000,
      },
      highlights: {
        numSentences: 2,
        highlightsPerUrl: 3,
      },
      summary: {
        query: "What is the main contribution and findings of this research?",
      },
    }

    const searchOptions = { ...defaultOptions, ...options }

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          ...searchOptions,
        }),
      })

      if (!response.ok) {
        throw new Error(`Exa API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const validatedData = ExaSearchResponseSchema.parse(data)
      
      return validatedData.results
    } catch (error) {
      console.error("Exa search failed:", error)
      throw error
    }
  }

  async searchMultipleQueries(queries: string[], options: ExaSearchOptions = {}): Promise<ExaResult[][]> {
    const searchPromises = queries.map(query => 
      this.search(query, options).catch(error => {
        console.error(`Search failed for query "${query}":`, error)
        return [] // Return empty array on failure
      })
    )

    return Promise.all(searchPromises)
  }

  // Retry mechanism with exponential backoff
  async searchWithRetry(
    query: string, 
    options: ExaSearchOptions = {}, 
    maxRetries = 3
  ): Promise<ExaResult[]> {
    let lastError: Error

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.search(query, options)
      } catch (error) {
        lastError = error as Error
        
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.log(`Exa search attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }
}

export { ExaService, type ExaResult, type ExaSearchOptions }