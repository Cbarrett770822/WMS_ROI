import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://roi-warehouse-assessment.vercel.app',
  'https://roi-warehouse-assessment.netlify.app'
];

// Define default CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // This will be replaced with the actual origin if it's in the allowed list
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400' // 24 hours
};

/**
 * Middleware to handle CORS for API routes
 * @param req NextRequest object
 * @returns NextResponse with appropriate CORS headers
 */
export function handleCORS(req: NextRequest) {
  // Get the origin from the request headers
  const origin = req.headers.get('origin') || '';
  
  // Check if the origin is in the allowed list
  if (allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow any origin
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  } else {
    // In production, only allow from the allowed origins list
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigins[0];
  }
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  return null;
}

/**
 * Add CORS headers to a response
 * @param response NextResponse object
 * @param req NextRequest object
 * @returns NextResponse with CORS headers
 */
export function addCORSHeaders(response: NextResponse, req: NextRequest) {
  // Get the origin from the request headers
  const origin = req.headers.get('origin') || '';
  
  // Set the appropriate Access-Control-Allow-Origin header
  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  
  // Set other CORS headers
  response.headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  response.headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  response.headers.set('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);
  response.headers.set('Access-Control-Max-Age', corsHeaders['Access-Control-Max-Age']);
  
  return response;
}

/**
 * Higher-order function to wrap API route handlers with CORS support
 * @param handler API route handler function
 * @returns Wrapped handler function with CORS support
 */
export function withCORS(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(req: NextRequest) {
    // Handle preflight OPTIONS request
    const corsResponse = handleCORS(req);
    if (corsResponse) {
      return corsResponse;
    }
    
    // Process the request with the original handler
    const response = await handler(req);
    
    // Add CORS headers to the response
    return addCORSHeaders(response, req);
  };
}
