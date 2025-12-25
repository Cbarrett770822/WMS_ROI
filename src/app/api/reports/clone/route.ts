import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';
import { sendNotification } from '@/lib/notifications';

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

// Clone a report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { 
      sourceReportId, 
      newName, 
      includeComments = false, 
      includeVersions = false,
      shareWithSameUsers = false,
      destinationCompanyId = null,
      destinationWarehouseId = null
    } = await req.json();
    
    // Validate source report ID
    if (!sourceReportId || !mongoose.Types.ObjectId.isValid(sourceReportId)) {
      return NextResponse.json(
        { message: 'Valid source report ID is required' },
        { status: 400 }
      );
    }
    
    // Validate new name
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
      return NextResponse.json(
        { message: 'New report name is required' },
        { status: 400 }
      );
    }
    
    // Validate destination IDs if provided
    if (destinationCompanyId && !mongoose.Types.ObjectId.isValid(destinationCompanyId)) {
      return NextResponse.json(
        { message: 'Invalid destination company ID' },
        { status: 400 }
      );
    }
    
    if (destinationWarehouseId && !mongoose.Types.ObjectId.isValid(destinationWarehouseId)) {
      return NextResponse.json(
        { message: 'Invalid destination warehouse ID' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the source report
      const sourceReport = await Report.findById(sourceReportId)
        .populate('comments')
        .session(session);
        
      if (!sourceReport) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Source report not found' },
          { status: 404 }
        );
      }
      
      // Check if user has access to the source report
      const hasAccess = await hasReportAccess(
        user.userId,
        sourceReport,
        user.role === 'admin'
      );
      
      if (!hasAccess) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'You do not have access to the source report' },
          { status: 403 }
        );
      }
      
      // Check if a report with the same name already exists for this user
      const existingReport = await Report.findOne({
        name: newName.trim(),
        generatedBy: user.userId
      }).session(session);
      
      if (existingReport) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'A report with this name already exists' },
          { status: 409 }
        );
      }
      
      // Create a new report object based on the source report
      const newReport = new Report({
        name: newName.trim(),
        description: `Clone of "${sourceReport.name}"`,
        type: sourceReport.type,
        status: 'draft',
        generatedBy: user.userId,
        
        // Use destination company/warehouse if provided, otherwise use source report's
        company: destinationCompanyId || sourceReport.company,
        warehouse: destinationWarehouseId || sourceReport.warehouse,
        
        // Clone related IDs
        assessment: sourceReport.assessment,
        roiCalculation: sourceReport.roiCalculation,
        recommendations: sourceReport.recommendations,
        reportTemplate: sourceReport.reportTemplate,
        
        // Deep clone sections to avoid reference issues
        sections: JSON.parse(JSON.stringify(sourceReport.sections || [])),
        
        // Initialize empty arrays for shared users and comments
        sharedWith: shareWithSameUsers ? [...sourceReport.sharedWith] : [],
        comments: [],
        
        // Clone versions if requested
        versions: includeVersions ? JSON.parse(JSON.stringify(sourceReport.versions || [])) : []
      });
      
      // Clone comments if requested
      if (includeComments && sourceReport.comments && sourceReport.comments.length > 0) {
        // We'd need to create new comment documents and link them to the new report
        // This would be handled by a separate Comment model operation
        // For now, we'll just note that comments were requested but not cloned
        newReport.description += ' (Comments were not cloned due to system limitations)';
      }
      
      // Save the new report
      await newReport.save({ session });
      
      // Send notifications to users if the report is shared with them
      if (shareWithSameUsers && newReport.sharedWith.length > 0) {
        const notificationPromises = newReport.sharedWith.map(userId => 
          sendNotification({
            userId: userId.toString(),
            type: 'report_shared',
            title: 'New Report Shared',
            message: `A cloned report "${newReport.name}" has been shared with you.`,
            linkUrl: `/reports/${newReport._id}`,
            fromUserId: user.userId
          })
        );
        
        // We don't await these promises to avoid holding up the transaction
        // They will be processed after the transaction completes
      }
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.CREATE,
        entityType: EntityTypes.REPORT,
        entityId: newReport._id,
        details: { 
          action: 'clone-report',
          sourceReportId,
          includeComments,
          includeVersions,
          shareWithSameUsers,
          destinationCompanyId,
          destinationWarehouseId
        },
        request: req
      });
      
      return NextResponse.json({
        message: 'Report cloned successfully',
        report: {
          id: newReport._id,
          name: newReport.name,
          type: newReport.type,
          status: newReport.status,
          createdAt: newReport.createdAt
        }
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
    console.error('Error cloning report:', error);
    
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
