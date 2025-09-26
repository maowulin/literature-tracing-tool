import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ExaService, type ExaResult } from "@/lib/exaService"

// Define types matching frontend interface
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
type SearchRequest = z.infer<typeof SearchRequestSchema>

// Mock data for initial testing
const mockLiteratureData: Literature[] = [
  {
    id: 1,
    title: "Longitudinal changes in uterine artery Doppler and blood pressure and risk of pre-eclampsia",
    authors: ["A. Khalil", "R. Garcia-Mandujano", "N. Maiz", "and 5 other authors"],
    journal: "Ultrasound in Obstetrics & Gynecology",
    year: 2014,
    doi: "10.1002/uog.13257",
    verified: true,
    supportingPages: 2,
    impactFactor: 6.194,
    citationCount: 342,
    abstract: "Background: Uterine artery Doppler screening is used to identify pregnancies at risk of pre-eclampsia. This study aimed to investigate longitudinal changes in uterine artery pulsatility index (PI) and mean arterial pressure (MAP) throughout pregnancy and their association with the development of pre-eclampsia.",
  },
  {
    id: 2,
    title: "Machine learning algorithms for early disease detection: A systematic review",
    authors: ["R. Singh", "M. Wang", "L. Garcia", "and 6 other authors"],
    journal: "The Lancet Digital Health",
    year: 2022,
    doi: "10.1016/S2589-7500(22)00089-3",
    verified: true,
    impactFactor: 36.615,
    citationCount: 892,
    abstract: "Early disease detection is crucial for improving patient outcomes and reducing healthcare costs. This systematic review evaluates machine learning algorithms used for early detection across various diseases including cancer, cardiovascular disease, and neurological disorders.",
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedRequest = SearchRequestSchema.parse(body)
    
    // Split text into sentences
    const splitIntoSentences = (text: string): string[] => {
      const matches = text.match(/[^。.!?！？;；\n]+[。.!?！？;；]?/g)
      if (!matches) return []
      return matches.map((s) => s.trim()).filter((s) => s.length > 0)
    }
    
    const sentences = splitIntoSentences(validatedRequest.text)
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
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
    
    // Validate response
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