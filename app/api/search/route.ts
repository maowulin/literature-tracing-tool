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

// Helper function to convert Exa results to Literature format
function convertExaResultToLiterature(exaResult: ExaResult, id: number): Literature {
  // Extract year from publishedDate if available
  const year = exaResult.publishedDate 
    ? new Date(exaResult.publishedDate).getFullYear() 
    : new Date().getFullYear()

  // Extract authors from author field or use placeholder
  const authors = exaResult.author 
    ? [exaResult.author] 
    : ["Unknown Author"]

  // Extract DOI from URL if it's a DOI link, otherwise use URL
  const doi = exaResult.url.includes("doi.org") 
    ? exaResult.url.replace("https://doi.org/", "")
    : exaResult.url

  // Extract journal name from URL or use placeholder
  const journal = extractJournalFromUrl(exaResult.url)

  return {
    id,
    title: exaResult.title,
    authors,
    journal,
    year,
    doi,
    verified: false, // Exa results are not Crossref verified yet
    abstract: exaResult.text || exaResult.summary,
    supportingPages: exaResult.highlights?.length || 1,
  }
}

// Helper function to extract journal name from URL
function extractJournalFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    
    // Common academic domains
    if (hostname.includes("arxiv.org")) return "arXiv"
    if (hostname.includes("pubmed.ncbi.nlm.nih.gov")) return "PubMed"
    if (hostname.includes("nature.com")) return "Nature"
    if (hostname.includes("science.org")) return "Science"
    if (hostname.includes("cell.com")) return "Cell"
    if (hostname.includes("nejm.org")) return "New England Journal of Medicine"
    if (hostname.includes("thelancet.com")) return "The Lancet"
    if (hostname.includes("bmj.com")) return "BMJ"
    if (hostname.includes("springer.com")) return "Springer"
    if (hostname.includes("wiley.com")) return "Wiley"
    if (hostname.includes("elsevier.com")) return "Elsevier"
    if (hostname.includes("ieee.org")) return "IEEE"
    if (hostname.includes("acm.org")) return "ACM"
    
    // Default to hostname without www
    return hostname.replace("www.", "")
  } catch {
    return "Unknown Journal"
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedRequest = SearchRequestSchema.parse(body)
    
    // Split text into sentences
    const splitIntoSentences = (text: string): string[] => {
      const matches = text.match(/[^。.!?！？;；\n]+[。.!?！？;；]?/g)
      if (!matches) return []
      return matches.map((s) => s.trim()).filter((s) => s.length > 0)
    }
    
    const sentences = splitIntoSentences(validatedRequest.text)
    
    // Initialize Exa service
    const exaApiKey = process.env.EXA_API_KEY
    if (!exaApiKey) {
      console.warn("EXA_API_KEY not found, falling back to mock data")
      return await fallbackToMockData(sentences)
    }

    const exaService = new ExaService(exaApiKey)
    
    try {
      // Search with Exa for each sentence concurrently
      const exaResults = await exaService.searchMultipleQueries(sentences, {
        type: "neural",
        category: "research_paper",
        numResults: 3,
        text: { maxCharacters: 500 },
        highlights: { numSentences: 2 },
        summary: { query: "What is the main contribution and findings?" },
      })

      // Convert Exa results to our Literature format
      let literatureId = 1
      const api1Results: SentenceResult[] = sentences.map((sentence, index) => {
        const exaResultsForSentence = exaResults[index] || []
        const literature = exaResultsForSentence
          .slice(0, 2) // Take first 2 results for API 1
          .map(exaResult => convertExaResultToLiterature(exaResult, literatureId++))
        
        return {
          sentence,
          sentenceIndex: index + 1,
          literature,
        }
      })

      const api2Results: SentenceResult[] = sentences.map((sentence, index) => {
        const exaResultsForSentence = exaResults[index] || []
        const literature = exaResultsForSentence
          .slice(1, 3) // Take results 2-3 for API 2 (different subset)
          .map(exaResult => convertExaResultToLiterature(exaResult, literatureId++))
        
        return {
          sentence,
          sentenceIndex: index + 1,
          literature,
        }
      })

      const response = {
        api1: api1Results,
        api2: api2Results,
      }

      const validatedResponse = SearchResponseSchema.parse(response)
      return NextResponse.json(validatedResponse)

    } catch (exaError) {
      console.error("Exa search failed, falling back to mock data:", exaError)
      return await fallbackToMockData(sentences)
    }

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

// Fallback function for mock data
async function fallbackToMockData(sentences: string[]) {
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
  
  const validatedResponse = SearchResponseSchema.parse(response)
  return NextResponse.json(validatedResponse)
}