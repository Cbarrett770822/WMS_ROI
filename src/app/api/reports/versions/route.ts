import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import { hasResourceAccess } from '@/lib/auth';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Create a new version of a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/versions');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, name, description } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!name || name.trim().length === 0) {
      return sendError(req, 'Version name is required', 400);
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
    
    // Check if user has permission to create versions (owner or admin)
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can create versions', 403);
    }
    
    // Create a snapshot of the current report state
    const versionData = {
      _id: new mongoose.Types.ObjectId(),
      name,
      description: description || '',
      sections: JSON.parse(JSON.stringify(report.sections || [])),
      createdBy: user.userId,
      createdAt: new Date()
    };
    
    // Initialize versions array if it doesn't exist
    if (!report.versions) {
      report.versions = [];
    }
    
    // Add the version to the report
    report.versions.push(versionData);
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionData._id.toString(),
      details: { reportId, versionId: versionData._id.toString() },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(versionData),
      'Report version created successfully',
      201
    );
  } catch (error) {
    logApiError('api/reports/versions', error);
    return sendError(
      req, 
      `Error creating report version: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Get all versions of a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/versions');
    
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
    
    // Get versions
    const versions = report.versions || [];
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req, 
      formatDocument(versions), 
      'Report versions retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions', error);
    return sendError(
      req, 
      `Error retrieving report versions: ${(error as Error).message}`, 
      500
    );
  }
});
