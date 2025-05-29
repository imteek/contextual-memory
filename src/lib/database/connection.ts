import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global cache is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */

// Define mongoose cache type
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Create a cached connection variable outside of the function
// that persists between function calls
let cachedConnection: MongooseCache = { conn: null, promise: null };

async function dbConnect() {
  // If we have a cached connection, return it
  if (cachedConnection.conn) {
    return cachedConnection.conn;
  }

  // If we don't have a cached connection, create a new one
  if (!cachedConnection.promise) {
    const opts = {
      bufferCommands: false,
    };

    cachedConnection.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  // Wait for the connection to establish and cache it
  cachedConnection.conn = await cachedConnection.promise;
  return cachedConnection.conn;
}

export default dbConnect; 