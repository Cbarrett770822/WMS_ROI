import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get a specific version of a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get version ID from the URL
    const versionId = req.url.split('/').pop();
    
    // Get report ID from query parameters
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, `api/reports/versions/${versionId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return sendError(req, 'Valid version ID is required', 400);
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
    
    // Find the version in the report
    const version = report.versions?.find(
      (v: any) => v._id.toString() === versionId
    );
    
    if (!version) {
      return sendError(req, 'Version not found', 404);
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionId,
      details: { reportId, versionId },
      request: req
    });
    
    return sendSuccess(
      req, 
      formatDocument(version), 
      'Report version retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions/[id]', error);
    return sendError(
      req, 
      `Error retrieving report version: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Update a specific version of a report (metadata only)
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get version ID from the URL
    const versionId = req.url.split('/').pop();
    
    logApiRequest(req, `api/reports/versions/${versionId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return sendError(req, 'Valid version ID is required', 400);
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
    
    // Check if user has permission to update this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can update versions', 403);
    }
    
    // Find the version in the report
    const versionIndex = report.versions?.findIndex(
      (v: any) => v._id.toString() === versionId
    );
    
    if (versionIndex === undefined || versionIndex === -1) {
      return sendError(req, 'Version not found', 404);
    }
    
    // Update the version metadata (name and description only)
    report.versions[versionIndex].name = name;
    report.versions[versionIndex].description = description || report.versions[versionIndex].description;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionId,
      details: { reportId, versionId },
      request: req
    });
    
    return sendSuccess(
      req, 
      formatDocument(report.versions[versionIndex]), 
      'Report version updated successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions/[id]', error);
    return sendError(
      req, 
      `Error updating report version: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Delete a specific version of a report
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get version ID from the URL
    const versionId = req.url.split('/').pop();
    
    // Get report ID from query parameters
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, `api/reports/versions/${versionId}`);
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return sendError(req, 'Valid version ID is required', 400);
    }
    
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
    
    // Check if user has permission to delete versions
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can delete versions', 403);
    }
    
    // Find the version in the report
    const versionIndex = report.versions?.findIndex(
      (v: any) => v._id.toString() === versionId
    );
    
    if (versionIndex === undefined || versionIndex === -1) {
      return sendError(req, 'Version not found', 404);
    }
    
    // Remove the version from the report
    report.versions.splice(versionIndex, 1);
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionId,
      details: { reportId, versionId },
      request: req
    });
    
    return sendSuccess(
      req, 
      { id: versionId }, 
      'Report version deleted successfully'
    );
  } catch (error) {
    logApiError('api/reports/versions/[id]', error);
    return sendError(
      req, 
      `Error deleting report version: ${(error as Error).message}`, 
      500
    );
  }
});
