import { Entry } from '@/lib/database';
import mongoose from 'mongoose';
import { generateEmbeddings } from '@/lib/openai';
import OpenAI from 'openai';

/**
 * Auto-Linking System
 * 
 * This module implements a two-stage approach to identifying semantically related entries:
 * 
 * 1. Vector Similarity (Quantitative):
 *    - Uses MongoDB Atlas vector search with the knnBeta operator
 *    - Efficiently filters potential matches based on embedding vector similarity
 *    - Sets a minimum similarity threshold (default: 0.7 or 70%)
 *    - Fast and scalable, but can only detect pattern-based similarity
 * 
 * 2. Semantic Understanding (Qualitative):
 *    - For entries that pass the vector similarity threshold, uses GPT-4 for semantic analysis
 *    - Determines if there's a meaningful connection beyond statistical similarity
 *    - Generates a natural language explanation of the relationship
 *    - May reject connections that have high vector similarity but lack semantic meaning
 *    - Skip this step for extremely high similarity scores (>0.9 or 90%)
 * 
 * This approach balances efficiency and accuracy:
 * - Vector search quickly filters down to potential matches
 * - LLM analysis only runs on pre-filtered candidates, reducing API calls
 * - Combines quantitative (vectors) and qualitative (LLM) methods
 */

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Find similar entries to a target entry using vector search
 * 
 * @param targetEntry The entry to find similar entries for
 * @param limit Maximum number of similar entries to return
 * @param threshold Similarity threshold (0 to 1)
 * @returns Array of similar entries with similarity scores
 */
export async function findSimilarEntries(
  targetEntry: any,
  limit: number = 5,
  threshold: number = 0.7
): Promise<Array<{ entry: any, score: number }>> {
  if (!targetEntry.embeddings || targetEntry.embeddings.length === 0) {
    throw new Error('Target entry has no embeddings');
  }

  try {
    // Try using MongoDB Atlas Search with knnBeta operator
    try {
      const similarEntries = await Entry.aggregate([
        {
          $search: {
            index: "vector_index",
            knnBeta: {
              vector: targetEntry.embeddings,
              path: "embeddings",
              k: limit + 1
            }
          }
        },
        {
          $match: {
            // Exclude the target entry itself
            _id: { $ne: new mongoose.Types.ObjectId(targetEntry._id) },
            // Only search within the same user's entries
            userId: new mongoose.Types.ObjectId(targetEntry.userId)
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            content: 1,
            tags: 1,
            contentType: 1,
            createdAt: 1,
            updatedAt: 1,
            score: { $meta: "searchScore" }
          }
        },
        {
          $match: {
            score: { $gt: threshold }
          }
        },
        {
          $limit: limit
        }
      ]);

      return similarEntries.map((entry: any) => ({
        entry,
        score: entry.score
      }));
    } catch (vectorError) {
      console.error('Vector search failed, trying text similarity fallback:', vectorError);
      throw vectorError; // Throw to use the fallback approach
    }
  } catch (error) {
    console.error('Error finding similar entries:', error);
    
    // If vector search failed (e.g., not using MongoDB Atlas), fallback to simpler methods
    // Get recent entries from the same user
    const fallbackEntries = await Entry.find({
      _id: { $ne: new mongoose.Types.ObjectId(targetEntry._id) },
      userId: new mongoose.Types.ObjectId(targetEntry.userId)
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
    
    return fallbackEntries.map(entry => ({
      entry,
      score: 0.5 // Default score for fallback entries
    }));
  }
}

/**
 * Generate a natural language reason for linking two entries using GPT-4
 * This is called ONLY after vector similarity has already determined a potential match.
 * 
 * @param sourceEntry The source entry
 * @param targetEntry The target entry to link to
 * @param vectorSimilarityScore The similarity score from the vector comparison (0-1)
 * @returns A natural language reason for the link, or null if no meaningful connection
 */
export async function generateLinkReason(
  sourceEntry: any,
  targetEntry: any,
  vectorSimilarityScore: number = 0.7
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback if no API key is available
    return "These entries may be related";
  }

  try {
    // If vector similarity is extremely high (>0.9), we can assume a strong connection
    // without making an additional API call
    if (vectorSimilarityScore > 0.9) {
      // Check for exact duplicates
      if (sourceEntry.title === targetEntry.title && 
          sourceEntry.content === targetEntry.content) {
        return "Duplicate entries with identical content";
      }
      
      // For very similar but not identical content
      return `Very similar content (${Math.round(vectorSimilarityScore * 100)}% match)`;
    }
    
    // Extract relevant information from both entries
    const sourceInfo = {
      title: sourceEntry.title,
      content: truncateText(sourceEntry.content, 300),
      tags: sourceEntry.tags,
      date: new Date(sourceEntry.createdAt).toLocaleDateString()
    };

    const targetInfo = {
      title: targetEntry.title,
      content: truncateText(targetEntry.content, 300),
      tags: targetEntry.tags,
      date: new Date(targetEntry.createdAt).toLocaleDateString()
    };

    // Generate explanation using GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an assistant that analyzes whether two notes are meaningfully related and explains why. Only describe a relationship if there's a clear conceptual or topical connection between the content. If the only similarity is creation date, format, or superficial word usage, respond with 'NO_MEANINGFUL_CONNECTION'. If there is a meaningful connection, explain it clearly and concisely in 15 words or less."
        },
        {
          role: "user",
          content: `Analyze if these two entries are meaningfully related and explain why or respond with NO_MEANINGFUL_CONNECTION:
            
Entry 1 (${sourceInfo.date}):
Title: ${sourceInfo.title}
Tags: ${sourceInfo.tags.join(', ')}
Content: ${sourceInfo.content}

Entry 2 (${targetInfo.date}):
Title: ${targetInfo.title}
Tags: ${targetInfo.tags.join(', ')}
Content: ${targetInfo.content}

Vector similarity score: ${vectorSimilarityScore.toFixed(2)} (0-1 scale)`
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const reason = response.choices[0]?.message?.content?.trim() || "";
    
    // Check if the model determined there's no meaningful connection
    if (reason.includes("NO_MEANINGFUL_CONNECTION")) {
      return null;
    }
    
    return reason;
  } catch (error) {
    console.error('Error generating link reason:', error);
    return "These entries may be related";
  }
}

/**
 * Detects contradictions between entries
 * 
 * @param entries Array of entries to check for contradictions
 * @returns Array of detected contradictions with explanations
 */
export async function detectContradictions(
  entries: any[]
): Promise<Array<{ entryId1: string, entryId2: string, explanation: string }>> {
  if (!process.env.OPENAI_API_KEY || entries.length < 2) {
    return [];
  }

  const contradictions = [];
  
  // For larger sets of entries, we'd need a more efficient approach
  // This is a simplified implementation for demonstration
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const entry1 = entries[i];
      const entry2 = entries[j];
      
      // Skip entries with very different topics (based on tags)
      if (!hasCommonTags(entry1.tags, entry2.tags)) continue;
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { 
              role: "system", 
              content: "You are an assistant that detects contradictions between notes. Only report actual contradictions where the user has changed their approach, recommendation, or conclusion. Don't report mere differences in topic or focus. If no clear contradiction exists, respond with 'NO_CONTRADICTION'."
            },
            {
              role: "user",
              content: `Check if these two entries contradict each other:
                
Entry 1 (${new Date(entry1.createdAt).toLocaleDateString()}):
Title: ${entry1.title}
Content: ${truncateText(entry1.content, 300)}

Entry 2 (${new Date(entry2.createdAt).toLocaleDateString()}):
Title: ${entry2.title}
Content: ${truncateText(entry2.content, 300)}`
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        });

        const result = response.choices[0]?.message?.content?.trim();
        
        if (result && !result.includes('NO_CONTRADICTION')) {
          contradictions.push({
            entryId1: entry1._id,
            entryId2: entry2._id,
            explanation: result
          });
        }
      } catch (error) {
        console.error('Error detecting contradictions:', error);
      }
    }
  }
  
  return contradictions;
}

/**
 * Truncate text to a specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Check if two tag arrays have at least one common tag
 */
function hasCommonTags(tags1: string[], tags2: string[]): boolean {
  return tags1.some(tag => tags2.includes(tag));
} 