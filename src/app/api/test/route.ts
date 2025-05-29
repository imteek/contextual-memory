import { NextResponse } from 'next/server';
import { dbConnect, User, Project, Entry } from '@/lib/database';

export async function GET() {
  try {
    // Connect to the database
    await dbConnect();
    
    // Return a test response
    return NextResponse.json({ 
      status: 'success',
      message: 'MongoDB connection successful',
      models: {
        User: Boolean(User),
        Project: Boolean(Project),
        Entry: Boolean(Entry)
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to connect to database',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 