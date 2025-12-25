import jwt from 'jsonwebtoken';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { IUser } from '@/models/User';
import { addCORSHeaders, handleCORS } from './cors';

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable');
}

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Generate a JWT token for the authenticated user
 */
export function generateToken(user: IUser): string {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to authenticate API routes
 */
export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: TokenPayload) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Get token from cookies or authorization header
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      // Call the handler with the authenticated user
      return await handler(req, res, decoded);
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
}

/**
 * Middleware to authenticate App Router routes
 * @param options Optional configuration for authentication
 * @param options.requireAuth Whether authentication is required (default: true)
 */
export function withAuthAppRouter(
  handler: (req: NextRequest, user: TokenPayload | null) => Promise<NextResponse>,
  options: { requireAuth?: boolean } = { requireAuth: true }
) {
  return async (req: NextRequest) => {
    try {
      // Handle CORS preflight requests
      const corsResponse = handleCORS(req);
      if (corsResponse) {
        return corsResponse;
      }
      
      // Get token from cookies or authorization header
      const cookieStore = cookies();
      const token = cookieStore.get('token')?.value || req.headers.get('authorization')?.split(' ')[1];

      // If no token but auth is required, return 401
      if (!token && options.requireAuth) {
        return addCORSHeaders(
          NextResponse.json({ message: 'Authentication required' }, { status: 401 }),
          req
        );
      }

      // If token exists, verify it
      let decoded: TokenPayload | null = null;
      if (token) {
        decoded = verifyToken(token);
        if (!decoded && options.requireAuth) {
          return addCORSHeaders(
            NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 }),
            req
          );
        }
      }

      // Call the handler with the authenticated user (or null if not authenticated and not required)
      const response = await handler(req, decoded);
      return addCORSHeaders(response, req);
    } catch (error) {
      console.error('Authentication error:', error);
      return addCORSHeaders(
        NextResponse.json({ message: 'Internal server error' }, { status: 500 }),
        req
      );
    }
  };
}

/**
 * Middleware to check if user has admin role
 */
export function withAdminAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: TokenPayload) => Promise<void>
) {
  return withAuth(async (req, res, user) => {
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return await handler(req, res, user);
  });
}

/**
 * Middleware to check if user has admin role for App Router
 */
export function withAdminAuthAppRouter(
  handler: (req: NextRequest, user: TokenPayload) => Promise<NextResponse>
) {
  return withAuthAppRouter(async (req, user) => {
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }
    return await handler(req, user);
  });
}

/**
 * Middleware to check if user has specific role for App Router
 */
export function withRoleAuthAppRouter(
  handler: (req: NextRequest, user: TokenPayload) => Promise<NextResponse>,
  allowedRoles: string[]
) {
  return withAuthAppRouter(async (req, user) => {
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ message: 'Unauthorized: insufficient permissions' }, { status: 403 });
    }
    return await handler(req, user);
  });
}

/**
 * Check if a user has permission to access a resource
 * @param user The authenticated user
 * @param resourceOwnerId The ID of the resource owner
 * @param isPublic Whether the resource is public
 * @returns Boolean indicating if the user has access
 */
export function hasResourceAccess(
  user: TokenPayload | null,
  resourceOwnerId?: string,
  isPublic: boolean = false
): boolean {
  if (isPublic) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (resourceOwnerId && user.userId === resourceOwnerId) return true;
  return false;
}
