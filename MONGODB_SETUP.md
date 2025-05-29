# MongoDB Setup for Contextual Memory

This document describes how to set up MongoDB and authentication for the Contextual Memory application.

## Environment Configuration

Create a `.env` file in the root of your project with the following content:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/contextual-memory
# For MongoDB Atlas, use:
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/contextual-memory?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d

# App settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **IMPORTANT**: For production, always use a strong, unique JWT_SECRET value. The secret should be at least 32 characters long and contain a mix of letters, numbers, and symbols.

## Local MongoDB Setup

1. Install MongoDB Community Edition locally:
   - [Install MongoDB Community Edition](https://www.mongodb.com/docs/manual/administration/install-community/)
   - Start the MongoDB service

2. Create a new database named `contextual-memory`:
   ```
   mongosh
   use contextual-memory
   ```

## MongoDB Atlas Setup (Recommended for Production)

1. Create a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account
2. Create a new cluster
3. Set up a database user with read/write permissions
4. Whitelist your IP address or use `0.0.0.0/0` for development
5. Get your connection string and update the `.env` file
6. Create a database named `contextual-memory`

## Authentication Setup

The application uses JWT (JSON Web Tokens) for authentication. The setup includes:

1. User registration and login endpoints
2. Password hashing with bcrypt
3. JWT token generation and validation
4. Protected API routes requiring authentication

## Vector Search Setup

For the vector search functionality, you need to set up a vector index in MongoDB Atlas:

1. Go to your Atlas cluster
2. Click on "Search" tab
3. Create a new index with the following configuration:
   - Database: contextual-memory
   - Collection: entries
   - Index name: vector_index
   - Type: Vector
   - Dimensions: 1536 (for OpenAI embeddings)
   - Field: embeddings
   - Similarity: cosine

Alternatively, using the MongoDB Shell:

```javascript
db.entries.createIndex(
  { embeddings: "vector" },
  {
    name: "vector_index",
    vector: { dimensions: 1536, similarity: "cosine" }
  }
)
```

## Collections

The application uses three main collections:

1. `users` - User information, authentication data, and preferences
2. `projects` - Project details for organizing entries
3. `entries` - The main data store for all contextual memory entries with vector embeddings

## Test the Connection

You can test the MongoDB connection by running the application and visiting:

```
http://localhost:3000/api/test
```

This endpoint should return a success message if the connection is working properly. 

## Authentication Testing

After setting up, you can test authentication by:

1. Creating a new user account using the signup form
2. Logging in with the registered credentials
3. Accessing the dashboard page, which requires authentication 