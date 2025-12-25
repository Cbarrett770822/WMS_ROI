import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Get a specific notification
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const notificationId = req.url.split('/').pop();
    
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return NextResponse.json(
        { message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the notification
    const notification = await Notification.findById(notificationId)
      .populate('sender', 'username firstName lastName');
      
    if (!notification) {
      return NextResponse.json(
        { message: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this notification
    if (notification.recipient.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'You do not have permission to view this notification' },
        { status: 403 }
      );
    }

    // Return the notification
    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Mark a notification as read
export const PATCH = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const notificationId = req.url.split('/').pop();
    
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return NextResponse.json(
        { message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return NextResponse.json(
        { message: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this notification
    if (notification.recipient.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'You do not have permission to update this notification' },
        { status: 403 }
      );
    }

    // Mark as read
    notification.read = true;
    await notification.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.SYSTEM,
      entityId: notification._id.toString(),
      details: { component: 'notification', action: 'mark-read' },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a specific notification
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const notificationId = req.url.split('/').pop();
    
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return NextResponse.json(
        { message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return NextResponse.json(
        { message: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete this notification
    if (notification.recipient.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'You do not have permission to delete this notification' },
        { status: 403 }
      );
    }

    // Delete the notification
    await Notification.findByIdAndDelete(notificationId);

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.SYSTEM,
      entityId: notificationId,
      details: { component: 'notification' },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
