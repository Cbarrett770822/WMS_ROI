import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Export a report in the specified format
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/export');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, format, versionId } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!format || !['pdf', 'excel', 'csv', 'json'].includes(format)) {
      return sendError(req, 'Valid format is required (pdf, excel, csv, json)', 400);
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
    
    // If a version ID is provided, use that version's data instead of the current report
    let reportData = report;
    
    if (versionId && mongoose.Types.ObjectId.isValid(versionId)) {
      const version = report.versions?.find(
        (v: any) => v._id.toString() === versionId
      );
      
      if (!version) {
        return sendError(req, 'Version not found', 404);
      }
      
      // Create a merged object with report metadata and version sections
      reportData = {
        ...report,
        sections: version.sections,
        exportedFromVersion: {
          id: version._id,
          name: version.name,
          createdAt: version.createdAt
        }
      };
    }
    
    // Generate export data based on format
    let exportData: any;
    let fileName: string;
    let contentType: string;
    
    switch (format) {
      case 'json':
        exportData = JSON.stringify(reportData, null, 2);
        fileName = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        contentType = 'application/json';
        break;
        
      case 'pdf':
        // In a real implementation, we would generate a PDF here
        // For now, we'll return a placeholder with instructions
        exportData = JSON.stringify({
          message: 'PDF generation would happen here in production',
          reportId,
          format,
          timestamp: new Date().toISOString()
        });
        fileName = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        contentType = 'application/pdf';
        break;
        
      case 'excel':
        // In a real implementation, we would generate an Excel file here
        // For now, we'll return a placeholder with instructions
        exportData = JSON.stringify({
          message: 'Excel generation would happen here in production',
          reportId,
          format,
          timestamp: new Date().toISOString()
        });
        fileName = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
        
      case 'csv':
        // In a real implementation, we would generate a CSV here
        // For now, we'll return a placeholder with instructions
        exportData = JSON.stringify({
          message: 'CSV generation would happen here in production',
          reportId,
          format,
          timestamp: new Date().toISOString()
        });
        fileName = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        contentType = 'text/csv';
        break;
        
      default:
        return sendError(req, 'Unsupported export format', 400);
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.EXPORT,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId, 
        format,
        versionId: versionId || 'current'
      },
      request: req
    });
    
    // In a real implementation, we would return the file for download
    // For now, we'll return a success response with the export data
    return sendSuccess(
      req,
      {
        fileName,
        contentType,
        exportData,
        format,
        exportedAt: new Date().toISOString(),
        // In production, this would be a download URL or base64 encoded file content
        downloadUrl: `/api/reports/download/${reportId}?format=${format}${versionId ? `&versionId=${versionId}` : ''}`
      },
      `Report exported successfully as ${format.toUpperCase()}`
    );
  } catch (error) {
    logApiError('api/reports/export', error);
    return sendError(
      req, 
      `Error exporting report: ${(error as Error).message}`, 
      500
    );
  }
});
