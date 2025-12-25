/**
 * Utility for sending notifications throughout the application
 */

import Notification from '@/models/Notification';
import User from '@/models/User';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';

interface NotificationParams {
  recipientId: string;
  senderId?: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'completion' | 'mention' | 'update' | 'reminder' | 'system';
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Send a notification to a user
 */
export async function sendNotification({
  recipientId,
  senderId,
  type,
  title,
  message,
  entityType,
  entityId
}: NotificationParams): Promise<mongoose.Document> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Create new notification
    const notification = new Notification({
      recipient: new mongoose.Types.ObjectId(recipientId),
      sender: senderId ? new mongoose.Types.ObjectId(senderId) : undefined,
      type,
      title,
      message,
      entityType,
      entityId: entityId ? new mongoose.Types.ObjectId(entityId) : undefined,
      read: false,
      createdAt: new Date()
    });

    // Save notification
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Send a notification to multiple users
 */
export async function sendBulkNotifications(
  recipientIds: string[],
  notificationParams: Omit<NotificationParams, 'recipientId'>
): Promise<mongoose.Document[]> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Create notifications for each recipient
    const notifications = recipientIds.map(recipientId => new Notification({
      recipient: new mongoose.Types.ObjectId(recipientId),
      sender: notificationParams.senderId ? new mongoose.Types.ObjectId(notificationParams.senderId) : undefined,
      type: notificationParams.type,
      title: notificationParams.title,
      message: notificationParams.message,
      entityType: notificationParams.entityType,
      entityId: notificationParams.entityId ? new mongoose.Types.ObjectId(notificationParams.entityId) : undefined,
      read: false,
      createdAt: new Date()
    }));

    // Save all notifications
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
    
    return notifications;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
}

/**
 * Send a notification to all users with a specific role
 */
export async function sendNotificationToRole(
  role: string,
  notificationParams: Omit<NotificationParams, 'recipientId'>
): Promise<mongoose.Document[]> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Find all users with the specified role
    const users = await User.find({ role });
    const userIds = users.map(user => user._id.toString());

    // Send notifications to all users
    return await sendBulkNotifications(userIds, notificationParams);
  } catch (error) {
    console.error('Error sending notification to role:', error);
    throw error;
  }
}

/**
 * Send a notification to all admin users
 */
export async function sendNotificationToAdmins(
  notificationParams: Omit<NotificationParams, 'recipientId'>
): Promise<mongoose.Document[]> {
  return sendNotificationToRole('admin', notificationParams);
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Count unread notifications
    return await Notification.countDocuments({
      recipient: new mongoose.Types.ObjectId(userId),
      read: false
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Update all unread notifications
    const result = await Notification.updateMany(
      { recipient: new mongoose.Types.ObjectId(userId), read: false },
      { read: true }
    );

    return result.modifiedCount;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
}

/**
 * Delete old read notifications for a user
 * @param userId User ID
 * @param daysOld Delete notifications older than this many days
 */
export async function deleteOldNotifications(userId: string, daysOld: number = 30): Promise<number> {
  try {
    // Connect to database if not already connected
    await connectToDatabase();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete old read notifications
    const result = await Notification.deleteMany({
      recipient: new mongoose.Types.ObjectId(userId),
      read: true,
      createdAt: { $lt: cutoffDate }
    });

    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
}
