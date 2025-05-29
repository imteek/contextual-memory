import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, User } from '@/lib/database';
import jwt from 'jsonwebtoken';

// Create a simple JWT token generator (same as in signup)
const generateToken = (userId: string, username: string, email: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET || 'jwt_fallback_secret_dev_only';
  return jwt.sign({ id: userId, username, email }, JWT_SECRET, { expiresIn: '7d' });
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Parse request body
    const body = await request.json();
    const { identifier, password } = body; // identifier can be username or email
    
    // Validate required fields
    if (!identifier || !password) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Missing required fields: identifier (username or email) and password are required'
        },
        { status: 400 }
      );
    }
    
    // Find user by username or email, and explicitly select the password field
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    }).select('+password');
    
    // Check if user exists
    if (!user) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Invalid credentials'
        },
        { status: 401 }
      );
    }
    
    // Check if password is correct
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Invalid credentials'
        },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = generateToken(
      user._id.toString(),
      user.username,
      user.email
    );
    
    // Return success response with token and user data (excluding password)
    const userData = user.toObject();
    delete userData.password;
    
    return NextResponse.json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: userData
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to log in',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 