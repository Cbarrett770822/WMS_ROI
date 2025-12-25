import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get a specific report template by ID
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Extract template ID from the URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const templateId = pathParts[pathParts.length - 1];
    
    logApiRequest(req, `api/reports/templates/${templateId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return sendError(req, 'Valid template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await ReportTemplate.findById(templateId).lean();
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has access to this template
    const isAdmin = user.role === 'admin';
    const isOwner = template.createdBy.toString() === user.userId;
    const isSharedWithUser = template.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isGlobal = template.isGlobal;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isGlobal) {
      return sendError(req, 'You do not have access to this template', 403);
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: templateId,
      details: { templateId },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(template),
      'Report template retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates/[id]', error);
    return sendError(
      req, 
      `Error retrieving report template: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Update a specific report template
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Extract template ID from the URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const templateId = pathParts[pathParts.length - 1];
    
    logApiRequest(req, `api/reports/templates/${templateId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return sendError(req, 'Valid template ID is required', 400);
    }
    
    // Parse request body
    const body = await req.json();
    const { name, description, sections, isGlobal, sharedWith } = body;
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await ReportTemplate.findById(templateId);
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has permission to update this template
    const isAdmin = user.role === 'admin';
    const isOwner = template.createdBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the template owner or administrators can update this template', 403);
    }
    
    // Check if user can update global status
    if (typeof isGlobal !== 'undefined' && isGlobal !== template.isGlobal && user.role !== 'admin') {
      return sendError(req, 'Only administrators can change the global status of templates', 403);
    }
    
    // Update template fields
    if (name && name.trim().length > 0) {
      template.name = name;
    }
    
    if (typeof description !== 'undefined') {
      template.description = description;
    }
    
    if (sections && Array.isArray(sections)) {
      template.sections = sections;
    }
    
    if (typeof isGlobal !== 'undefined' && user.role === 'admin') {
      template.isGlobal = isGlobal;
    }
    
    // Update shared users if provided
    if (sharedWith && Array.isArray(sharedWith)) {
      // Validate user IDs
      const validUserIds = sharedWith.filter((userId: string) => 
        mongoose.Types.ObjectId.isValid(userId)
      );
      
      template.sharedWith = validUserIds.map((userId: string) => 
        new mongoose.Types.ObjectId(userId)
      );
    }
    
    // Update last modified timestamp
    template.lastModified = new Date();
    template.lastModifiedBy = user.userId;
    
    // Save the template
    await template.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: templateId,
      details: { 
        templateId,
        name: template.name,
        isGlobal: template.isGlobal,
        sharedWithCount: template.sharedWith?.length || 0
      },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(template),
      'Report template updated successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates/[id]', error);
    return sendError(
      req, 
      `Error updating report template: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Delete a specific report template
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Extract template ID from the URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const templateId = pathParts[pathParts.length - 1];
    
    logApiRequest(req, `api/reports/templates/${templateId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return sendError(req, 'Valid template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await ReportTemplate.findById(templateId);
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has permission to delete this template
    const isAdmin = user.role === 'admin';
    const isOwner = template.createdBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the template owner or administrators can delete this template', 403);
    }
    
    // Check if template is in use
    const reportsUsingTemplate = await Report.countDocuments({ 
      'metadata.templateId': templateId 
    });
    
    if (reportsUsingTemplate > 0) {
      return sendError(
        req, 
        `Cannot delete template that is in use by ${reportsUsingTemplate} reports`, 
        400
      );
    }
    
    // Delete the template
    await ReportTemplate.findByIdAndDelete(templateId);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: templateId,
      details: { 
        templateId,
        name: template.name,
        isGlobal: template.isGlobal
      },
      request: req
    });
    
    return sendSuccess(
      req,
      { id: templateId },
      'Report template deleted successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates/[id]', error);
    return sendError(
      req, 
      `Error deleting report template: ${(error as Error).message}`, 
      500
    );
  }
});
