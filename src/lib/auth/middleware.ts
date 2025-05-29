import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from '@/lib/database';

interface JwtPayload {
  id: string;
  username: string;
  email: string;
}

// Middleware to verify authentication
export async function verifyAuth(
  request: NextRequest,
  requireAuth = true
): Promise<{ authorized: boolean; userId?: string; message?: string }> {
  // Get token from authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return requireAuth
      ? { authorized: false, message: 'No token provided' }
      : { authorized: true };
  }

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'jwt_fallback_secret_dev_only';

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // Check if user still exists in database
    const userExists = await User.exists({ _id: decoded.id });
    
    if (!userExists) {
      return { authorized: false, message: 'User no longer exists' };
    }
    
    return {
      authorized: true,
      userId: decoded.id
    };
  } catch (error) {
    return {
      authorized: false,
      message: 'Invalid or expired token'
    };
  }
}

// Helper to create unauthorized response
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { status: 'error', message },
    { status: 401 }
  );
} 