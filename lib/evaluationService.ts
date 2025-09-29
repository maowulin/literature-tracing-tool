import { z } from "zod";
import { BaseService } from "./base/BaseService";
import { LiteratureEvaluation } from "./types";
import { calculateRelevanceScore } from "./utils/common";

// Literature evaluation result schema
const LiteratureEvaluationSchema = z.object({
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
});

interface EvaluationRequest {
  query: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  abstract?: string;
  doi?: string;
  citationCount?: number;
  impactFactor?: number;
  // add context for better evaluation
  contextIntent?: string;
  contextKeywords?: string[];
}

export class EvaluationService extends BaseService {
  private model = "openai/gpt-4o";

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    super("https://openrouter.ai/api/v1", {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://literature-tracer.com",
      "X-Title": "Literature Tracer",
    });

    console.log("EvaluationService constructor called");
    console.log(
      "API Key from env:",
      apiKey ? `${apiKey.substring(0, 10)}...` : "NOT FOUND"
    );

    if (!apiKey) {
      console.warn(
        "OPENROUTER_API_KEY is missing from environment variables, will use fallback evaluations"
      );
    }
  }

  async evaluateLiterature(
    request: EvaluationRequest,
    model?: string,
    customPrompt?: string
  ): Promise<LiteratureEvaluation> {
    try {
      console.log("=== EVALUATION SERVICE CALLED ===");
      console.log("Starting literature evaluation for:", request.title);

      const apiKey = process.env.OPENROUTER_API_KEY || "";
      console.log("API Key available:", !!apiKey);
      console.log("API Key length:", apiKey.length);

      // Check if API key is available
      if (!apiKey) {
        console.log("No API key available, throwing error");
        throw new Error("OpenRouter API key is not configured");
      }

      // Add alert to make sure we can see this in browser
      if (typeof window !== "undefined") {
        console.log("Running in browser context");
      } else {
        console.log("Running in server context");
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const requestBody = {
        model: model || this.model,
        messages: [
          {
            role: "system",
            content: customPrompt ? customPrompt : this.buildSystemPrompt(),
          },
          {
            role: "user",
            content: this.buildEvaluationPrompt(request),
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      };

      console.log("Making API request to:", `${this.baseUrl}/chat/completions`);
      console.log("Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "Literature Tracing Tool",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("API Response status:", response.status);
      console.log("API Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `OpenRouter API error: ${response.status} ${response.statusText}`,
          errorText
        );

        // Throw error to let frontend handle it properly
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log("API Response data:", JSON.stringify(data, null, 2));

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error("No content received from OpenRouter API");
        throw new Error("No content received from OpenRouter API");
      }

      console.log("Raw AI response content:", content);

      // Try to parse the JSON response
      try {
        // Clean the content by removing markdown code blocks if present
        let cleanContent = content.trim();

        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        if (cleanContent.startsWith("```")) {
          const lines = cleanContent.split("\n");
          // Remove first line (```json or ```)
          lines.shift();
          // Remove last line (```)
          if (lines[lines.length - 1].trim() === "```") {
            lines.pop();
          }
          cleanContent = lines.join("\n").trim();
        }

        console.log("Cleaned content for parsing:", cleanContent);

        const evaluation = JSON.parse(cleanContent);
        console.log("Parsed evaluation:", evaluation);

        const validatedEvaluation =
          LiteratureEvaluationSchema.parse(evaluation);
        return validatedEvaluation;
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
    } catch (error) {
      console.error("EvaluationService error:", error);
      // Re-throw the error to let the API route handle it
      throw error;
    }
  }

  private getFallbackEvaluation(
    request: EvaluationRequest
  ): LiteratureEvaluation {
    // Heuristic fallback using available metadata and keyword relevance
    const currentYear = new Date().getFullYear();
    const query = request.query;
    const title = request.title;
    const abstract = request.abstract;

    // Relevance from keyword overlap in title/abstract (0-10)
    const keywordRelevance = calculateRelevanceScore(query, title, abstract);

    // Normalize metrics to 0-1
    const citationNorm = Math.min(
      1,
      Math.max(0, (request.citationCount ?? 0) / 100)
    );
    const impactNorm = Math.min(
      1,
      Math.max(0, (request.impactFactor ?? 0) / 10)
    );
    const recencyNorm = (() => {
      if (!request.year) return 0.5;
      const age = currentYear - request.year;
      // Map 0-20 years to 1-0 linearly, clamp
      return Math.max(0, Math.min(1, 1 - age / 20));
    })();

    // Compute scores (0-10)
    const relevanceScore = Math.max(
      0,
      Math.min(
        10,
        keywordRelevance * 0.7 + impactNorm * 10 * 0.1 + citationNorm * 10 * 0.2
      )
    );
    const credibilityScore = Math.max(
      0,
      Math.min(
        10,
        (citationNorm * 0.5 + impactNorm * 0.4 + recencyNorm * 0.1) * 10
      )
    );
    const impactFinalScore = Math.max(
      0,
      Math.min(10, (citationNorm * 0.7 + impactNorm * 0.3) * 10)
    );

    // Build advantages/limitations
    const advantages: string[] = [];
    const limitations: string[] = [];

    if ((request.citationCount ?? 0) >= 50)
      advantages.push("High citation count");
    if ((request.impactFactor ?? 0) >= 5)
      advantages.push("High journal impact factor");
    if (recencyNorm >= 0.7) advantages.push("Recent publication");

    if (!abstract) limitations.push("Abstract missing");
    if (!request.impactFactor) limitations.push("Impact factor unavailable");
    if ((request.citationCount ?? 0) === 0)
      limitations.push("Citation count unavailable");
    if (keywordRelevance < 4) limitations.push("Low keyword match to query");

    return {
      relevance: {
        score: relevanceScore,
        reason: "Estimated relevance from keyword match and basic metadata",
      },
      credibility: {
        score: credibilityScore,
        reason:
          "Estimated credibility from citations, impact factor, and recency",
      },
      impact: {
        score: impactFinalScore,
        reason: "Estimated impact from citations and journal impact factor",
      },
      advantages: advantages.length > 0 ? advantages : ["Academic paper"],
      limitations:
        limitations.length > 0 ? limitations : ["LLM evaluation unavailable"],
    };
  }

  async evaluateMultipleLiterature(
    query: string,
    literatureList: Array<Omit<EvaluationRequest, "query">>
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
      });
    });

    try {
      return await Promise.all(evaluationPromises);
    } catch (error) {
      console.error("Batch literature evaluation failed:", error);
      // Fallback individually using heuristic to avoid identical scores
      return literatureList.map((lit) =>
        this.getFallbackEvaluation({
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
      );
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert academic literature evaluator. Evaluate the relevance and quality of academic papers based on the given query and paper details. \n\nUtilize the provided context intent and keywords to better understand the user's underlying research aim and terminology. If context is missing, proceed with the query alone.\n\nCRITICAL: ALL SCORES MUST BE INTEGERS BETWEEN 0 AND 10 (INCLUSIVE). DO NOT EXCEED 10 OR GO BELOW 0.\n\nRespond with a JSON object containing:\n- relevance: object with score (integer 0-10, NO DECIMALS) and reason (string explaining relevance to query)\n- credibility: object with score (integer 0-10, NO DECIMALS) and reason (string explaining credibility assessment)\n- impact: object with score (integer 0-10, NO DECIMALS) and reason (string explaining impact assessment)\n- advantages: array of strings (key strengths of the paper)\n- limitations: array of strings (potential limitations and methodological concerns)\n\nBe objective and consider factors like journal reputation, citation count, impact factor, and relevance to the query. REMEMBER: Scores must be between 0-10 only.`;
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `
Please evaluate the following academic paper for its relevance and quality based on the user's query.

**User Query:** "${request.query}"

**Context Intent:** ${
      request.contextIntent ? request.contextIntent : "Not provided"
    }
**Context Keywords:** ${
      request.contextKeywords && request.contextKeywords.length > 0
        ? request.contextKeywords.join(", ")
        : "Not provided"
    }

**Paper Information:**
- Title: ${request.title}
- Authors: ${request.authors.join(", ")}
- Journal: ${request.journal}
- Year: ${request.year}
- DOI: ${request.doi || "Not available"}
- Citation Count: ${request.citationCount || "Not available"}
- Impact Factor: ${request.impactFactor || "Not available"}
- Abstract: ${request.abstract || "Not available"}

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
`;
  }

  private getDefaultEvaluation(): LiteratureEvaluation {
    return {
      relevance: {
        score: 5,
        reason: "Default evaluation (evaluation service unavailable)",
      },
      credibility: {
        score: 5,
        reason: "Default credibility assessment",
      },
      impact: {
        score: 5,
        reason: "Default impact assessment",
      },
      advantages: ["Academic literature"],
      limitations: ["Requires manual evaluation"],
    };
  }
}

export const evaluationService = new EvaluationService();