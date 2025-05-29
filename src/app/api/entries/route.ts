import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { generateEmbeddings } from '@/lib/openai';

// GET all entries
export async function GET(request: NextRequest) {
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const tag = searchParams.get('tag');
    const limit = Number(searchParams.get('limit')) || 20;
    const page = Number(searchParams.get('page')) || 1;
    
    // Build query
    const query: any = { userId: new mongoose.Types.ObjectId(userData.id) };
    
    if (projectId) {
      query.projectId = new mongoose.Types.ObjectId(projectId);
    }
    
    if (tag) {
      query.tags = tag;
    }
    
    // Execute query with pagination
    const entries = await Entry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // Count total documents for pagination
    const total = await Entry.countDocuments(query);
    
    return NextResponse.json({
      status: 'success',
      data: entries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to fetch entries',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST a new entry
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
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.content) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Missing required fields: title and content are required'
        },
        { status: 400 }
      );
    }
    
    // Generate embeddings for the entry
    let embeddings: number[] = [];
    try {
      // Combine title, content, and tags for better semantic search
      const textToEmbed = `${body.title} ${body.content} ${(body.tags || []).join(' ')}`;
      embeddings = await generateEmbeddings(textToEmbed);
      console.log('Generated embeddings for new entry, size:', embeddings.length);
    } catch (error) {
      console.warn('Failed to generate embeddings for entry, continuing without them:', error);
      // Continue without embeddings - semantic search won't work for this entry
    }
    
    // Create new entry
    const entry = await Entry.create({
      userId: new mongoose.Types.ObjectId(userData.id),
      title: body.title,
      content: body.content,
      contentType: body.contentType || 'text',
      files: body.files || [],
      projectId: body.projectId ? new mongoose.Types.ObjectId(body.projectId) : undefined,
      tags: body.tags || [],
      linkedEntries: body.linkedEntries || [],
      embeddings: embeddings.length > 0 ? embeddings : undefined
    });
    
    // If embeddings were generated, try to find similar entries and link them
    const autoLinkingResults: { 
      success: boolean; 
      linkedEntries: Array<{ entryId: any; reason: string; score: number }>
    } = { 
      success: false, 
      linkedEntries: [] 
    };
    
    if (embeddings.length > 0) {
      try {
        // Import the auto-linking functions
        const { findSimilarEntries, generateLinkReason } = await import('@/lib/auto-link');
        
        // Find similar entries
        const similarEntries = await findSimilarEntries(entry, 3, 0.7);
        
        if (similarEntries.length > 0) {
          // Generate reasons and create links
          const linkedEntries = [];
          
          for (const { entry: similarEntry, score } of similarEntries) {
            // Generate reason for the link
            const reason = await generateLinkReason(entry, similarEntry);
            
            // Only create links with valid reasons
            if (reason !== null) {
              // Create link objects
              linkedEntries.push({
                entryId: similarEntry._id,
                reason,
                score
              });
            }
          }
          
          // Update entry with links
          if (linkedEntries.length > 0) {
            entry.linkedEntries = linkedEntries;
            await entry.save();
            
            autoLinkingResults.success = true;
            autoLinkingResults.linkedEntries = linkedEntries;
          }
        }
      } catch (error) {
        console.warn('Failed to auto-link entries:', error);
        // Continue without auto-linking - this is a non-critical feature
      }
    }
    
    return NextResponse.json({
      status: 'success',
      data: entry,
      hasEmbeddings: embeddings.length > 0,
      autoLinking: autoLinkingResults
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating entry:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to create entry',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 