import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Restore a report from a specific version
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/restore');
    
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
    
    // Check if user has permission to restore this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can restore versions', 403);
    }
    
    // Find the version in the report
    const version = report.versions?.find(
      (v: any) => v._id.toString() === versionId
    );
    
    if (!version) {
      return sendError(req, 'Version not found', 404);
    }
    
    // Create a backup of the current state if requested
    if (createBackup) {
      const backupData = {
        _id: new mongoose.Types.ObjectId(),
        name: `Auto-backup before restore (${new Date().toISOString().split('T')[0]})`,
        description: `Automatic backup created before restoring to version: ${version.name}`,
        sections: JSON.parse(JSON.stringify(report.sections || [])),
        createdBy: user.userId,
        createdAt: new Date()
      };
      
      // Initialize versions array if it doesn't exist
      if (!report.versions) {
        report.versions = [];
      }
      
      // Add the backup to the report versions
      report.versions.push(backupData);
    }
    
    // Restore the report sections from the version
    report.sections = JSON.parse(JSON.stringify(version.sections || []));
    
    // Update the report's lastModified date
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.RESTORE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId, 
        versionId,
        createBackup
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        versionId,
        restoredAt: report.lastModified
      },
      'Report successfully restored from version'
    );
  } catch (error) {
    logApiError('api/reports/restore', error);
    return sendError(
      req, 
      `Error restoring report: ${(error as Error).message}`, 
      500
    );
  }
});
