import { z } from 'zod'

// Literature evaluation result schema
const LiteratureEvaluationSchema = z.object({
  relevanceScore: z.number().min(0).max(10),
  credibilityScore: z.number().min(0).max(10),
  impactScore: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  reasoning: z.string(),
  strengths: z.array(z.string()),
  limitations: z.array(z.string())
})

export type LiteratureEvaluation = z.infer<typeof LiteratureEvaluationSchema>

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
}

export class EvaluationService {
  private apiKey: string
  private baseUrl = 'https://openrouter.ai/api/v1'
  private model = 'openai/gpt-4o' // Using stable GPT-4o model

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required')
    }
  }

  async evaluateLiterature(request: EvaluationRequest): Promise<LiteratureEvaluation> {
    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Literature Tracing Tool'
        },
        body: JSON.stringify({
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
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText)
        
        // Return fallback evaluation instead of throwing error
        return this.getFallbackEvaluation(request)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('No content received from OpenRouter API')
        return this.getFallbackEvaluation(request)
      }

      // Try to parse the JSON response
      try {
        const evaluation = JSON.parse(content)
        return LiteratureEvaluationSchema.parse(evaluation)
      } catch (parseError) {
        console.error('Failed to parse evaluation JSON:', parseError)
        return this.getFallbackEvaluation(request)
      }

    } catch (error) {
      console.error('Literature evaluation failed:', error)
      // Return fallback evaluation on error (including timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Evaluation request timed out')
      }
      return this.getFallbackEvaluation(request)
    }
  }

  private getFallbackEvaluation(request: EvaluationRequest): LiteratureEvaluation {
    // Generate basic evaluation based on available metadata
    const currentYear = new Date().getFullYear()
    const yearScore = Math.max(0, 10 - (currentYear - request.year) * 0.5)
    const citationScore = request.citationCount ? Math.min(10, Math.log10(request.citationCount + 1) * 2) : 5
    const impactScore = request.impactFactor ? Math.min(10, request.impactFactor * 2) : 5
    
    return {
      relevanceScore: 7, // Default moderate relevance
      credibilityScore: Math.round((yearScore + citationScore) / 2),
      impactScore: Math.round(impactScore),
      overallScore: Math.round((7 + citationScore + impactScore) / 3),
      reasoning: "基于文献元数据的基础评估（AI评估服务暂时不可用）",
      strengths: [
        "来自知名期刊",
        "具有学术价值"
      ],
      limitations: [
        "需要进一步验证相关性",
        "评估基于有限的元数据信息"
      ]
    }
  }

  async evaluateMultipleLiterature(
    query: string,
    literatureList: Array<Omit<EvaluationRequest, 'query'>>
  ): Promise<LiteratureEvaluation[]> {
    const evaluationPromises = literatureList.map(literature =>
      this.evaluateLiterature({ query, ...literature })
    )

    try {
      return await Promise.all(evaluationPromises)
    } catch (error) {
      console.error('Batch literature evaluation failed:', error)
      // Return default evaluations for all literature
      return literatureList.map(() => this.getDefaultEvaluation())
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert academic literature evaluator. Evaluate the relevance and quality of academic papers based on the given query and paper details. 

Respond with a JSON object containing:
- relevanceScore: number (0-10, how relevant is this paper to the query)
- credibilityScore: number (0-10, based on journal reputation, citation count, etc.)
- impactScore: number (0-10, based on citation count and impact factor)
- overallScore: number (0-10, overall quality score)
- reasoning: string (brief explanation of the evaluation)
- strengths: array of strings (key strengths of the paper)
- limitations: array of strings (potential limitations and methodological concerns)

Be objective and consider factors like journal reputation, citation count, impact factor, and relevance to the query.`
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `
Please evaluate the following academic paper for its relevance and quality based on the user's query.

**User Query:** "${request.query}"

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
1. **Relevance Score (0-10):** How well does this paper address the user's query?
2. **Credibility Score (0-10):** Based on journal reputation, citation count, and author credentials
3. **Impact Score (0-10):** Based on citation count, impact factor, and potential influence
4. **Overall Score (0-10):** Weighted average considering all factors

Please provide your evaluation in the following JSON format:
{
  "relevanceScore": <number 0-10>,
  "credibilityScore": <number 0-10>,
  "impactScore": <number 0-10>,
  "overallScore": <number 0-10>,
  "reasoning": "<brief explanation of the evaluation>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "limitations": ["<limitation 1>", "<limitation 2>"]
}

Focus on objective assessment based on the available information. If information is missing, note it in the reasoning.
`
  }

  private getDefaultEvaluation(): LiteratureEvaluation {
    return {
      relevanceScore: 5,
      credibilityScore: 5,
      impactScore: 5,
      overallScore: 5,
      reasoning: "默认评估（评估服务不可用）",
      strengths: ["学术文献"],
      limitations: ["需要人工评估"]
    }
  }
}

export const evaluationService = new EvaluationService()