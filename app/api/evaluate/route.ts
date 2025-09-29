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
});

type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, literature } = EvaluateRequestSchema.parse(body);

    console.log("Evaluating literature:", literature.title);

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
    });

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("Literature evaluation failed:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}