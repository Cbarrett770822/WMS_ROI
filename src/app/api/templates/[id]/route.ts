import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Template from '@/models/Template';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import { hasResourceAccess } from '@/lib/auth';

/**
 * Get a template by ID
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get template ID from the URL
    const id = req.url.split('/').pop();
    
    logApiRequest(req, `api/templates/${id}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!id) {
      return sendError(req, 'Template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await Template.findById(id).lean();
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has access to this template
    const isPublic = template.isPublic;
    const resourceOwnerId = template.createdBy?.toString();
    
    if (!hasResourceAccess(user, resourceOwnerId, isPublic)) {
      return sendError(req, 'You do not have permission to access this template', 403);
    }
    
    return sendSuccess(
      req, 
      formatDocument(template), 
      'Template retrieved successfully'
    );
  } catch (error) {
    logApiError('api/templates/[id]', error);
    return sendError(
      req, 
      `Error retrieving template: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Update a template by ID
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get template ID from the URL
    const id = req.url.split('/').pop();
    
    logApiRequest(req, `api/templates/${id}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!id) {
      return sendError(req, 'Template ID is required', 400);
    }
    
    // Parse request body
    const body = await req.json();
    const { 
      name, 
      description, 
      type, 
      content, 
      isPublic 
    } = body;
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await Template.findById(id);
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has permission to update this template
    const isAdmin = user.role === 'admin';
    const isCreator = template.createdBy?.toString() === user.userId;
    
    if (!isAdmin && !isCreator) {
      return sendError(req, 'You do not have permission to update this template', 403);
    }
    
    // Only admins can make templates public
    if (isPublic && !template.isPublic && user.role !== 'admin') {
      return sendError(req, 'Only administrators can make templates public', 403);
    }
    
    // Update the template
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (type) template.type = type;
    if (content) template.content = content;
    if (isPublic !== undefined && (isAdmin || !isPublic)) template.isPublic = isPublic;
    
    template.updatedAt = new Date();
    template.updatedBy = user.userId;
    
    // Save the updated template
    const updatedTemplate = await template.save();
    
    return sendSuccess(
      req, 
      formatDocument(updatedTemplate.toObject()), 
      'Template updated successfully'
    );
  } catch (error) {
    logApiError('api/templates/[id]', error);
    return sendError(
      req, 
      `Error updating template: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Delete a template by ID
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get template ID from the URL
    const id = req.url.split('/').pop();
    
    logApiRequest(req, `api/templates/${id}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!id) {
      return sendError(req, 'Template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await Template.findById(id);
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has permission to delete this template
    const isAdmin = user.role === 'admin';
    const isCreator = template.createdBy?.toString() === user.userId;
    
    if (!isAdmin && !isCreator) {
      return sendError(req, 'You do not have permission to delete this template', 403);
    }
    
    // Check if this is a system template
    if (template.isSystem) {
      return sendError(req, 'System templates cannot be deleted', 403);
    }
    
    // Delete the template
    await Template.findByIdAndDelete(id);
    
    return sendSuccess(
      req, 
      { id }, 
      'Template deleted successfully'
    );
  } catch (error) {
    logApiError('api/templates/[id]', error);
    return sendError(
      req, 
      `Error deleting template: ${(error as Error).message}`, 
      500
    );
  }
});
