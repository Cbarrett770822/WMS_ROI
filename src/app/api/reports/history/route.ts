import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get history of changes for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    
    logApiRequest(req, 'api/reports/history');
    
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
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    const isSharedWithUser = report.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isPublic = report.isPublic;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isPublic) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Get audit logs for this report
    const auditLogs = await mongoose.connection.collection('auditlogs').find({
      'details.reportId': reportId
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
    
    // Get total count for pagination
    const totalCount = await mongoose.connection.collection('auditlogs').countDocuments({
      'details.reportId': reportId
    });
    
    // Get user IDs from audit logs
    const userIds = [...new Set(auditLogs.map((log: any) => log.userId))];
    
    // Get user information
    const users = await User.find({
      _id: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) }
    }).select('_id name email').lean();
    
    // Create a map of user IDs to user information
    const userMap: { [key: string]: any } = {};
    users.forEach((user: any) => {
      userMap[user._id.toString()] = {
        id: user._id,
        name: user.name,
        email: user.email
      };
    });
    
    // Format history entries
    const historyEntries = auditLogs.map((log: any) => {
      const userInfo = userMap[log.userId] || { id: log.userId, name: 'Unknown User', email: '' };
      
      return {
        id: log._id,
        timestamp: log.timestamp,
        action: log.action,
        entityType: log.entityType,
        user: userInfo,
        details: log.details || {}
      };
    });
    
    // Log the audit event for viewing history
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_HISTORY,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        history: formatDocument(historyEntries),
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + limit < totalCount
        }
      },
      'Report history retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/history', error);
    return sendError(
      req, 
      `Error retrieving report history: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Add a manual history entry for a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/history');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, action, notes } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!action || action.trim().length === 0) {
      return sendError(req, 'Action is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to add history entries
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can add history entries', 403);
    }
    
    // Create a manual history entry via audit log
    const auditLog = await createAuditLog({
      userId: user.userId,
      action: AuditActions.MANUAL_ENTRY,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        action,
        notes: notes || '',
        isManualEntry: true
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        id: auditLog._id,
        timestamp: auditLog.timestamp,
        action: auditLog.action,
        entityType: auditLog.entityType,
        details: auditLog.details
      },
      'History entry added successfully'
    );
  } catch (error) {
    logApiError('api/reports/history', error);
    return sendError(
      req, 
      `Error adding history entry: ${(error as Error).message}`, 
      500
    );
  }
});
