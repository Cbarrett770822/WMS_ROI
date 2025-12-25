import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Template from '@/models/Template';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocuments, logApiRequest, logApiError } from '@/lib/apiResponse';

/**
 * Get all report templates
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/templates');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Build query based on user role and query parameters
    const isAdmin = user.role === 'admin';
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    
    let query: any = {};
    
    // Filter by template type if provided
    if (type) {
      query.type = type;
    }
    
    // Regular users can only see public templates and their own templates
    if (!isAdmin) {
      query.$or = [
        { isPublic: true },
        { createdBy: user.userId }
      ];
    }
    
    // Get templates
    const templates = await Template.find(query)
      .sort({ name: 1 })
      .lean();
    
    return sendSuccess(
      req, 
      formatDocuments(templates), 
      'Templates retrieved successfully'
    );
  } catch (error) {
    logApiError('api/templates', error);
    return sendError(
      req, 
      `Error retrieving templates: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Create a new template
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/templates');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { 
      name, 
      description, 
      type, 
      content, 
      isPublic = false 
    } = body;
    
    // Validate required fields
    if (!name) {
      return sendError(req, 'Template name is required', 400);
    }
    
    if (!type) {
      return sendError(req, 'Template type is required', 400);
    }
    
    if (!content) {
      return sendError(req, 'Template content is required', 400);
    }
    
    // Only admins can create public templates
    if (isPublic && user.role !== 'admin') {
      return sendError(req, 'Only administrators can create public templates', 403);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Check if a template with the same name already exists
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      return sendError(req, 'A template with this name already exists', 409);
    }
    
    // Create the template
    const template = new Template({
      name,
      description,
      type,
      content,
      isPublic,
      createdBy: user.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save the template
    const savedTemplate = await template.save();
    
    return sendSuccess(
      req,
      formatDocuments([savedTemplate.toObject()])[0],
      'Template created successfully',
      201
    );
  } catch (error) {
    logApiError('api/templates', error);
    return sendError(
      req, 
      `Error creating template: ${(error as Error).message}`, 
      500
    );
  }
});
