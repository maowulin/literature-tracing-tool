import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ExaService, type ExaResult } from "@/lib/exaService"
import { CrossrefService } from "@/lib/crossrefService"
import { DeduplicationService } from "@/lib/deduplicationService"
import { evaluationService, type LiteratureEvaluation } from "@/lib/evaluationService"

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
  // Evaluation fields
  evaluation: z.object({
    relevanceScore: z.number().min(0).max(10),
    credibilityScore: z.number().min(0).max(10),
    impactScore: z.number().min(0).max(10),
    overallScore: z.number().min(0).max(10),
    reasoning: z.string(),
    strengths: z.array(z.string()),
    limitations: z.array(z.string())
  }).optional(),
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

export type Literature = z.infer<typeof LiteratureSchema>
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

// Helper function to convert Crossref results to Literature format
function convertCrossrefToLiterature(crossrefWork: any, id: number): Literature {
  const crossrefService = new CrossrefService()
  
  return {
    id,
    title: crossrefService.extractTitle(crossrefWork),
    authors: crossrefService.formatAuthors(crossrefWork.author),
    journal: crossrefService.extractJournal(crossrefWork),
    year: crossrefService.extractYear(crossrefWork),
    doi: crossrefWork.DOI || 'N/A',
    verified: true, // Crossref results are verified
    abstract: crossrefWork.abstract || undefined,
    citationCount: crossrefWork['is-referenced-by-count'] || undefined,
  }
}

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
    abstract: exaResult.text,
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
      // First normalize line breaks and multiple spaces
      const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
      
      // Split by sentence endings, semicolons, and line breaks, preserving the punctuation
      const matches = normalized.match(/[^。.!?！？;；\n]+[。.!?！？;；\n]?/g)
      if (!matches) return []
      
      return matches
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => {
          // Clean up trailing punctuation for better processing while preserving original
          return s.replace(/[;；\n]+$/, '').trim() || s
        })
        .filter((s) => s.length > 3) // Filter out very short segments
    }
    
    const sentences = splitIntoSentences(validatedRequest.text)
    
    // Initialize Exa service
    const exaApiKey = process.env.EXA_API_KEY
    if (!exaApiKey) {
      console.log("EXA_API_KEY not found, using mock data")
      return await fallbackToMockData(sentences)
    }

    if (sentences.length === 0) {
      return NextResponse.json({ api1: [], api2: [] })
    }

    // Initialize services
    const exaService = new ExaService(exaApiKey)
    const crossrefService = new CrossrefService()
    
    try {
      // Search with Exa for each sentence concurrently
      const exaResults = await exaService.searchMultipleQueries(sentences, {
        type: "neural",
        category: "research paper",
        numResults: 3,
        includeText: true,
        includeHighlights: true,
        includeSummary: true,
      })

      // Search with Crossref for each sentence using dual approach
      const crossrefPromises = sentences.map(async (sentence) => {
        try {
          // First approach: bibliographic search (general query)
          const bibliographicResults = await crossrefService.searchByBibliographic(sentence, 3)
          
          // Second approach: title-based search (extract potential titles from sentence)
          const titleResults = await crossrefService.searchByTitle(sentence, 2)
          
          // Combine and deduplicate results from both approaches
          const combinedResults = [...bibliographicResults, ...titleResults]
          const deduplicatedResults = DeduplicationService.deduplicate(
            combinedResults.map((work, index) => convertCrossrefToLiterature(work, index))
          )
          
          // Return top 3 results after deduplication
          return deduplicatedResults.slice(0, 3)
        } catch (error) {
          console.error(`Crossref dual search failed for sentence: "${sentence}"`, error)
          return []
        }
      })
      const crossrefResults = await Promise.all(crossrefPromises)

      // Convert Exa results to our Literature format for API 1
      let literatureId = 1
      const api1Results: SentenceResult[] = await Promise.all(
        sentences.map(async (sentence, index) => {
          const exaResultsForSentence = exaResults[index] || []
          const literature = exaResultsForSentence
            .slice(0, 3) // Take first 3 results before deduplication
            .map(exaResult => convertExaResultToLiterature(exaResult, literatureId++))
          
          // Apply deduplication and sorting
          const deduplicatedLiterature = DeduplicationService.sortByRelevanceAndQuality(
            DeduplicationService.deduplicate(literature)
          ).slice(0, 2) // Keep top 2 after deduplication
          
          // Add GPT-5 evaluation for each literature item
           const evaluatedLiterature = await Promise.all(
             deduplicatedLiterature.map(async (lit) => {
               try {
                 const evaluationRequest = {
                   query: sentence,
                   title: lit.title,
                   authors: lit.authors,
                   journal: lit.journal,
                   year: lit.year,
                   abstract: lit.abstract,
                   doi: lit.doi,
                   citationCount: lit.citationCount,
                   impactFactor: lit.impactFactor
                 }
                 const evaluation = await evaluationService.evaluateLiterature(evaluationRequest)
                 return { ...lit, evaluation }
               } catch (error) {
                 console.error(`Evaluation failed for literature ${lit.id}:`, error)
                 return lit // Return without evaluation if it fails
               }
             })
           )
          
          return {
            sentence,
            sentenceIndex: index + 1,
            literature: evaluatedLiterature,
          }
        })
      )

      // Convert Crossref results to our Literature format for API 2
      const api2Results: SentenceResult[] = await Promise.all(
        sentences.map(async (sentence, index) => {
          const crossrefResultsForSentence = crossrefResults[index] || []
          // Results are already converted and deduplicated in the search phase
          const literature = crossrefResultsForSentence
          
          // Apply final sorting for Crossref results
          const sortedLiterature = DeduplicationService.sortByRelevanceAndQuality(literature)
          
          // Add GPT-5 evaluation for each literature item
           const evaluatedLiterature = await Promise.all(
             sortedLiterature.map(async (lit) => {
               try {
                 const evaluationRequest = {
                   query: sentence,
                   title: lit.title,
                   authors: lit.authors,
                   journal: lit.journal,
                   year: lit.year,
                   abstract: lit.abstract,
                   doi: lit.doi,
                   citationCount: lit.citationCount,
                   impactFactor: lit.impactFactor
                 }
                 const evaluation = await evaluationService.evaluateLiterature(evaluationRequest)
                 return { ...lit, evaluation }
               } catch (error) {
                 console.error(`Evaluation failed for literature ${lit.id}:`, error)
                 return lit // Return without evaluation if it fails
               }
             })
           )
          
          return {
            sentence,
            sentenceIndex: index + 1,
            literature: evaluatedLiterature,
          }
        })
      )

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