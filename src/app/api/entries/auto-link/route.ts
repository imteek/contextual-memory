import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { findSimilarEntries, generateLinkReason } from '@/lib/auto-link';

/**
 * Endpoint to automatically find and link related entries for a given entry
 * POST /api/entries/auto-link
 * Body: { entryId: string, maxLinks?: number, threshold?: number }
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
    
    // Parse request body
    const body = await request.json();
    const { entryId, maxLinks = 3, threshold = 0.7 } = body;
    
    // Validate entry ID
    if (!entryId || !mongoose.isValidObjectId(entryId)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid entry ID' },
        { status: 400 }
      );
    }
    
    // Fetch the source entry
    const sourceEntry = await Entry.findOne({
      _id: new mongoose.Types.ObjectId(entryId),
      userId: new mongoose.Types.ObjectId(userData.id)
    });
    
    if (!sourceEntry) {
      return NextResponse.json(
        { status: 'error', message: 'Entry not found' },
        { status: 404 }
      );
    }
    
    // Check if entry has embeddings
    if (!sourceEntry.embeddings || sourceEntry.embeddings.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Entry has no embeddings, cannot perform semantic search' },
        { status: 400 }
      );
    }
    
    // Find similar entries
    const similarEntries = await findSimilarEntries(sourceEntry, maxLinks, threshold);
    
    if (similarEntries.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No similar entries found',
        data: { linkedEntries: [] }
      });
    }
    
    // Generate reasons and create links
    const linkedEntries = [];
    const bidirectionalUpdates = []; // Track entries that need bidirectional links
    
    for (const { entry, score } of similarEntries) {
      // Generate reason for the link - pass the vector similarity score
      const reason = await generateLinkReason(sourceEntry, entry, score);
      
      // Only add links with valid reasons (not null)
      if (reason !== null) {
        // Create link object
        const linkObject = {
          entryId: entry._id,
          reason,
          score
        };
        
        linkedEntries.push(linkObject);
        
        // Create bidirectional link data
        bidirectionalUpdates.push({
          targetEntryId: entry._id,
          linkObject: {
            entryId: sourceEntry._id,
            reason, // Same reason
            score // Same score
          }
        });
      }
    }
    
    // Update the source entry with new links
    // First, filter out any duplicates that might already exist
    const existingLinkIds = (sourceEntry.linkedEntries || []).map(
      (link: any) => link.entryId.toString()
    );
    
    const newLinks = linkedEntries.filter(
      link => !existingLinkIds.includes(link.entryId.toString())
    );
    
    // Add new links to the entry
    if (newLinks.length > 0) {
      sourceEntry.linkedEntries = [
        ...(sourceEntry.linkedEntries || []),
        ...newLinks
      ];
      
      await sourceEntry.save();
      
      // Create bidirectional links
      for (const update of bidirectionalUpdates) {
        const targetEntry = await Entry.findById(update.targetEntryId);
        
        if (targetEntry) {
          // Check if this link already exists
          const targetExistingLinks = targetEntry.linkedEntries || [];
          const alreadyLinked = targetExistingLinks.some(
            (link: any) => link.entryId.toString() === sourceEntry._id.toString()
          );
          
          // Only add if not already linked
          if (!alreadyLinked) {
            targetEntry.linkedEntries = [
              ...targetExistingLinks,
              update.linkObject
            ];
            
            await targetEntry.save();
          }
        }
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Found and linked ${newLinks.length} related entries`,
      data: {
        linkedEntries: newLinks
      }
    });
  } catch (error) {
    console.error('Error auto-linking entries:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to auto-link entries',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 