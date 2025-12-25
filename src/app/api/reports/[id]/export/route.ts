import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Helper function to check if user has access to the report
async function hasReportAccess(userId: string, report: any, isAdmin: boolean) {
  // Admin has access to all reports
  if (isAdmin) return true;
  
  // Creator has access
  if (report.generatedBy.toString() === userId) return true;
  
  // Users with whom the report is shared have access
  if (report.sharedWith.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Generate and export report in requested format
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').slice(-2)[0];
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'pdf';
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['pdf', 'excel', 'csv'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { message: `Invalid format. Supported formats: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report with all necessary data
    const report = await Report.findById(reportId)
      .populate({
        path: 'assessment',
        populate: [
          { path: 'company', select: 'name industry size' },
          { path: 'warehouse', select: 'name type size location' }
        ]
      })
      .populate('generatedBy', 'username firstName lastName')
      .populate('sharedWith', 'username firstName lastName');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the report
    const hasAccess = await hasReportAccess(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }

    // Log the export attempt
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.EXPORT,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { format, action: 'export-report' },
      request: req
    });

    // In a real implementation, we would generate the actual file here
    // For now, we'll return a mock response with a download URL
    
    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedReportName = report.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedReportName}_${timestamp}.${format}`;
    
    // In a real implementation, this would be a URL to the generated file
    const downloadUrl = `/api/downloads/reports/${reportId}/${filename}`;
    
    return NextResponse.json({
      message: `Report export as ${format.toUpperCase()} generated successfully`,
      downloadUrl,
      filename,
      format,
      generatedAt: new Date(),
      reportId: report._id,
      reportName: report.name
    });
  } catch (error) {
    console.error(`Error exporting report:`, error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
