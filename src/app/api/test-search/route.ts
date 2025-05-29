import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings } from '@/lib/openai';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'test';
  
  try {
    // Test if OpenAI embeddings generation works
    const results = {
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      query,
      hasEmbeddings: false,
      embeddingSize: 0,
      error: null as string | null
    };
    
    if (results.apiKeyConfigured) {
      try {
        const embeddings = await generateEmbeddings(query);
        results.hasEmbeddings = true;
        results.embeddingSize = embeddings.length;
      } catch (error) {
        results.error = error instanceof Error ? error.message : String(error);
      }
    }
    
    return NextResponse.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    console.error('Error testing search:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to test search',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 