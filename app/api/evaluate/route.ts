import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluationService } from "@/lib/evaluationService";

const EvaluateRequestSchema = z.object({
  query: z.string(),
  literature: z.object({
    id: z.number(),
    title: z.string(),
    authors: z.array(z.string()),
    journal: z.string(),
    year: z.number(),
    abstract: z.string().optional(),
    doi: z.string().optional(),
    citationCount: z.number().optional(),
    impactFactor: z.number().optional(),
  }),
  model: z.string().optional(),
  prompt: z.string().optional(),
});

type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, literature, model, prompt } = EvaluateRequestSchema.parse(body);

    console.log("Evaluating literature:", literature.title);
    if (model) console.log("Using model:", model);
    if (prompt) console.log("Using custom prompt");

    const evaluation = await evaluationService.evaluateLiterature({
      query,
      title: literature.title,
      authors: literature.authors,
      journal: literature.journal,
      year: literature.year,
      abstract: literature.abstract,
      doi: literature.doi,
      citationCount: literature.citationCount,
      impactFactor: literature.impactFactor,
    }, model, prompt);

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("Literature evaluation failed:", error);
    
    if (error instanceof z.ZodError) {
      const isValidationError = error.errors.some(err => 
        err.message.includes("Number must be less than or equal to 10") ||
        err.message.includes("Number must be greater than or equal to 0")
      );
      
      if (isValidationError) {
        return NextResponse.json(
          { success: false, error: "Number must be less than or equal to 10" },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "Invalid request format", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      return NextResponse.json(
        { success: false, error: error.message || "Evaluation failed" },
        { status: 500 }
      );
    }

    // Handle non-Error objects
    const errorMessage = typeof error === 'string' ? error : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}