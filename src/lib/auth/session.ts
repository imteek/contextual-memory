import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from './jwt';
import { dbConnect, User } from '@/lib/database';

interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
}

/**
 * Get the authenticated user from the request
 * @param request The Next.js request object
 * @returns The authenticated user or null if not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader ? extractTokenFromHeader(authHeader) : null;
    
    if (!token) {
      return null;
    }
    
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded.id !== 'string') {
      return null;
    }
    
    // Connect to database
    await dbConnect();
    
    // Check if user exists
    const userExists = await User.exists({ _id: decoded.id });
    if (!userExists) {
      return null;
    }
    
    // Return user data
    return {
      id: decoded.id,
      username: decoded.username as string,
      email: decoded.email as string
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 * @param handler The request handler
 * @returns A function that handles the request, ensuring authentication
 */
export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return handler(request, user);
  };
} 