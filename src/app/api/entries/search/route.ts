import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { generateEmbeddings } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Parse request body
    const body = await request.json();
    const { query, embeddings, userId, projectId, limit = 10 } = body;
    
    // Validate
    if ((!query && !embeddings) || !userId) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Missing required parameters: either query or embeddings, and userId are required'
        },
        { status: 400 }
      );
    }
    
    // Basic match criteria
    const matchCriteria: any = {
      userId: new mongoose.Types.ObjectId(userId)
    };
    
    // Add project filter if provided
    if (projectId) {
      matchCriteria.projectId = new mongoose.Types.ObjectId(projectId);
    }
    
    let results;
    let queryEmbeddings = embeddings;
    
    // Generate embeddings if query provided but no embeddings
    if (query && !embeddings) {
      try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
          console.log('OpenAI API key not configured, falling back to text search');
          // Fallback to text search if OpenAI API key is not available
          return NextResponse.json({
            status: 'success',
            data: await textSearch(query, matchCriteria, limit)
          });
        }
        
        // Generate embeddings using OpenAI
        queryEmbeddings = await generateEmbeddings(query);
      } catch (error) {
        console.error('Failed to generate embeddings:', error);
        // Fall back to text search if embeddings generation fails
        return NextResponse.json({
          status: 'success',
          data: await textSearch(query, matchCriteria, limit)
        });
      }
    }
    
    // Search with embeddings (vector search)
    if (queryEmbeddings && Array.isArray(queryEmbeddings) && queryEmbeddings.length > 0) {
      // Note: This vector search works specifically with MongoDB Atlas Vector Search
      // You need to have the vector search index set up as described in the Entry model
      try {
        results = await Entry.aggregate([
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embeddings",
              queryVector: queryEmbeddings,
              numCandidates: limit * 10,
              limit: limit
            }
          },
          {
            $match: matchCriteria
          },
          {
            $project: {
              _id: 1,
              title: 1,
              content: 1,
              contentType: 1,
              tags: 1,
              createdAt: 1,
              updatedAt: 1,
              score: { $meta: "vectorSearchScore" }
            }
          }
        ]);
      } catch (error) {
        console.error('Vector search failed, falling back to text search:', error);
        // If vector search fails (e.g., not set up), fall back to text search
        results = await textSearch(query, matchCriteria, limit);
      }
    } else if (query) {
      // Text-based search
      results = await textSearch(query, matchCriteria, limit);
    }
    
    // If no results found or something went wrong, default to text search
    if (!results || results.length === 0) {
      console.log('No vector search results, falling back to text search');
      results = await textSearch(query, matchCriteria, limit);
    }
    
    return NextResponse.json({
      status: 'success',
      data: results || []
    });
  } catch (error) {
    console.error('Error searching entries:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to search entries',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Helper function for text-based search
async function textSearch(query: string, matchCriteria: any, limit: number) {
  if (!query) return [];
  
  // Simple regex search in content and tags
  const textQuery = {
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  const combinedQuery = {
    ...matchCriteria,
    ...textQuery
  };
  
  try {
    return await Entry.find(combinedQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Error during text search:', err);
    return [];
  }
} 