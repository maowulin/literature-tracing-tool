import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ExaService, type ExaResult } from "@/lib/exaService";
import { CrossrefService } from "@/lib/crossrefService";
import { DeduplicationService } from "@/lib/deduplicationService";
import { evaluationService } from "@/lib/evaluationService";
import { LiteratureEvaluation } from "@/lib/types";
import { sentenceSplitService } from "@/lib/sentenceSplitService";

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
  evaluation: z
    .object({
      relevance: z.object({
        score: z.number().min(0).max(10),
        reason: z.string(),
      }),
      credibility: z.object({
        score: z.number().min(0).max(10),
        reason: z.string(),
      }),
      impact: z.object({
        score: z.number().min(0).max(10),
        reason: z.string(),
      }),
      advantages: z.array(z.string()),
      limitations: z.array(z.string()),
    })
    .optional(),
  // Server-side highlights
  highlightedTitle: z.string().optional(),
  highlightedAbstract: z.string().optional(),
});

const SentenceResultSchema = z.object({
  sentence: z.string(),
  sentenceIndex: z.number(),
  literature: z.array(LiteratureSchema),
});

const SearchRequestSchema = z.object({
  text: z.string(),
});

const SearchResponseSchema = z.object({
  results: z.array(SentenceResultSchema),
});

export type Literature = z.infer<typeof LiteratureSchema>;
type SentenceResult = z.infer<typeof SentenceResultSchema>;
type SearchRequest = z.infer<typeof SearchRequestSchema>;

// Helper function to convert Crossref results to Literature format
function convertCrossrefToLiterature(
  crossrefWork: any,
  id: number,
  query: string
): Literature {
  const crossrefService = new CrossrefService();
  const title = crossrefService.extractTitle(crossrefWork);
  const abstract = crossrefWork.abstract || undefined;
  return {
    id,
    title,
    authors: crossrefService.formatAuthors(crossrefWork.author),
    journal: crossrefService.extractJournal(crossrefWork),
    year: crossrefService.extractYear(crossrefWork),
    doi: crossrefWork.DOI || "N/A",
    verified: true,
    abstract,
    citationCount: crossrefWork["is-referenced-by-count"] || undefined,
    highlightedTitle: wrapMarksByQuery(query, title),
    highlightedAbstract: wrapMarksByQuery(query, abstract),
  };
}

// Helper function to convert Exa results to Literature format
function convertExaResultToLiterature(
  exaResult: ExaResult,
  id: number,
  query: string
): Literature {
  // Extract year from publishedDate if available
  const year = exaResult.publishedDate
    ? new Date(exaResult.publishedDate).getFullYear()
    : new Date().getFullYear();

  // Extract authors from author field, try to parse multiple authors, or use placeholder
  let authors: string[] = ["Unknown Author"];
  
  if (exaResult.author && exaResult.author.trim()) {
    // Try to split multiple authors by common separators
    const authorStr = exaResult.author.trim();
    if (authorStr.includes(',') || authorStr.includes(';') || authorStr.includes(' and ')) {
      // Split by common author separators and clean up
      authors = authorStr
        .split(/[,;]|\s+and\s+/i)
        .map(author => author.trim())
        .filter(author => author.length > 0 && !author.match(/^\d+$/)); // Remove empty strings and standalone numbers
    } else {
      authors = [authorStr];
    }
  }

  // Debug log for author processing
  console.log(`Converting Exa result ${id}:`, {
    title: exaResult.title.substring(0, 50) + "...",
    originalAuthor: exaResult.author,
    processedAuthors: authors,
    hasAuthor: !!exaResult.author
  });

  // Extract DOI from URL if it's a DOI link, otherwise use URL
  const doi = exaResult.url.includes("doi.org")
    ? exaResult.url.replace("https://doi.org/", "")
    : exaResult.url;

  // Extract journal name from URL or use placeholder
  const journal = extractJournalFromUrl(exaResult.url);

  // Use real abstract text from Exa API (not mock)
  const abstractText: string | undefined = exaResult.text;

  return {
    id,
    title: exaResult.title,
    authors,
    journal,
    year,
    doi,
    verified: false, // Exa results are not Crossref verified yet
    abstract: abstractText,
    supportingPages: exaResult.highlights?.length || 1,
    highlightedTitle: wrapMarksByQuery(query, exaResult.title),
    highlightedAbstract:
      wrapMarksByHighlights(abstractText, exaResult.highlights) ||
      wrapMarksByQuery(query, abstractText),
  };
}

// Helper function to extract journal name from URL
function extractJournalFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;

    // Common academic domains
    if (hostname.includes("arxiv.org")) return "arXiv";
    if (hostname.includes("pubmed.ncbi.nlm.nih.gov")) return "PubMed";
    if (hostname.includes("nature.com")) return "Nature";
    if (hostname.includes("science.org")) return "Science";
    if (hostname.includes("cell.com")) return "Cell";
    if (hostname.includes("nejm.org")) return "New England Journal of Medicine";
    if (hostname.includes("thelancet.com")) return "The Lancet";
    if (hostname.includes("bmj.com")) return "BMJ";
    if (hostname.includes("springer.com")) return "Springer";
    if (hostname.includes("wiley.com")) return "Wiley";
    if (hostname.includes("elsevier.com")) return "Elsevier";
    if (hostname.includes("ieee.org")) return "IEEE";
    if (hostname.includes("acm.org")) return "ACM";

    // Default to hostname without www
    return hostname.replace("www.", "");
  } catch {
    return "Unknown Journal";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedRequest = SearchRequestSchema.parse(body);

    // Use AI-powered sentence splitting
    const sentences = await sentenceSplitService.splitIntoSentences(
      validatedRequest.text
    );

    // Initialize Exa service
    const exaApiKey = process.env.EXA_API_KEY;
    if (!exaApiKey) {
      return NextResponse.json(
        {
          error:
            "EXA_API_KEY is not configured. Please set up the API key to use the search functionality.",
        },
        { status: 500 }
      );
    }

    if (sentences.length === 0) {
      return NextResponse.json({ api1: [], api2: [] });
    }

    // Initialize services
    const exaService = new ExaService();
    const crossrefService = new CrossrefService();

    try {
      // Step 1: Search with Exa for each sentence
      const exaResults = await exaService.searchMultipleQueries(sentences, {
        type: "auto",
        category: "research paper",
        text: true,
      });

      console.log("EXA search completed:", {
        sentencesCount: sentences.length,
        exaResultsCount: exaResults.length,
        exaResults: exaResults.map((results, index) => ({
          sentenceIndex: index,
          sentence: sentences[index],
          resultCount: results.length,
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
          })),
        })),
      });

      if (exaResults.length !== sentences.length) {
        console.warn(
          "Warning: Mismatch between number of sentences and Exa search results."
        );
      }

      // Step 2: Convert Exa results and apply LLM evaluation for filtering
      let literatureId = 1;
      const evaluatedExaResults = await Promise.all(
        sentences.map(async (sentence, index) => {
          const exaResultsForSentence = exaResults[index] || [];
          const literature = exaResultsForSentence.map((exaResult) =>
            convertExaResultToLiterature(exaResult, literatureId++, sentence)
          );

          // Apply deduplication first
          const deduplicatedLiterature =
            DeduplicationService.deduplicate(literature);

          // Step 2.1: LLM evaluation for quality filtering
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
                  impactFactor: lit.impactFactor,
                };
                const evaluation = await evaluationService.evaluateLiterature(
                  evaluationRequest
                );
                return { ...lit, evaluation };
              } catch (error) {
                console.error(
                  `Evaluation failed for literature ${lit.id}:`,
                  error
                );
                return lit; // Return without evaluation if it fails
              }
            })
          );

          // Step 2.2: Filter by quality scores (keep high-quality papers)
          // Sort by quality without filtering - keep all literature
          const sortedLiterature =
            DeduplicationService.sortByRelevanceAndQuality(
              evaluatedLiterature
            );

          return {
            sentence,
            index,
            literature: sortedLiterature, // Return all literature sorted by quality
          };
        })
      );

      // Step 3: Use Crossref to enhance Exa results with missing metadata
      const enhancedExaResults = await Promise.all(
        evaluatedExaResults.map(async ({ sentence, index, literature }) => {
          try {
            console.log(`Crossref metadata enhancement for sentence ${index + 1}:`, {
              sentence: sentence.substring(0, 50) + "...",
              literatureCount: literature.length,
            });

            // Enhance each literature item with Crossref metadata if needed
            const enhancedLiterature = await Promise.all(
              literature.map(async (lit) => {
                // Check if literature has missing critical metadata
                const needsEnhancement =
                  (!lit.authors.length || lit.authors.includes("Unknown Author")) ||
                  !lit.journal ||
                  lit.journal === "Unknown" ||
                  !lit.doi ||
                  !lit.abstract;

                if (!needsEnhancement) {
                  console.log(`Literature ${lit.id} has complete metadata, skipping enhancement`);
                  return lit;
                }

                console.log(`Enhancing literature ${lit.id} with missing metadata:`, {
                  title: lit.title.substring(0, 50) + "...",
                  missingAuthors: !lit.authors.length || lit.authors.includes("Unknown Author"),
                  missingJournal: !lit.journal || lit.journal === "Unknown",
                  missingDoi: !lit.doi,
                  missingAbstract: !lit.abstract,
                });

                try {
                  // First try to get metadata by DOI if available
                  if (lit.doi && lit.doi.startsWith("10.")) {
                    const doiResults = await crossrefService.getWorksByDois([lit.doi]);
                    if (doiResults.length > 0 && doiResults[0]) {
                      const crossrefWork = doiResults[0];
                      return {
                        ...lit,
                        authors: lit.authors.length && !lit.authors.includes("Unknown Author") 
                          ? lit.authors 
                          : crossrefWork.author?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()) || lit.authors,
                        journal: lit.journal && lit.journal !== "Unknown" 
                          ? lit.journal 
                          : crossrefWork["container-title"]?.[0] || lit.journal,
                        abstract: lit.abstract || crossrefWork.abstract || lit.abstract,
                        year: lit.year || new Date(crossrefWork.published?.["date-parts"]?.[0]?.[0] || lit.year).getFullYear(),
                        citationCount: lit.citationCount || crossrefWork["is-referenced-by-count"] || lit.citationCount,
                      };
                    }
                  }

                  // If DOI lookup fails, try bibliographic search by title
                  const bibliographicResults = await crossrefService.searchByBibliographic(
                    lit.title, 
                    { rows: 1, type: "journal-article" }
                  );
                  
                  if (bibliographicResults.length > 0) {
                    const crossrefWork = bibliographicResults[0];
                    return {
                      ...lit,
                      authors: lit.authors.length && !lit.authors.includes("Unknown Author") 
                        ? lit.authors 
                        : crossrefWork.author?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()) || lit.authors,
                      journal: lit.journal && lit.journal !== "Unknown" 
                        ? lit.journal 
                        : crossrefWork["container-title"]?.[0] || lit.journal,
                      abstract: lit.abstract || crossrefWork.abstract || lit.abstract,
                      doi: lit.doi || crossrefWork.DOI || lit.doi,
                      year: lit.year || new Date(crossrefWork.published?.["date-parts"]?.[0]?.[0] || lit.year).getFullYear(),
                      citationCount: lit.citationCount || crossrefWork["is-referenced-by-count"] || lit.citationCount,
                    };
                  }

                  console.log(`No Crossref enhancement found for literature ${lit.id}`);
                  return lit;
                } catch (enhancementError) {
                  console.error(`Crossref enhancement failed for literature ${lit.id}:`, enhancementError);
                  return lit;
                }
              })
            );

            return {
              sentence,
              index,
              literature: enhancedLiterature,
            };
          } catch (error) {
            console.error(
              `Crossref enhancement failed for sentence: "${sentence}"`,
              error
            );
            return { sentence, index, literature };
          }
        })
      );

      // Convert enhanced Exa results to our Literature format for final response
      const finalResults: SentenceResult[] = enhancedExaResults.map(
        ({ sentence, index, literature }) => ({
          sentence,
          sentenceIndex: index + 1,
          literature,
        })
      );

      const response = {
        results: finalResults,
      };

      // Update schema validation to match new response structure
      const FinalResponseSchema = z.object({
        results: z.array(SentenceResultSchema),
      });

      const validatedResponse = FinalResponseSchema.parse(response);
      return NextResponse.json(validatedResponse);
    } catch (exaError) {
      console.error("Search service failed:", exaError);
      return NextResponse.json(
        {
          error: `Search service failed: ${
            exaError instanceof Error ? exaError.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Search API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Simple mark wrapper helpers (server-side)
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeywords(query: string): string[] {
  const english = query.match(/[A-Za-z0-9]{3,}/g) || [];
  const chinese = query.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const merged = [...english, ...chinese];
  // Deduplicate, preserve order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of merged) {
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  return result;
}

function wrapMarksByQuery(query: string, text?: string): string | undefined {
  if (!text) return undefined;
  let output = text;
  for (const kw of extractKeywords(query)) {
    const re = new RegExp(`(${escapeRegExp(kw)})`, "gi");
    output = output.replace(re, "<mark>$1</mark>");
  }
  return output;
}

function wrapMarksByHighlights(
  text?: string,
  highlights?: string[]
): string | undefined {
  if (!text) return undefined;
  if (!highlights || highlights.length === 0) return text;
  let output = text;
  for (const h of highlights) {
    const snippet = h.trim();
    if (snippet.length < 2) continue;
    const re = new RegExp(escapeRegExp(snippet), "gi");
    output = output.replace(re, "<mark>$&</mark>");
  }
  return output;
}