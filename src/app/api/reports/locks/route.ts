import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Lock or unlock a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/locks');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, action } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!action || !['lock', 'unlock'].includes(action)) {
      return sendError(req, 'Valid action is required (lock or unlock)', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to lock/unlock this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can lock or unlock reports', 403);
    }
    
    // Handle lock action
    if (action === 'lock') {
      // Check if report is already locked
      if (report.isLocked) {
        // If locked by the same user, just update the lock time
        if (report.lockedBy?.toString() === user.userId) {
          report.lockedAt = new Date();
          await report.save();
          
          return sendSuccess(
            req,
            formatDocument({
              reportId,
              isLocked: true,
              lockedBy: user.userId,
              lockedAt: report.lockedAt
            }),
            'Report lock refreshed successfully'
          );
        } else {
          // If locked by another user, return error
          return sendError(
            req,
            `Report is already locked by another user since ${report.lockedAt}`,
            409
          );
        }
      }
      
      // Lock the report
      report.isLocked = true;
      report.lockedBy = user.userId;
      report.lockedAt = new Date();
      await report.save();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.LOCK,
        entityType: EntityTypes.REPORT,
        entityId: reportId,
        details: { reportId },
        request: req
      });
      
      return sendSuccess(
        req,
        formatDocument({
          reportId,
          isLocked: true,
          lockedBy: user.userId,
          lockedAt: report.lockedAt
        }),
        'Report locked successfully'
      );
    }
    // Handle unlock action
    else if (action === 'unlock') {
      // Check if report is not locked
      if (!report.isLocked) {
        return sendSuccess(
          req,
          formatDocument({
            reportId,
            isLocked: false
          }),
          'Report is already unlocked'
        );
      }
      
      // Check if locked by another user (only admins can override)
      if (report.lockedBy?.toString() !== user.userId && !isAdmin) {
        return sendError(
          req,
          `Report is locked by another user and can only be unlocked by that user or an administrator`,
          403
        );
      }
      
      // Unlock the report
      report.isLocked = false;
      report.lockedBy = undefined;
      report.lockedAt = undefined;
      await report.save();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.UNLOCK,
        entityType: EntityTypes.REPORT,
        entityId: reportId,
        details: { 
          reportId,
          overrideUnlock: report.lockedBy?.toString() !== user.userId
        },
        request: req
      });
      
      return sendSuccess(
        req,
        formatDocument({
          reportId,
          isLocked: false
        }),
        'Report unlocked successfully'
      );
    }
    
    // This should never happen due to validation above
    return sendError(req, 'Invalid action', 400);
  } catch (error) {
    logApiError('api/reports/locks', error);
    return sendError(
      req, 
      `Error managing report lock: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Get lock status for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/locks');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId)
      .populate('lockedBy', 'name email')
      .lean();
    
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
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_LOCK,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument({
        reportId,
        isLocked: report.isLocked || false,
        lockedBy: report.lockedBy,
        lockedAt: report.lockedAt,
        canUnlock: isAdmin || (isOwner && report.lockedBy?.toString() === user.userId)
      }),
      'Lock status retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/locks', error);
    return sendError(
      req, 
      `Error retrieving lock status: ${(error as Error).message}`, 
      500
    );
  }
});
