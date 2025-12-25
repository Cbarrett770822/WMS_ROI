import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
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

// Perform bulk operations on reports
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { operation, reportIds, data } = await req.json();
    
    // Validate required fields
    if (!operation || typeof operation !== 'string') {
      return NextResponse.json(
        { message: 'Valid operation is required' },
        { status: 400 }
      );
    }

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json(
        { message: 'At least one report ID is required' },
        { status: 400 }
      );
    }

    // Validate all report IDs
    for (const id of reportIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { message: `Invalid report ID: ${id}` },
          { status: 400 }
        );
      }
    }

    // Connect to the database
    await connectToDatabase();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find all the specified reports
      const reports = await Report.find({
        _id: { $in: reportIds }
      })
        .session(session)
        .lean();
        
      if (!reports || reports.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'No valid reports found' },
          { status: 404 }
        );
      }

      // Check if user has access to all reports
      const isAdmin = user.role === 'admin';
      
      // For non-admin users, filter reports they have access to
      let accessibleReports = reports;
      if (!isAdmin) {
        accessibleReports = reports.filter(report => 
          report.generatedBy.toString() === user.userId || 
          report.sharedWith?.some((id: any) => id.toString() === user.userId)
        );
        
        if (accessibleReports.length === 0) {
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: 'You do not have access to any of the specified reports' },
            { status: 403 }
          );
        }
        
        if (accessibleReports.length !== reports.length) {
          // Some reports are not accessible, inform the user
          const accessibleIds = accessibleReports.map(r => r._id.toString());
          const inaccessibleIds = reportIds.filter(id => !accessibleIds.includes(id.toString()));
          
          // If this is a delete operation, only proceed with accessible reports
          if (operation !== 'delete') {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { 
                message: 'You do not have access to some of the specified reports',
                inaccessibleReportIds: inaccessibleIds
              },
              { status: 403 }
            );
          }
        }
      }

      // Process based on operation
      let result;
      let auditDetails = {};
      
      switch (operation) {
        case 'delete':
          // Delete reports (only accessible ones for non-admin users)
          const reportIdsToDelete = accessibleReports.map(r => r._id);
          result = await Report.deleteMany({
            _id: { $in: reportIdsToDelete }
          }).session(session);
          
          auditDetails = {
            action: 'bulk-delete',
            reportCount: reportIdsToDelete.length,
            reportIds: reportIdsToDelete
          };
          break;
          
        case 'share':
          // Validate share data
          if (!data || !Array.isArray(data.userIds) || data.userIds.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'User IDs are required for share operation' },
              { status: 400 }
            );
          }
          
          // Validate all user IDs
          for (const id of data.userIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
              await session.abortTransaction();
              session.endSession();
              return NextResponse.json(
                { message: `Invalid user ID: ${id}` },
                { status: 400 }
              );
            }
          }
          
          // Check if all users exist
          const users = await User.find({
            _id: { $in: data.userIds }
          })
            .session(session)
            .lean();
            
          if (!users || users.length !== data.userIds.length) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'Some user IDs are invalid' },
              { status: 400 }
            );
          }
          
          // Share reports with users
          const reportIdsToShare = accessibleReports.map(r => r._id);
          result = await Report.updateMany(
            { _id: { $in: reportIdsToShare } },
            { $addToSet: { sharedWith: { $each: data.userIds } } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-share',
            reportCount: reportIdsToShare.length,
            reportIds: reportIdsToShare,
            sharedWithUsers: data.userIds
          };
          
          // Send notifications to users
          const notificationPromises = [];
          for (const reportId of reportIdsToShare) {
            const report = reports.find(r => r._id.toString() === reportId.toString());
            if (report) {
              for (const userId of data.userIds) {
                notificationPromises.push(
                  sendNotification({
                    userId,
                    type: 'report_shared',
                    title: 'Report Shared With You',
                    message: `A report "${report.name}" has been shared with you.`,
                    data: {
                      reportId: report._id.toString(),
                      reportName: report.name,
                      sharedBy: user.userId
                    }
                  })
                );
              }
            }
          }
          
          // We don't await these to avoid transaction timeout
          // They will be processed after the transaction completes
          break;
          
        case 'unshare':
          // Validate unshare data
          if (!data || !Array.isArray(data.userIds) || data.userIds.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'User IDs are required for unshare operation' },
              { status: 400 }
            );
          }
          
          // Validate all user IDs
          for (const id of data.userIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
              await session.abortTransaction();
              session.endSession();
              return NextResponse.json(
                { message: `Invalid user ID: ${id}` },
                { status: 400 }
              );
            }
          }
          
          // Unshare reports from users
          const reportIdsToUnshare = accessibleReports.map(r => r._id);
          result = await Report.updateMany(
            { _id: { $in: reportIdsToUnshare } },
            { $pullAll: { sharedWith: data.userIds } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-unshare',
            reportCount: reportIdsToUnshare.length,
            reportIds: reportIdsToUnshare,
            unsharedFromUsers: data.userIds
          };
          break;
          
        case 'update-status':
          // Validate status data
          if (!data || !data.status || !['draft', 'published', 'archived'].includes(data.status)) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'Valid status is required for update-status operation' },
              { status: 400 }
            );
          }
          
          // Update report status
          const reportIdsToUpdate = accessibleReports.map(r => r._id);
          result = await Report.updateMany(
            { _id: { $in: reportIdsToUpdate } },
            { $set: { status: data.status } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-update-status',
            reportCount: reportIdsToUpdate.length,
            reportIds: reportIdsToUpdate,
            newStatus: data.status
          };
          break;
          
        default:
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: `Unsupported operation: ${operation}` },
            { status: 400 }
          );
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.BULK_UPDATE,
        entityType: EntityTypes.REPORT,
        details: auditDetails,
        request: req
      });

      // Send notifications after transaction completes if needed
      if (operation === 'share' && notificationPromises?.length > 0) {
        await Promise.allSettled(notificationPromises);
      }

      return NextResponse.json({
        message: `Bulk ${operation} operation completed successfully`,
        affectedReports: accessibleReports.length,
        result
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
    console.error(`Error performing bulk operation on reports:`, error);
    
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
