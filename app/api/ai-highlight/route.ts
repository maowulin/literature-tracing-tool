import { NextRequest, NextResponse } from 'next/server';
import { openRouterService } from '@/lib/openRouterService';

export async function POST(request: NextRequest) {
  try {
    const { query, text, type = 'text' } = await request.json();

    if (!query || !text) {
      return NextResponse.json(
        { error: 'Query and text are required' },
        { status: 400 }
      );
    }

    let result;
    
    if (type === 'semantic') {
      // Handle semantic similarity calculation
      result = await openRouterService.calculateSemanticSimilarity(query, text);
    } else if (type === 'literature') {
      // Handle literature content highlighting
      const { title, abstract } = JSON.parse(text);
      
      // Calculate relevance for title and abstract separately
      const titleResult = await openRouterService.calculateSemanticSimilarity(query, title);
      const abstractResult = await openRouterService.calculateSemanticSimilarity(query, abstract);
      
      result = {
        titleRelevance: titleResult.score,
        abstractRelevance: abstractResult.score,
        overallRelevance: Math.max(titleResult.score, abstractResult.score)
      };
    } else {
      // Default text highlighting
      result = await openRouterService.calculateSemanticSimilarity(query, text);
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('AI highlight API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}