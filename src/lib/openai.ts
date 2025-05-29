import OpenAI from 'openai';

// Log whether API key is available (for debugging)
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ OpenAI API key is not set. Semantic search will fall back to text search.');
} else {
  console.log('✓ OpenAI API key is configured.');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey,
});

/**
 * Generate embeddings for a given text input using OpenAI's API
 * 
 * @param text Text to generate embeddings for
 * @returns Array of embeddings (1536 dimensions for OpenAI ada-002 model)
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002", 
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

export default openai; 