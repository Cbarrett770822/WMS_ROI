import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Lock or unlock a report to prevent or allow edits
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/lock');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, lock, reason } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (typeof lock !== 'boolean') {
      return sendError(req, 'Lock parameter must be a boolean', 400);
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
      return sendError(req, 'Only the report owner or administrators can lock or unlock this report', 403);
    }
    
    // Check if report is already in the desired lock state
    if (report.locked === lock) {
      return sendSuccess(
        req,
        {
          reportId,
          locked: report.locked,
          alreadyInDesiredState: true
        },
        report.locked ? 'Report is already locked' : 'Report is already unlocked'
      );
    }
    
    // Update report lock status
    report.locked = lock;
    
    // Update lock metadata
    if (lock) {
      report.lockInfo = {
        lockedBy: user.userId,
        lockedAt: new Date(),
        reason: reason || 'Report finalized'
      };
    } else {
      report.lockInfo = {
        unlockedBy: user.userId,
        unlockedAt: new Date(),
        previousLockReason: report.lockInfo?.reason || '',
        reason: reason || 'Report reopened for edits'
      };
    }
    
    // Update report timestamps
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: lock ? AuditActions.LOCK : AuditActions.UNLOCK,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        locked: lock,
        reason: reason || (lock ? 'Report finalized' : 'Report reopened for edits')
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        locked: report.locked,
        lockInfo: report.lockInfo
      },
      lock ? 'Report locked successfully' : 'Report unlocked successfully'
    );
  } catch (error) {
    logApiError('api/reports/lock', error);
    return sendError(
      req, 
      `Error ${body?.lock ? 'locking' : 'unlocking'} report: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Get the lock status of a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/lock');
    
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
      .select('locked lockInfo generatedBy sharedWith editors viewers isPublic')
      .lean();
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has access to this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    const isSharedWithUser = report.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isEditor = report.editors?.some((id: any) => id.toString() === user.userId);
    const isViewer = report.viewers?.some((id: any) => id.toString() === user.userId);
    const isPublic = report.isPublic;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isEditor && !isViewer && !isPublic) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Determine if the user can lock/unlock the report
    const canModifyLock = isAdmin || isOwner;
    
    return sendSuccess(
      req,
      {
        reportId,
        locked: report.locked || false,
        lockInfo: report.lockInfo || {},
        canModifyLock
      },
      'Report lock status retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/lock', error);
    return sendError(
      req, 
      `Error retrieving report lock status: ${(error as Error).message}`, 
      500
    );
  }
});
