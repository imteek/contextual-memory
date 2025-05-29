import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { generateEmbeddings } from '@/lib/openai';

/**
 * Endpoint to generate embeddings for existing entries
 * This is useful for backfilling embeddings for entries created before
 * the embedding generation was added
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userData = await getAuthenticatedUser(request);
    if (!userData) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Parse request body - can optionally specify entry IDs to process
    const body = await request.json();
    const { entryIds } = body;
    
    // Build query to find entries without embeddings
    const query: any = { 
      userId: new mongoose.Types.ObjectId(userData.id),
      $or: [
        { embeddings: { $exists: false } },
        { embeddings: { $size: 0 } },
        { embeddings: null }
      ]
    };
    
    // If specific entry IDs are provided, filter to those
    if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
      query._id = { 
        $in: entryIds.map(id => 
          new mongoose.Types.ObjectId(id)
        ) 
      };
    }
    
    // Find entries that need embeddings
    const entries = await Entry.find(query).limit(100);
    
    if (entries.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No entries found that need embeddings',
        processed: 0
      });
    }
    
    console.log(`Found ${entries.length} entries that need embeddings`);
    
    // Process each entry to generate embeddings
    const results = {
      total: entries.length,
      success: 0,
      failed: 0,
      entries: [] as Array<{ id: string, status: string, error?: string }>
    };
    
    for (const entry of entries) {
      try {
        // Combine title, content, and tags for better semantic search
        const textToEmbed = `${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`;
        const embeddings = await generateEmbeddings(textToEmbed);
        
        // Update the entry with embeddings
        entry.embeddings = embeddings;
        await entry.save();
        
        results.success++;
        results.entries.push({ 
          id: entry._id.toString(), 
          status: 'success' 
        });
        
        console.log(`Generated embeddings for entry ${entry._id}, size: ${embeddings.length}`);
      } catch (error) {
        results.failed++;
        results.entries.push({ 
          id: entry._id.toString(), 
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
        
        console.error(`Failed to generate embeddings for entry ${entry._id}:`, error);
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Processed ${results.total} entries: ${results.success} succeeded, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Error generating embeddings for entries:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to generate embeddings',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 