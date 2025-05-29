import mongoose, { Schema, Document } from 'mongoose';

export interface LinkedEntry {
  entryId: mongoose.Types.ObjectId;
  reason: string;
  score?: number;
  isContradiction?: boolean;
}

export interface IEntry extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  contentType: 'text' | 'code' | 'image';
  files?: string[];
  projectId?: mongoose.Types.ObjectId;
  embeddings?: number[];
  tags: string[];
  linkedEntries: LinkedEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const LinkedEntrySchema = new Schema({
  entryId: {
    type: Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  score: {
    type: Number,
    default: 0
  },
  isContradiction: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const EntrySchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Title is required']
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    contentType: {
      type: String,
      enum: ['text', 'code', 'image'],
      default: 'text',
      required: true
    },
    files: [{
      type: String, // URLs to S3 or Cloudinary
    }],
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true
    },
    embeddings: [{
      type: Number,
    }],
    tags: [{
      type: String,
      index: true
    }],
    linkedEntries: [LinkedEntrySchema]
  },
  {
    timestamps: true,
  }
);

// Create index for vector search - note this requires MongoDB Atlas with vector search capability
// This needs to be created manually in MongoDB Atlas or via the MongoDB command line
// The TypeScript definition doesn't support vector indexes yet, so we'll include it as a comment
// and provide instructions on how to create it

/*
To create the vector index in MongoDB Atlas:
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
*/

// For MongoDB Shell, you can use:
// db.entries.createIndex(
//   { embeddings: "vector" },
//   {
//     name: "vector_index",
//     vector: { dimensions: 1536, similarity: "cosine" }
//   }
// )

// Create the model if it doesn't exist already (for hot reloading in development)
export default mongoose.models.Entry || mongoose.model<IEntry>('Entry', EntrySchema); 