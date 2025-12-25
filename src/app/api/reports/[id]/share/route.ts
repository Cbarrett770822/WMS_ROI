import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Helper function to check if user has access to modify report sharing
async function canModifyReportSharing(userId: string, report: any, isAdmin: boolean) {
  // Admin can modify any report sharing
  if (isAdmin) return true;
  
  // Creator can modify report sharing
  if (report.generatedBy.toString() === userId) return true;
  
  return false;
}

// Get users with whom the report is shared
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').slice(-2)[0];
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report
    const report = await Report.findById(reportId)
      .populate('sharedWith', 'username firstName lastName email role');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to view sharing information
    const hasAccess = await canModifyReportSharing(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess && !report.sharedWith.some((u: any) => u._id.toString() === user.userId)) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { action: 'view-report-sharing' },
      request: req
    });

    return NextResponse.json({ 
      sharedWith: report.sharedWith,
      canModifySharing: hasAccess
    });
  } catch (error) {
    console.error('Error fetching report sharing:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Share report with users
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').slice(-2)[0];
    const { userIds, message } = await req.json();
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { message: 'User IDs are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report
    const report = await Report.findById(reportId)
      .populate('assessment', 'name')
      .populate('generatedBy', 'username firstName lastName');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to share this report
    const hasAccess = await canModifyReportSharing(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have permission to share this report' },
        { status: 403 }
      );
    }

    // Validate all user IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: 'Invalid user IDs provided', invalidIds },
        { status: 400 }
      );
    }

    // Find users to share with
    const usersToShare = await User.find({ _id: { $in: userIds } });
    
    if (usersToShare.length === 0) {
      return NextResponse.json(
        { message: 'No valid users found to share with' },
        { status: 404 }
      );
    }

    // Get existing shared user IDs as strings
    const existingSharedUserIds = report.sharedWith.map((id: any) => 
      id.toString ? id.toString() : id
    );

    // Filter out users who already have access
    const newUsers = usersToShare.filter(u => 
      !existingSharedUserIds.includes(u._id.toString())
    );

    if (newUsers.length === 0) {
      return NextResponse.json(
        { message: 'Report is already shared with all specified users' },
        { status: 200 }
      );
    }

    // Add new users to sharedWith array
    const newUserIds = newUsers.map(u => u._id);
    report.sharedWith.push(...newUserIds);
    
    await report.save();

    // Send notifications to newly added users
    const sharer = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.username;
      
    const notificationTitle = `Report shared with you`;
    const notificationMessage = message || 
      `${sharer} has shared the report "${report.name}" for assessment "${report.assessment.name}" with you.`;
    
    for (const newUser of newUsers) {
      await sendNotification({
        recipientId: newUser._id,
        senderId: user.userId,
        type: 'report_shared',
        title: notificationTitle,
        message: notificationMessage,
        entityType: 'report',
        entityId: report._id
      });
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        action: 'share-report', 
        sharedWith: newUsers.map(u => u._id.toString()),
        sharedWithCount: newUsers.length
      },
      request: req
    });

    return NextResponse.json({
      message: `Report successfully shared with ${newUsers.length} user(s)`,
      sharedWith: newUsers.map(u => ({
        _id: u._id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email
      }))
    });
  } catch (error) {
    console.error('Error sharing report:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Remove users from report sharing
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').slice(-2)[0];
    const url = new URL(req.url);
    const userIdsParam = url.searchParams.get('userIds');
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    if (!userIdsParam) {
      return NextResponse.json(
        { message: 'User IDs are required as query parameters' },
        { status: 400 }
      );
    }

    const userIds = userIdsParam.split(',');
    
    // Validate all user IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: 'Invalid user IDs provided', invalidIds },
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

    // Check if user has access to modify sharing for this report
    const hasAccess = await canModifyReportSharing(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have permission to modify sharing for this report' },
        { status: 403 }
      );
    }

    // Remove users from sharedWith array
    report.sharedWith = report.sharedWith.filter((id: any) => 
      !userIds.includes(id.toString())
    );
    
    await report.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        action: 'unshare-report', 
        removedUsers: userIds,
        removedCount: userIds.length
      },
      request: req
    });

    return NextResponse.json({
      message: `Successfully removed ${userIds.length} user(s) from report sharing`,
      removedUserIds: userIds
    });
  } catch (error) {
    console.error('Error removing users from report sharing:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
