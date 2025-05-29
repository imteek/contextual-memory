import { sign, verify, JwtPayload, SignOptions } from 'jsonwebtoken';
import { IUser } from '../database/models/User';
import { Types } from 'mongoose';

// Get JWT secret from environment variable or use a fallback (in development only)
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_fallback_secret_dev_only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set in production environment. Using fallback is UNSAFE.');
}

interface TokenPayload {
  id: string;
  username: string;
  email: string;
}

// Generate JWT token for a user
export const generateToken = (user: IUser): string => {
  const payload: TokenPayload = {
    id: user._id instanceof Types.ObjectId ? user._id.toString() : String(user._id),
    username: user.username,
    email: user.email
  };
  
  // Added explicit algorithm to help TypeScript understand the signature
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256'
  } as SignOptions);
};

// Verify and decode JWT token
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authorization?: string): string | null => {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  return authorization.split(' ')[1];
}; 