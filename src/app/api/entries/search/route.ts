import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { generateEmbeddings } from '@/lib/openai';

// Type for MongoDB's aggregation pipeline stages
type MongoSortOrder = 1 | -1;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Parse request body
    const body = await request.json();
    const { query, embeddings, userId, projectId, limit = 10, minRelevance = 0.65 } = body;
    
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
    
    // Perform vector search if we have embeddings
    if (queryEmbeddings && queryEmbeddings.length > 0) {
      try {
        // Create the search pipeline
        const searchStage = {
          $search: {
            index: "vector_index",
            knnBeta: {
              vector: queryEmbeddings,
              path: "embeddings",
              k: limit * 2 // Get more results initially to filter by relevance
            }
          }
        };
        
        const matchStage = {
          $match: matchCriteria
        };
        
        const projectStage = {
          $project: {
            _id: 1,
            title: 1,
            content: 1,
            contentType: 1,
            tags: 1,
            linkedEntries: 1,
            createdAt: 1,
            updatedAt: 1,
            score: { $meta: "searchScore" }
          }
        };
        
        const sortStage = {
          $sort: { score: -1 as MongoSortOrder }
        };
        
        // Execute search with properly typed pipeline
        const searchResults = await Entry.aggregate([
          searchStage,
          matchStage,
          projectStage,
          sortStage
        ]);
        
        // Filter by minimum relevance threshold
        // The scores are normalized to [0, 1] range
        const maxScore = searchResults.length > 0 ? searchResults[0].score : 1;
        const filteredResults = searchResults
          .map(result => ({
            ...result,
            // Normalize the score to [0, 1] range
            normalizedScore: result.score / maxScore
          }))
          .filter(result => result.normalizedScore >= minRelevance)
          .slice(0, limit);
        
        console.log(`Found ${searchResults.length} results, filtered to ${filteredResults.length} by relevance threshold ${minRelevance}`);
        
        // Return filtered results
        return NextResponse.json({
          status: 'success',
          data: filteredResults,
          searchInfo: {
            type: 'semantic',
            totalResults: searchResults.length,
            filteredResults: filteredResults.length,
            relevanceThreshold: minRelevance
          }
        });
      } catch (error) {
        console.error('Vector search failed:', error);
        // Fall back to text search
        return NextResponse.json({
          status: 'success',
          data: await textSearch(query, matchCriteria, limit),
          searchInfo: {
            type: 'text',
            reason: 'Vector search failed'
          }
        });
      }
    } else {
      // No embeddings, use text search
      return NextResponse.json({
        status: 'success',
        data: await textSearch(query, matchCriteria, limit),
        searchInfo: {
          type: 'text',
          reason: 'No embeddings available'
        }
      });
    }
  } catch (error) {
    console.error('Search error:', error);
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

// Perform a text-based search
async function textSearch(query: string, matchCriteria: any, limit: number) {
  // Create text search query
  const textSearchCriteria = {
    ...matchCriteria,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { tags: { $regex: query, $options: 'i' } }
    ]
  };
  
  // Execute search
  return await Entry.find(textSearchCriteria)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
} 