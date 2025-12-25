import { NextResponse } from 'next/server';
import { addCORSHeaders } from './cors';
import { NextRequest } from 'next/server';

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

/**
 * Create a successful API response
 * @param data Response data
 * @param message Optional success message
 * @param status HTTP status code (default: 200)
 * @returns Formatted API response
 */
export function successResponse<T>(
  data: T, 
  message?: string, 
  status: number = 200
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    statusCode: status
  };
}

/**
 * Create an error API response
 * @param error Error message
 * @param status HTTP status code (default: 400)
 * @returns Formatted API response
 */
export function errorResponse(
  error: string, 
  status: number = 400
): ApiResponse {
  return {
    success: false,
    error,
    statusCode: status
  };
}

/**
 * Send a successful API response with CORS headers
 * @param req NextRequest object
 * @param data Response data
 * @param message Optional success message
 * @param status HTTP status code (default: 200)
 * @returns NextResponse with CORS headers
 */
export function sendSuccess<T>(
  req: NextRequest,
  data: T, 
  message?: string, 
  status: number = 200
): NextResponse {
  const response = NextResponse.json(
    successResponse(data, message, status),
    { status }
  );
  
  return addCORSHeaders(response, req);
}

/**
 * Send an error API response with CORS headers
 * @param req NextRequest object
 * @param error Error message
 * @param status HTTP status code (default: 400)
 * @returns NextResponse with CORS headers
 */
export function sendError(
  req: NextRequest,
  error: string, 
  status: number = 400
): NextResponse {
  const response = NextResponse.json(
    errorResponse(error, status),
    { status }
  );
  
  return addCORSHeaders(response, req);
}

/**
 * Format MongoDB document for API response
 * @param doc MongoDB document
 * @returns Formatted document with consistent ID field
 */
export function formatDocument<T extends Record<string, any>>(doc: T): T & { id: string } {
  if (!doc) return doc as T & { id: string };
  
  // Create a new object to avoid modifying the original
  const formatted = { ...doc };
  
  // Convert _id to id if it exists
  if (formatted._id) {
    // Convert ObjectId to string if needed
    formatted.id = typeof formatted._id.toString === 'function' 
      ? formatted._id.toString() 
      : formatted._id;
      
    // If the _id is already exposed, keep it as is
    // This is useful for MongoDB ObjectId which might be needed on the client
  }
  
  return formatted as T & { id: string };
}

/**
 * Format an array of MongoDB documents for API response
 * @param docs Array of MongoDB documents
 * @returns Array of formatted documents with consistent ID fields
 */
export function formatDocuments<T extends Record<string, any>>(docs: T[]): (T & { id: string })[] {
  if (!Array.isArray(docs)) return [];
  return docs.map(doc => formatDocument(doc));
}

/**
 * Log API request details for debugging
 * @param req NextRequest object
 * @param routeName Name of the API route
 */
export function logApiRequest(req: NextRequest, routeName: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${routeName} - ${req.method} ${req.url}`);
    
    // Log query parameters if any
    const url = new URL(req.url);
    if (url.search) {
      console.log('Query params:', Object.fromEntries(url.searchParams.entries()));
    }
  }
}

/**
 * Log API error for debugging
 * @param routeName Name of the API route
 * @param error Error object or message
 */
export function logApiError(routeName: string, error: any): void {
  console.error(`[${new Date().toISOString()}] ${routeName} - Error:`, error);
}
