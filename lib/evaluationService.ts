import { z } from 'zod'
import { BaseService } from './base/BaseService'
import { LiteratureEvaluation } from './types'

// Literature evaluation result schema
const LiteratureEvaluationSchema = z.object({
  relevance: z.object({
    score: z.number().min(0).max(10),
    reason: z.string()
  }),
  credibility: z.object({
    score: z.number().min(0).max(10),
    reason: z.string()
  }),
  impact: z.object({
    score: z.number().min(0).max(10),
    reason: z.string()
  }),
  advantages: z.array(z.string()),
  limitations: z.array(z.string())
})

interface EvaluationRequest {
  query: string
  title: string
  authors: string[]
  journal: string
  year: number
  abstract?: string
  doi?: string
  citationCount?: number
  impactFactor?: number
  // add context for better evaluation
  contextIntent?: string
  contextKeywords?: string[]
}

export class EvaluationService extends BaseService {
  private model = 'openai/gpt-4o'

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    super('https://openrouter.ai/api/v1', {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://literature-tracer.com',
      'X-Title': 'Literature Tracer'
    })
    
    console.log('EvaluationService constructor called')
    console.log('API Key from env:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND')
    
    if (!apiKey) {
      console.warn('OPENROUTER_API_KEY is missing from environment variables, will use fallback evaluations')
    }
  }

  async evaluateLiterature(request: EvaluationRequest): Promise<LiteratureEvaluation> {
    try {
      console.log('=== EVALUATION SERVICE CALLED ===')
      console.log('Starting literature evaluation for:', request.title)
      
      const apiKey = process.env.OPENROUTER_API_KEY || ''
      console.log('API Key available:', !!apiKey)
      console.log('API Key length:', apiKey.length)
      
      // Check if API key is available
      if (!apiKey) {
        console.log('No API key available, returning fallback evaluation')
        return this.getFallbackEvaluation(request)
      }
      
      // Add alert to make sure we can see this in browser
      if (typeof window !== 'undefined') {
        console.log('Running in browser context')
      } else {
        console.log('Running in server context')
      }
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt()
          },
          {
            role: 'user',
            content: this.buildEvaluationPrompt(request)
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      }

      console.log('Making API request to:', `${this.baseUrl}/chat/completions`)
      console.log('Request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Literature Tracing Tool'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('API Response status:', response.status)
      console.log('API Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText)
        
        // Return fallback evaluation instead of throwing error
        console.log('Returning fallback evaluation due to API error')
        return this.getFallbackEvaluation(request)
      }

      const data = await response.json()
      console.log('API Response data:', JSON.stringify(data, null, 2))
      
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('No content received from OpenRouter API')
        console.log('Returning fallback evaluation due to no content')
        return this.getFallbackEvaluation(request)
      }

      console.log('Raw AI response content:', content)

      // Try to parse the JSON response
      try {
        // Clean the content by removing markdown code blocks if present
        let cleanContent = content.trim()
        
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        if (cleanContent.startsWith('```')) {
          const lines = cleanContent.split('\n')
          // Remove first line (```json or ```)
          lines.shift()
          // Remove last line (```)
          if (lines[lines.length - 1].trim() === '```') {
            lines.pop()
          }
          cleanContent = lines.join('\n').trim()
        }
        
        console.log('Cleaned content for parsing:', cleanContent)
        
        const evaluation = JSON.parse(cleanContent)
        console.log('Parsed evaluation:', evaluation)
        
        const validatedEvaluation = LiteratureEvaluationSchema.parse(evaluation)
        return validatedEvaluation
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError)
        console.log('Returning fallback evaluation due to parse error')
        return this.getFallbackEvaluation(request)
      }
    } catch (error) {
      console.error('EvaluationService error:', error)
      console.log('Returning fallback evaluation due to unexpected error')
      return this.getFallbackEvaluation(request)
    }
  }

  private getFallbackEvaluation(request: EvaluationRequest): LiteratureEvaluation {
    // Simple heuristic fallback using available metadata
    const yearWeight = Math.max(0, (new Date().getFullYear() - (request.year || new Date().getFullYear())))
    const citationScore = Math.min(10, Math.max(0, (request.citationCount || 0) / 100))
    const impactScore = Math.min(10, Math.max(0, (request.impactFactor || 0) / 5))

    const relevanceScore = 6 // default moderate relevance
    const credibilityScore = Math.round((citationScore + impactScore) / 2)
    const impactFinalScore = Math.round((citationScore + impactScore) / 2)

    return {
      relevance: {
        score: relevanceScore,
        reason: 'Fallback evaluation based on limited metadata'
      },
      credibility: {
        score: credibilityScore,
        reason: 'Estimated credibility from citation and impact factor'
      },
      impact: {
        score: impactFinalScore,
        reason: 'Estimated impact from citation and impact factor'
      },
      advantages: ['Academic paper'],
      limitations: ['LLM evaluation unavailable']
    }
  }

  async evaluateMultipleLiterature(
    query: string,
    literatureList: Array<Omit<EvaluationRequest, 'query'>>
  ): Promise<LiteratureEvaluation[]> {
    const evaluationPromises = literatureList.map((lit) => {
      return this.evaluateLiterature({
        query,
        title: lit.title,
        authors: lit.authors,
        journal: lit.journal,
        year: lit.year,
        abstract: lit.abstract,
        doi: lit.doi,
        citationCount: lit.citationCount,
        impactFactor: lit.impactFactor,
        contextIntent: (lit as EvaluationRequest).contextIntent,
        contextKeywords: (lit as EvaluationRequest).contextKeywords,
      })
    })

    try {
      return await Promise.all(evaluationPromises)
    } catch (error) {
      console.error('Batch literature evaluation failed:', error)
      // Return default evaluations for all literature
      return literatureList.map(() => this.getDefaultEvaluation())
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert academic literature evaluator. Evaluate the relevance and quality of academic papers based on the given query and paper details. \n\nUtilize the provided context intent and keywords to better understand the user's underlying research aim and terminology. If context is missing, proceed with the query alone.\n\nRespond with a JSON object containing:\n- relevance: object with score (0-10) and reason (string explaining relevance to query)\n- credibility: object with score (0-10) and reason (string explaining credibility assessment)\n- impact: object with score (0-10) and reason (string explaining impact assessment)\n- advantages: array of strings (key strengths of the paper)\n- limitations: array of strings (potential limitations and methodological concerns)\n\nBe objective and consider factors like journal reputation, citation count, impact factor, and relevance to the query.`
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `
Please evaluate the following academic paper for its relevance and quality based on the user's query.

**User Query:** "${request.query}"

**Context Intent:** ${request.contextIntent ? request.contextIntent : 'Not provided'}
**Context Keywords:** ${request.contextKeywords && request.contextKeywords.length > 0 ? request.contextKeywords.join(', ') : 'Not provided'}

**Paper Information:**
- Title: ${request.title}
- Authors: ${request.authors.join(', ')}
- Journal: ${request.journal}
- Year: ${request.year}
- DOI: ${request.doi || 'Not available'}
- Citation Count: ${request.citationCount || 'Not available'}
- Impact Factor: ${request.impactFactor || 'Not available'}
- Abstract: ${request.abstract || 'Not available'}

**Evaluation Criteria:**
1. **Relevance:** How well does this paper address the user's query (consider intent and keywords if provided)?
2. **Credibility:** Based on journal reputation, citation count, and author credentials
3. **Impact:** Based on citation count, impact factor, and potential influence

Please provide your evaluation in the following JSON format:
{
  "relevance": {
    "score": <number 0-10>,
    "reason": "<explanation of relevance to the query>"
  },
  "credibility": {
    "score": <number 0-10>,
    "reason": "<explanation of credibility assessment>"
  },
  "impact": {
    "score": <number 0-10>,
    "reason": "<explanation of impact assessment>"
  },
  "advantages": ["<advantage 1>", "<advantage 2>"],
  "limitations": ["<limitation 1>", "<limitation 2>"]
}

Focus on objective assessment based on the available information. If information is missing, note it in the reasoning.
`
  }

  private getDefaultEvaluation(): LiteratureEvaluation {
    return {
      relevance: {
        score: 5,
        reason: "Default evaluation (evaluation service unavailable)"
      },
      credibility: {
        score: 5,
        reason: "Default credibility assessment"
      },
      impact: {
        score: 5,
        reason: "Default impact assessment"
      },
      advantages: ["Academic literature"],
      limitations: ["Requires manual evaluation"]
    }
  }
}

export const evaluationService = new EvaluationService()