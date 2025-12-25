import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Subscribe to notifications for a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/notifications');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, notificationTypes = ['all'] } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Validate notification types
    const validTypes = ['all', 'comments', 'shares', 'updates', 'versions'];
    const invalidTypes = notificationTypes.filter((type: string) => !validTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return sendError(req, `Invalid notification types: ${invalidTypes.join(', ')}`, 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
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
    
    // Initialize notifications array if it doesn't exist
    if (!report.notifications) {
      report.notifications = [];
    }
    
    // Check if user is already subscribed
    const existingSubscription = report.notifications.find(
      (notification: any) => notification.userId.toString() === user.userId
    );
    
    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.types = notificationTypes;
      existingSubscription.updatedAt = new Date();
    } else {
      // Add new subscription
      report.notifications.push({
        userId: new mongoose.Types.ObjectId(user.userId),
        types: notificationTypes,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.SUBSCRIBE,
      entityType: EntityTypes.REPORT_NOTIFICATIONS,
      entityId: reportId,
      details: { reportId, notificationTypes },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        userId: user.userId,
        notificationTypes,
        subscribed: true
      },
      'Successfully subscribed to report notifications'
    );
  } catch (error) {
    logApiError('api/reports/notifications', error);
    return sendError(
      req, 
      `Error subscribing to notifications: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Get notification subscriptions for a user
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/notifications');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // If reportId is provided, get subscription for a specific report
    if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
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
      
      // Find user's subscription
      const subscription = report.notifications?.find(
        (notification: any) => notification.userId.toString() === user.userId
      );
      
      return sendSuccess(
        req,
        {
          reportId,
          userId: user.userId,
          subscribed: !!subscription,
          notificationTypes: subscription ? subscription.types : [],
          updatedAt: subscription ? subscription.updatedAt : null
        },
        'Notification subscription retrieved successfully'
      );
    } 
    // Otherwise, get all subscriptions for the user
    else {
      // Find all reports where the user is subscribed to notifications
      const reports = await Report.find({
        'notifications.userId': new mongoose.Types.ObjectId(user.userId)
      }).select('_id title notifications').lean();
      
      // Extract subscription information
      const subscriptions = reports.map((report: any) => {
        const subscription = report.notifications.find(
          (notification: any) => notification.userId.toString() === user.userId
        );
        
        return {
          reportId: report._id,
          title: report.title,
          notificationTypes: subscription ? subscription.types : [],
          updatedAt: subscription ? subscription.updatedAt : null
        };
      });
      
      return sendSuccess(
        req,
        formatDocument(subscriptions),
        'All notification subscriptions retrieved successfully'
      );
    }
  } catch (error) {
    logApiError('api/reports/notifications', error);
    return sendError(
      req, 
      `Error retrieving notifications: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Unsubscribe from notifications for a report
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/notifications');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
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
    
    // Check if notifications array exists
    if (!report.notifications || report.notifications.length === 0) {
      return sendSuccess(
        req,
        { reportId, unsubscribed: false },
        'No subscription found'
      );
    }
    
    // Find the index of the user's subscription
    const subscriptionIndex = report.notifications.findIndex(
      (notification: any) => notification.userId.toString() === user.userId
    );
    
    // If subscription exists, remove it
    if (subscriptionIndex !== -1) {
      report.notifications.splice(subscriptionIndex, 1);
      await report.save();
      
      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.UNSUBSCRIBE,
        entityType: EntityTypes.REPORT_NOTIFICATIONS,
        entityId: reportId,
        details: { reportId },
        request: req
      });
      
      return sendSuccess(
        req,
        { reportId, unsubscribed: true },
        'Successfully unsubscribed from report notifications'
      );
    } else {
      return sendSuccess(
        req,
        { reportId, unsubscribed: false },
        'No subscription found'
      );
    }
  } catch (error) {
    logApiError('api/reports/notifications', error);
    return sendError(
      req, 
      `Error unsubscribing from notifications: ${(error as Error).message}`, 
      500
    );
  }
});
