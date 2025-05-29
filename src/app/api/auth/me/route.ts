import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, User } from '@/lib/database';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify authentication
    const { authorized, userId, message } = await verifyAuth(request);
    
    if (!authorized) {
      return unauthorizedResponse(message);
    }
    
    // Get user data
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to fetch user data',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 