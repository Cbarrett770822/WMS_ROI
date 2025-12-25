import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Share a report with other users
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/share');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, userIds, message } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return sendError(req, 'At least one user ID is required', 400);
    }
    
    // Validate all user IDs
    const invalidUserIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidUserIds.length > 0) {
      return sendError(req, 'One or more user IDs are invalid', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to share this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'You do not have permission to share this report', 403);
    }
    
    // Check if all users exist
    const users = await User.find({ _id: { $in: userIds } });
    
    if (users.length !== userIds.length) {
      return sendError(req, 'One or more users not found', 404);
    }
    
    // Initialize sharedWith array if it doesn't exist
    if (!report.sharedWith) {
      report.sharedWith = [];
    }
    
    // Add users to sharedWith array if not already present
    const existingSharedWith = report.sharedWith.map((id: any) => id.toString());
    const newUserIds = userIds.filter(id => !existingSharedWith.includes(id));
    
    report.sharedWith.push(...newUserIds.map(id => new mongoose.Types.ObjectId(id)));
    
    // Add sharing record to shareHistory
    if (!report.shareHistory) {
      report.shareHistory = [];
    }
    
    report.shareHistory.push({
      sharedBy: new mongoose.Types.ObjectId(user.userId),
      sharedWith: newUserIds.map(id => new mongoose.Types.ObjectId(id)),
      message: message || '',
      sharedAt: new Date()
    });
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.SHARE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { reportId, sharedWith: newUserIds },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        sharedWith: report.sharedWith,
        newlyShared: newUserIds
      },
      'Report shared successfully'
    );
  } catch (error) {
    logApiError('api/reports/share', error);
    return sendError(
      req, 
      `Error sharing report: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Unshare a report (remove users from sharing)
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/share');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, userIds } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return sendError(req, 'At least one user ID is required', 400);
    }
    
    // Validate all user IDs
    const invalidUserIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidUserIds.length > 0) {
      return sendError(req, 'One or more user IDs are invalid', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to unshare this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'You do not have permission to unshare this report', 403);
    }
    
    // Remove users from sharedWith array
    if (report.sharedWith && report.sharedWith.length > 0) {
      report.sharedWith = report.sharedWith.filter(
        (id: any) => !userIds.includes(id.toString())
      );
      
      // Add unsharing record to shareHistory
      if (!report.shareHistory) {
        report.shareHistory = [];
      }
      
      report.shareHistory.push({
        sharedBy: new mongoose.Types.ObjectId(user.userId),
        unsharedWith: userIds.map(id => new mongoose.Types.ObjectId(id)),
        action: 'unshare',
        sharedAt: new Date()
      });
      
      // Save the report
      await report.save();
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UNSHARE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { reportId, unsharedWith: userIds },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        sharedWith: report.sharedWith
      },
      'Report unshared successfully'
    );
  } catch (error) {
    logApiError('api/reports/share', error);
    return sendError(
      req, 
      `Error unsharing report: ${(error as Error).message}`, 
      500
    );
  }
});
