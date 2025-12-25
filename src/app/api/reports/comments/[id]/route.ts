import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Update a comment in a report
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get comment ID from the URL
    const commentId = req.url.split('/').pop();
    
    logApiRequest(req, `api/reports/comments/${commentId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return sendError(req, 'Valid comment ID is required', 400);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, content } = body;
    
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
    
    // Find the comment in the report
    const commentIndex = report.comments?.findIndex(
      (c: any) => c._id.toString() === commentId
    );
    
    if (commentIndex === undefined || commentIndex === -1) {
      return sendError(req, 'Comment not found', 404);
    }
    
    const comment = report.comments[commentIndex];
    
    // Check if user has permission to update this comment
    const isAdmin = user.role === 'admin';
    const isCreator = comment.createdBy.toString() === user.userId;
    
    if (!isAdmin && !isCreator) {
      return sendError(req, 'You do not have permission to update this comment', 403);
    }
    
    // Update the comment
    comment.content = content;
    comment.updatedAt = new Date();
    comment.updatedBy = user.userId;
    
    // Save the report with the updated comment
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: commentId,
      details: { reportId, commentId },
      request: req
    });
    
    return sendSuccess(
      req, 
      formatDocument(comment), 
      'Comment updated successfully'
    );
  } catch (error) {
    logApiError('api/reports/comments/[id]', error);
    return sendError(
      req, 
      `Error updating comment: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Delete a comment from a report
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get comment ID from the URL
    const commentId = req.url.split('/').pop();
    
    logApiRequest(req, `api/reports/comments/${commentId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return sendError(req, 'Valid comment ID is required', 400);
    }
    
    // Get report ID from query parameters
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Find the comment in the report
    const commentIndex = report.comments?.findIndex(
      (c: any) => c._id.toString() === commentId
    );
    
    if (commentIndex === undefined || commentIndex === -1) {
      return sendError(req, 'Comment not found', 404);
    }
    
    const comment = report.comments[commentIndex];
    
    // Check if user has permission to delete this comment
    const isAdmin = user.role === 'admin';
    const isCreator = comment.createdBy.toString() === user.userId;
    const isReportOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isCreator && !isReportOwner) {
      return sendError(req, 'You do not have permission to delete this comment', 403);
    }
    
    // Remove the comment from the report
    report.comments.splice(commentIndex, 1);
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: commentId,
      details: { reportId, commentId },
      request: req
    });
    
    return sendSuccess(
      req, 
      { id: commentId }, 
      'Comment deleted successfully'
    );
  } catch (error) {
    logApiError('api/reports/comments/[id]', error);
    return sendError(
      req, 
      `Error deleting comment: ${(error as Error).message}`, 
      500
    );
  }
});
