import { z } from "zod"

const SentenceSplitResponseSchema = z.object({
  sentences: z.array(z.string())
})

type SentenceSplitResponse = z.infer<typeof SentenceSplitResponseSchema>

export class SentenceSplitService {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ""
    this.baseUrl = "https://openrouter.ai/api/v1"
    this.model = "openai/gpt-4o"
  }

  async splitIntoSentences(text: string): Promise<string[]> {
    if (!this.apiKey) {
      console.warn("OpenRouter API key not found, falling back to programmatic splitting")
      return this.fallbackSplit(text)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://literature-tracing-tool.vercel.app",
          "X-Title": "Literature Tracing Tool"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: `You are a text processing assistant specialized in sentence segmentation. Your task is to split the given text into individual sentences with high accuracy.

Rules:
1. Split text into complete, meaningful sentences
2. Handle Chinese and English punctuation correctly (。！？.!?)
3. Preserve sentence boundaries even with abbreviations, numbers, or special formatting
4. Do not split at semicolons (;；) unless they clearly separate independent sentences
5. Handle quotations and parentheses appropriately
6. Return only complete sentences, filter out fragments shorter than 5 characters
7. Maintain original sentence meaning and context

Return the result as a JSON object with a "sentences" array containing the split sentences.`
            },
            {
              role: "user",
              content: `Please split the following text into sentences:\n\n${text}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`)
        return this.fallbackSplit(text)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error("No content in OpenRouter API response")
        return this.fallbackSplit(text)
      }

      const parsed = JSON.parse(content)
      const validated = SentenceSplitResponseSchema.parse(parsed)
      
      // Filter out very short sentences and clean up
      const sentences = validated.sentences
        .map(s => s.trim())
        .filter(s => s.length >= 5)

      if (sentences.length === 0) {
        console.warn("AI sentence splitting returned no valid sentences, using fallback")
        return this.fallbackSplit(text)
      }

      console.log(`AI sentence splitting successful: ${sentences.length} sentences`)
      return sentences

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("AI sentence splitting timed out, using fallback")
      } else {
        console.error("AI sentence splitting failed:", error)
      }
      return this.fallbackSplit(text)
    }
  }

  private fallbackSplit(text: string): string[] {
    // Fallback to programmatic splitting (improved version of current logic)
    const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
    
    // More sophisticated regex that handles common edge cases
    const matches = normalized.match(/[^。.!?！？]+[。.!?！？]?/g)
    if (!matches) return []

    return matches
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        // Clean up trailing punctuation while preserving sentence structure
        return s.replace(/[;；\n]+$/, '').trim() || s
      })
      .filter(s => s.length >= 5) // Filter out very short segments
  }
}

export const sentenceSplitService = new SentenceSplitService()