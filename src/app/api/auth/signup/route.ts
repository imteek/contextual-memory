import { NextRequest, NextResponse } from 'next/server';
import { dbConnect, User } from '@/lib/database';
import jwt from 'jsonwebtoken';

// Create a simple JWT token generator for now (we'll improve this later)
const generateToken = (userId: string, username: string, email: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET || 'jwt_fallback_secret_dev_only';
  return jwt.sign({ id: userId, username, email }, JWT_SECRET, { expiresIn: '7d' });
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Parse request body
    const body = await request.json();
    const { username, email, password } = body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Missing required fields: username, email, and password are required'
        },
        { status: 400 }
      );
    }
    
    // Check if user with the same email or username already exists
    const existingUser = await User.findOne({
      $or: [
        { email },
        { username }
      ]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { 
          status: 'error',
          message: existingUser.email === email 
            ? 'Email is already in use' 
            : 'Username is already taken'
        },
        { status: 409 }
      );
    }
    
    // Create new user
    const newUser = await User.create({
      username,
      email,
      password,
      preferences: {
        aiModel: 'GPT-4'
      }
    });
    
    // Generate JWT token
    const token = generateToken(
      newUser._id.toString(),
      newUser.username,
      newUser.email
    );
    
    // Return success response with token and user data (excluding password)
    const userData = newUser.toObject();
    delete userData.password;
    
    return NextResponse.json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        token,
        user: userData
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to register user',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 