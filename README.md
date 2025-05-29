# Mosaic: Contextual Memory Tool

Mosaic is a web application designed to store and retrieve contextual memory entries using MongoDB and Next.js.

## Features

- Create and manage text, code, and image entries
- Tag-based organization
- Semantic search powered by OpenAI embeddings
- Graph visualization of connections between entries
- Automatic entry linking with AI-generated explanations
- Proactive suggestions and contradiction detection

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up MongoDB connection
4. Add your OpenAI API key to `.env.local`:
   ```
   OPENAI_API_KEY=your-api-key
   ```
5. Run the development server: `npm run dev`

## AI/Backend Workflow

### Automatic Entry Linking

When a user creates a new entry, Mosaic:

1. Generates embeddings for the entry using OpenAI's `text-embedding-ada-002` model
2. Searches for similar entries using vector similarity
3. Generates natural language explanations for why entries are related using GPT-4
4. Adds these connections to the entry's `linkedEntries` array
5. Visualizes these connections in the graph view

This feature helps users discover relationships between their entries that they might not have explicitly created.

### Proactive Suggestions

A scheduled job runs periodically (configurable) to:

1. Find "orphan" entries with few connections
2. Suggest potential connections to other entries
3. Detect contradictions between entries
4. Highlight contradictions with a warning in the UI

To run the scheduled job manually, use:
```
curl -X GET "http://localhost:3000/api/cron/suggestions?apiKey=your-cron-api-key"
```

Or set up a cron job service like Vercel Cron to run it automatically.

### Configuration

The AI behavior can be configured in `.env.local`:

```
# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Auto-linking settings
AUTO_LINK_THRESHOLD=0.7  # Similarity threshold (0-1)
AUTO_LINK_MAX_LINKS=3    # Maximum auto-links per entry

# Cron job
CRON_API_KEY=your-secret-key-here
```

## Vector Search Setup

To enable semantic search, you'll need to set up a vector index in MongoDB Atlas:

1. Go to your Atlas cluster
2. Click on "Search" tab
3. Create a new index with the following configuration:
   - Database: contextual-memory (or your database name)
   - Collection: entries
   - Index name: vector_index
   - Type: Vector
   - Dimensions: 1536 (for OpenAI embeddings)
   - Field: embeddings
   - Similarity: cosine

## License

MIT
