import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Restore a specific version of a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/versions/restore');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, versionId, createBackup = true } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return sendError(req, 'Valid version ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to restore versions (owner or admin)
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can restore versions', 403);
    }
    
    // Check if report is locked
    if (report.locked && report.locked.status) {
      return sendError(req, 'Cannot restore version of a locked report', 403);
    }
    
    // Find the version to restore
    const versionToRestore = report.versions?.find(
      (v: any) => v._id.toString() === versionId
    );
    
    if (!versionToRestore) {
      return sendError(req, 'Version not found', 404);
    }
    
    // Create a backup of the current state if requested
    if (createBackup) {
      const backupVersion = {
        _id: new mongoose.Types.ObjectId(),
        name: `Backup before restoring ${versionToRestore.name}`,
        description: `Automatic backup created before restoring version: ${versionToRestore.name}`,
        sections: JSON.parse(JSON.stringify(report.sections || [])),
        createdBy: user.userId,
        createdAt: new Date(),
        isAutoBackup: true
      };
      
      if (!report.versions) {
        report.versions = [];
      }
      
      report.versions.push(backupVersion);
    }
    
    // Restore the version content
    report.sections = JSON.parse(JSON.stringify(versionToRestore.sections || []));
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.RESTORE,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionId,
      details: { 
        reportId, 
        versionId, 
        versionName: versionToRestore.name,
        createBackup
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        versionId,
        versionName: versionToRestore.name,
        restored: true,
        backupCreated: createBackup
      },
      'Report version restored successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions/restore', error);
    return sendError(
      req, 
      `Error restoring report version: ${(error as Error).message}`, 
      500
    );
  }
});
