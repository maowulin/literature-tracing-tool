import { z } from "zod"

const SentenceSplitResponseSchema = z.object({
  sentences: z.array(z.string())
})

type SentenceSplitResponse = z.infer<typeof SentenceSplitResponseSchema>

// Enhanced analysis schema
const AnalyzeSplitResponseSchema = z.object({
  language: z.enum(["zh", "en", "other"]).optional(),
  intent: z.string(),
  keywords: z.array(z.string()).default([]),
  originalSentences: z.array(z.string()),
  englishSentences: z.array(z.string()).optional()
})

type AnalyzeSplitResponse = z.infer<typeof AnalyzeSplitResponseSchema>

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

  // New API: analyze intent + split + optional English translation
  async analyzeAndSplit(text: string): Promise<AnalyzeSplitResponse> {
    if (!this.apiKey) {
      console.warn("OpenRouter API key not found, using fallback analyzeAndSplit")
      const originalSentences = this.fallbackSplit(text)
      const language = this.detectLanguage(text)
      const keywords = this.simpleExtractKeywords(text)
      const intent = this.simpleInferIntent(text, keywords)
      return { language, intent, keywords, originalSentences }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

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
              content: `You are a research assistant.
Tasks:
1) Understand the user's text intent and extract 5-12 concise domain keywords.
2) Detect the language (zh/en/other).
3) Split the original text into meaningful sentences considering semantics.
4) If language is not English, translate each original sentence into English, keeping 1:1 alignment.

Return strictly a JSON object with keys: language (zh|en|other), intent (string), keywords (string[]), originalSentences (string[]), englishSentences (string[] optional).`
            },
            {
              role: "user",
              content: `Text: ${text}`
            }
          ],
          max_tokens: 1800,
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`)
        const originalSentences = this.fallbackSplit(text)
        const language = this.detectLanguage(text)
        const keywords = this.simpleExtractKeywords(text)
        const intent = this.simpleInferIntent(text, keywords)
        return { language, intent, keywords, originalSentences }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        console.error("No content in OpenRouter API response for analyzeAndSplit")
        const originalSentences = this.fallbackSplit(text)
        const language = this.detectLanguage(text)
        const keywords = this.simpleExtractKeywords(text)
        const intent = this.simpleInferIntent(text, keywords)
        return { language, intent, keywords, originalSentences }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        console.error("Failed to parse analyzeAndSplit content, using fallback")
        const originalSentences = this.fallbackSplit(text)
        const language = this.detectLanguage(text)
        const keywords = this.simpleExtractKeywords(text)
        const intent = this.simpleInferIntent(text, keywords)
        return { language, intent, keywords, originalSentences }
      }

      const validated = AnalyzeSplitResponseSchema.parse(parsed)
      const originalSentences = validated.originalSentences.map(s => s.trim()).filter(s => s.length > 0)
      const englishSentences = validated.englishSentences?.map(s => s.trim()).filter(s => s.length > 0)
      const language = validated.language || this.detectLanguage(text)

      console.log("AnalyzeAndSplit successful:", {
        originalCount: originalSentences.length,
        englishCount: englishSentences?.length || 0,
        language,
      })

      return {
        language,
        intent: validated.intent,
        keywords: Array.from(new Set(validated.keywords)).slice(0, 16),
        originalSentences,
        englishSentences,
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("analyzeAndSplit timed out, using fallback")
      } else {
        console.error("analyzeAndSplit failed:", error)
      }
      const originalSentences = this.fallbackSplit(text)
      const language = this.detectLanguage(text)
      const keywords = this.simpleExtractKeywords(text)
      const intent = this.simpleInferIntent(text, keywords)
      return { language, intent, keywords, originalSentences }
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
      .filter(s => s.length >= 2) // Filter out very short segments (reduced from 5 to 2)
  }

  private detectLanguage(text: string): 'zh' | 'en' | 'other' {
    const hasChinese = /[\u4e00-\u9fff]/.test(text)
    const hasLatin = /[A-Za-z]/.test(text)
    if (hasChinese && !hasLatin) return 'zh'
    if (!hasChinese && hasLatin) return 'en'
    return 'other'
  }

  private simpleExtractKeywords(text: string): string[] {
    const zhWords = (text.match(/[\u4e00-\u9fff]{2,6}/g) || []).slice(0, 20)
    const enWords = (text.match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase())
    const stop = new Set(['the','and','for','with','that','this','from','are','was','were','you','your','has','have','had'])
    const filtered = enWords.filter(w => !stop.has(w))
    return Array.from(new Set([...zhWords, ...filtered])).slice(0, 16)
  }

  private simpleInferIntent(text: string, keywords: string[]): string {
    const prefix = this.detectLanguage(text) === 'zh' ? '研究目标/问题' : 'Research goal/problem'
    return `${prefix}: ${keywords.slice(0, 6).join(', ')}`
  }
}

export const sentenceSplitService = new SentenceSplitService()