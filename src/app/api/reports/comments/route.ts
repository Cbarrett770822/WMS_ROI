import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocuments, logApiRequest, logApiError } from '@/lib/apiResponse';
import { hasResourceAccess } from '@/lib/auth';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get all comments for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/comments');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId).lean();
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has access to this report
    const isPublic = report.isPublic;
    const resourceOwnerId = report.generatedBy?.toString();
    const sharedWith = report.sharedWith?.map((id: any) => id.toString()) || [];
    
    if (!hasResourceAccess(user, resourceOwnerId, isPublic, sharedWith)) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Get comments
    const comments = report.comments || [];
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req, 
      formatDocuments(comments), 
      'Comments retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/comments', error);
    return sendError(
      req, 
      `Error retrieving comments: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Add a comment to a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/comments');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, content, sectionId } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!content || content.trim().length === 0) {
      return sendError(req, 'Comment content is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has access to this report
    const isPublic = report.isPublic;
    const resourceOwnerId = report.generatedBy?.toString();
    const sharedWith = report.sharedWith?.map((id: any) => id.toString()) || [];
    
    if (!hasResourceAccess(user, resourceOwnerId, isPublic, sharedWith)) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Create the comment
    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      content,
      sectionId,
      createdBy: user.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add the comment to the report
    if (!report.comments) {
      report.comments = [];
    }
    
    report.comments.push(newComment);
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: newComment._id.toString(),
      details: { reportId, commentId: newComment._id.toString() },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocuments([newComment])[0],
      'Comment added successfully',
      201
    );
  } catch (error) {
    logApiError('api/reports/comments', error);
    return sendError(
      req, 
      `Error adding comment: ${(error as Error).message}`, 
      500
    );
  }
});
