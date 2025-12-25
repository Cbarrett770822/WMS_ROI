import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

// Get notifications for the current user
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Connect to the database
    await connectToDatabase();

    // Build query for user's notifications
    const query: any = { recipient: user.userId };
    
    // Filter by read status if requested
    if (unreadOnly) {
      query.read = false;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort direction
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username firstName lastName')
      .lean();

    // Get total count for pagination
    const totalCount = await Notification.countDocuments(query);

    // Return notifications with pagination info
    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new notification
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { recipient, type, title, message, entityType, entityId } = body;
    
    if (!recipient || !type || !title) {
      return NextResponse.json(
        { message: 'Recipient, type, and title are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Create new notification
    const notification = new Notification({
      recipient,
      sender: user.userId,
      type,
      title,
      message,
      entityType,
      entityId,
      read: false,
      createdAt: new Date()
    });

    // Save notification
    await notification.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.SYSTEM,
      details: { component: 'notification', recipient },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Notification created successfully',
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Mark all notifications as read for the current user
export const PATCH = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    // Update all unread notifications for this user
    const result = await Notification.updateMany(
      { recipient: user.userId, read: false },
      { read: true }
    );

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.SYSTEM,
      details: { component: 'notifications', markedRead: result.modifiedCount },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: `${result.modifiedCount} notifications marked as read`
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete all notifications for the current user
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const readOnly = url.searchParams.get('readOnly') === 'true';

    // Connect to the database
    await connectToDatabase();

    // Build query for user's notifications
    const query: any = { recipient: user.userId };
    
    // Delete only read notifications if requested
    if (readOnly) {
      query.read = true;
    }

    // Delete notifications
    const result = await Notification.deleteMany(query);

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.SYSTEM,
      details: { component: 'notifications', deleted: result.deletedCount, readOnly },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: `${result.deletedCount} notifications deleted`
    });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
