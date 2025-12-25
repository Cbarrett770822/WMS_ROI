import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Helper function to check if user has access to a report
async function hasReportAccess(userId: string, report: any, isAdmin: boolean) {
  // Admin has access to all reports
  if (isAdmin) return true;
  
  // Creator has access
  if (report.generatedBy.toString() === userId) return true;
  
  // Users with whom the report is shared have access
  if (report.sharedWith?.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Get all versions of a report
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/versions')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId)
      .select('name generatedBy sharedWith versions')
      .lean();
      
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
    
    // If report has no versions, return empty array
    if (!report.versions || report.versions.length === 0) {
      return NextResponse.json({ versions: [] });
    }
    
    return NextResponse.json({
      versions: report.versions
    });
  } catch (error) {
    console.error('Error getting report versions:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new version of a report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/versions')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const { versionName, versionNotes } = await req.json();
    
    // Validate version name
    if (!versionName || typeof versionName !== 'string' || versionName.trim() === '') {
      return NextResponse.json(
        { message: 'Version name is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the report
      const report = await Report.findById(reportId).session(session);
        
      if (!report) {
        await session.abortTransaction();
        session.endSession();
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
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'You do not have access to this report' },
          { status: 403 }
        );
      }
      
      // Check if a version with the same name already exists
      if (report.versions?.some(v => v.name === versionName.trim())) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'A version with this name already exists' },
          { status: 409 }
        );
      }
      
      // Create a snapshot of the current report sections
      const sectionsSnapshot = JSON.parse(JSON.stringify(report.sections || []));
      
      // Create a new version
      const newVersion = {
        _id: new mongoose.Types.ObjectId(),
        name: versionName.trim(),
        notes: versionNotes?.trim() || '',
        createdBy: user.userId,
        createdAt: new Date(),
        sections: sectionsSnapshot
      };
      
      // Initialize versions array if it doesn't exist
      if (!report.versions) {
        report.versions = [];
      }
      
      // Add version to report
      report.versions.push(newVersion);
      
      // Save the report
      await report.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.CREATE,
        entityType: EntityTypes.REPORT_VERSION,
        entityId: newVersion._id,
        details: { 
          reportId,
          versionName: versionName.trim()
        },
        request: req
      });
      
      return NextResponse.json({
        message: 'Report version created successfully',
        version: newVersion
      }, { status: 201 });
    } catch (error) {
      // Abort transaction on error
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error creating report version:', error);
    
    // Handle MongoDB transaction errors with retry mechanism
    if (error.name === 'MongoError' && 
        (error.code === 112 || 
         (error.errorLabels && error.errorLabels.includes('TransientTransactionError')))) {
      return NextResponse.json(
        { message: 'Database conflict detected, please try again' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Restore a specific version of a report
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/versions')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const { versionId, createBackup } = await req.json();
    
    // Validate version ID
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return NextResponse.json(
        { message: 'Valid version ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the report
      const report = await Report.findById(reportId).session(session);
        
      if (!report) {
        await session.abortTransaction();
        session.endSession();
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
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'You do not have access to this report' },
          { status: 403 }
        );
      }
      
      // Find the version
      const version = report.versions?.find(v => v._id.toString() === versionId);
      
      if (!version) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Version not found' },
          { status: 404 }
        );
      }
      
      // Create a backup of the current state if requested
      if (createBackup) {
        // Create a snapshot of the current report sections
        const sectionsSnapshot = JSON.parse(JSON.stringify(report.sections || []));
        
        // Create a new version as backup
        const backupVersion = {
          _id: new mongoose.Types.ObjectId(),
          name: `Backup before restoring ${version.name}`,
          notes: `Automatic backup created before restoring version: ${version.name}`,
          createdBy: user.userId,
          createdAt: new Date(),
          sections: sectionsSnapshot
        };
        
        // Add backup version to report
        if (!report.versions) {
          report.versions = [];
        }
        
        report.versions.push(backupVersion);
      }
      
      // Restore the version's sections to the report
      report.sections = JSON.parse(JSON.stringify(version.sections || []));
      
      // Update the report's lastModified timestamp
      report.lastModified = new Date();
      
      // Save the report
      await report.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.UPDATE,
        entityType: EntityTypes.REPORT,
        entityId: reportId,
        details: { 
          action: 'restore-version',
          versionId,
          versionName: version.name,
          createBackup
        },
        request: req
      });
      
      return NextResponse.json({
        message: 'Report version restored successfully'
      });
    } catch (error) {
      // Abort transaction on error
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error restoring report version:', error);
    
    // Handle MongoDB transaction errors with retry mechanism
    if (error.name === 'MongoError' && 
        (error.code === 112 || 
         (error.errorLabels && error.errorLabels.includes('TransientTransactionError')))) {
      return NextResponse.json(
        { message: 'Database conflict detected, please try again' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a version of a report
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.pathname.split('/reports/')[1].split('/versions')[0];
    const versionId = url.searchParams.get('versionId');
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Validate version ID
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      return NextResponse.json(
        { message: 'Valid version ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
      
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
    
    // Find the version
    const versionIndex = report.versions?.findIndex(v => v._id.toString() === versionId);
    
    if (versionIndex === -1 || versionIndex === undefined) {
      return NextResponse.json(
        { message: 'Version not found' },
        { status: 404 }
      );
    }
    
    // Check if user is the report owner or an admin
    if (report.generatedBy.toString() !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { message: 'You are not authorized to delete this version' },
        { status: 403 }
      );
    }
    
    // Remove the version
    report.versions.splice(versionIndex, 1);
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.REPORT_VERSION,
      entityId: versionId,
      details: { reportId },
      request: req
    });
    
    return NextResponse.json({
      message: 'Report version deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report version:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
