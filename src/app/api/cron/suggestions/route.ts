import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, Entry, User } from '@/lib/database';
import mongoose from 'mongoose';
import { findSimilarEntries, generateLinkReason, detectContradictions } from '@/lib/auto-link';

/**
 * Cron job endpoint to generate proactive suggestions for all users
 * This should be called by a scheduled task (e.g., using a service like Vercel Cron)
 * GET /api/cron/suggestions?apiKey=your-secret-api-key
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Security check - ensure this is only called by an authorized service
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    
    if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Find all users
    const users = await User.find({}).lean();
    
    const results = {
      totalUsers: users.length,
      processedUsers: 0,
      suggestionsGenerated: 0,
      orphanEntriesProcessed: 0,
      contradictionsFound: 0,
      errors: [] as string[]
    };
    
    // Process each user
    for (const user of users) {
      try {
        // Get user entries with embeddings
        const entries = await Entry.find({
          userId: user._id,
          embeddings: { $exists: true, $ne: [] }
        }).lean();
        
        if (entries.length === 0) continue;
        
        // 1. Find orphan entries (those with 0 or 1 links)
        const orphanEntries = entries.filter(entry => 
          !entry.linkedEntries || entry.linkedEntries.length <= 1
        );
        
        // Process orphan entries
        for (const entry of orphanEntries) {
          try {
            // Find similar entries
            const similarEntries = await findSimilarEntries(entry, 3, 0.6);
            
            if (similarEntries.length > 0) {
              // Generate links
              const newLinks = [];
              
              for (const { entry: similarEntry, score } of similarEntries) {
                const reason = await generateLinkReason(entry, similarEntry);
                
                // Only add links with valid reasons
                if (reason !== null) {
                  newLinks.push({
                    entryId: similarEntry._id,
                    reason,
                    score
                  });
                }
              }
              
              // Filter out existing links
              const existingLinkIds = (entry.linkedEntries || []).map(
                (link: any) => link.entryId.toString()
              );
              
              const filteredLinks = newLinks.filter(
                link => !existingLinkIds.includes(link.entryId.toString())
              );
              
              // Update entry with new links
              if (filteredLinks.length > 0) {
                await Entry.updateOne(
                  { _id: entry._id },
                  { 
                    $push: { 
                      linkedEntries: { $each: filteredLinks } 
                    } 
                  }
                );
                
                results.suggestionsGenerated += filteredLinks.length;
              }
            }
            
            results.orphanEntriesProcessed++;
          } catch (error) {
            console.error(`Error processing orphan entry ${entry._id}:`, error);
            results.errors.push(`Error processing orphan entry ${entry._id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // 2. Detect contradictions between entries
        // Limit to recent entries to avoid processing too many
        const recentEntries = entries
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);
        
        const contradictions = await detectContradictions(recentEntries);
        
        if (contradictions.length > 0) {
          // Store contradictions in the database
          // In a real app, you might have a separate collection for this
          // For now, we'll just add them as special links
          for (const contradiction of contradictions) {
            // Update first entry
            await Entry.updateOne(
              { _id: contradiction.entryId1 },
              { 
                $push: { 
                  linkedEntries: { 
                    entryId: contradiction.entryId2,
                    reason: `⚠️ Potential contradiction: ${contradiction.explanation}`,
                    isContradiction: true
                  } 
                } 
              }
            );
            
            results.contradictionsFound++;
          }
        }
        
        results.processedUsers++;
      } catch (error) {
        console.error(`Error processing user ${user._id}:`, error);
        results.errors.push(`Error processing user ${user._id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Processed ${results.processedUsers} users, found ${results.suggestionsGenerated} new connections and ${results.contradictionsFound} contradictions`,
      data: results
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to generate suggestions',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 