import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const LiteratureSchema = z.object({
  id: z.number(),
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string(),
  year: z.number(),
  doi: z.string(),
  verified: z.boolean(),
  supportingPages: z.number().optional(),
  abstract: z.string().optional(),
  impactFactor: z.number().optional(),
  citationCount: z.number().optional(),
})

const SentenceResultSchema = z.object({
  sentence: z.string(),
  sentenceIndex: z.number(),
  literature: z.array(LiteratureSchema),
})

const SearchRequestSchema = z.object({
  text: z.string(),
})

const SearchResponseSchema = z.object({
  api1: z.array(SentenceResultSchema),
  api2: z.array(SentenceResultSchema),
})

type Literature = z.infer<typeof LiteratureSchema>
type SentenceResult = z.infer<typeof SentenceResultSchema>

// Mock literature data
const mockLiteratureData: Literature[] = [
  {
    id: 1,
    title: "Machine Learning Applications in Medical Diagnosis: A Comprehensive Review",
    authors: ["Zhang, L.", "Wang, M.", "Chen, X."],
    journal: "Nature Medicine",
    year: 2023,
    doi: "10.1038/s41591-023-02156-7",
    verified: true,
    supportingPages: 15,
    abstract: "This comprehensive review examines the current state and future prospects of machine learning applications in medical diagnosis, covering deep learning algorithms, clinical decision support systems, and their impact on healthcare outcomes.",
    impactFactor: 87.241,
    citationCount: 342
  },
  {
    id: 2,
    title: "Deep Learning for Automated Medical Image Analysis",
    authors: ["Liu, Y.", "Brown, J.", "Smith, K."],
    journal: "The Lancet Digital Health",
    year: 2023,
    doi: "10.1016/S2589-7500(23)00045-2",
    verified: true,
    supportingPages: 12,
    abstract: "We present a systematic analysis of deep learning approaches for automated medical image analysis, demonstrating significant improvements in diagnostic accuracy across multiple imaging modalities.",
    impactFactor: 23.317,
    citationCount: 189
  },
  {
    id: 3,
    title: "AI-Assisted Clinical Decision Making: Current Challenges and Future Directions",
    authors: ["Johnson, R.", "Davis, A.", "Wilson, P."],
    journal: "JAMA",
    year: 2022,
    doi: "10.1001/jama.2022.15234",
    verified: true,
    supportingPages: 8,
    abstract: "This article discusses the integration of artificial intelligence in clinical decision-making processes, highlighting current challenges and proposing future research directions.",
    impactFactor: 157.335,
    citationCount: 567
  },
  {
    id: 4,
    title: "Climate Change Impact on Species Distribution Patterns",
    authors: ["Anderson, M.", "Thompson, S.", "Garcia, R."],
    journal: "Science",
    year: 2023,
    doi: "10.1126/science.abcd1234",
    verified: true,
    supportingPages: 10,
    abstract: "Our study reveals significant shifts in species distribution patterns due to climate change, with implications for biodiversity conservation and ecosystem management.",
    impactFactor: 63.714,
    citationCount: 234
  },
  {
    id: 5,
    title: "Quantum Computing Applications in Optimization Problems",
    authors: ["Kumar, A.", "Lee, S.", "Patel, N."],
    journal: "Nature",
    year: 2023,
    doi: "10.1038/s41586-023-05678-9",
    verified: true,
    supportingPages: 7,
    abstract: "We demonstrate the potential of quantum computing algorithms to solve complex optimization problems with exponential speedup over classical approaches.",
    impactFactor: 69.504,
    citationCount: 156
  }
]

// Simple sentence splitting function
function simpleSentenceSplit(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  const matches = normalized.match(/[^。.!?！？]+[。.!?！？]?/g)
  
  if (!matches) return [text]
  
  return matches
    .map(s => s.trim())
    .filter(s => s.length >= 5)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedRequest = SearchRequestSchema.parse(body)
    
    // Simple sentence splitting without external API
    const sentences = simpleSentenceSplit(validatedRequest.text)
    
    if (sentences.length === 0) {
      return NextResponse.json({ api1: [], api2: [] })
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Generate mock results for each sentence
    const api1Results: SentenceResult[] = sentences.map((sentence, index) => ({
      sentence,
      sentenceIndex: index + 1,
      literature: mockLiteratureData.slice(0, Math.min(2, mockLiteratureData.length)),
    }))
    
    const api2Results: SentenceResult[] = sentences.map((sentence, index) => ({
      sentence,
      sentenceIndex: index + 1,
      literature: mockLiteratureData.slice(1, Math.min(3, mockLiteratureData.length)),
    }))
    
    const response = {
      api1: api1Results,
      api2: api2Results,
    }
    
    const validatedResponse = SearchResponseSchema.parse(response)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error("Search API error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}