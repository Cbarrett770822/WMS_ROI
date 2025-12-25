import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get audit logs with filtering and pagination
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const entityType = url.searchParams.get('entityType');
    const entityId = url.searchParams.get('entityId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const sortField = url.searchParams.get('sortField') || 'timestamp';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Connect to the database
    await connectToDatabase();

    // Build query based on user role and filters
    const isAdmin = user.role === 'admin';
    let query: any = {};

    // Regular users can only see their own logs
    if (!isAdmin) {
      query.userId = user.userId;
    } else if (userId) {
      // Admin can filter by userId
      query.userId = userId;
    }

    // Apply other filters
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    // Apply date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // End of the day
        query.timestamp.$lte = endDateObj;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort direction
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = {};
    sortOptions[sortField] = sortDirection;

    // Get audit logs with pagination
    const logs = await AuditLog.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username firstName lastName')
      .lean();

    // Get total count for pagination
    const totalCount = await AuditLog.countDocuments(query);

    // Return audit logs with pagination info
    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new audit log entry
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { action, entityType, entityId, details } = body;
    
    if (!action || !entityType) {
      return NextResponse.json(
        { message: 'Action and entityType are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Create new audit log entry
    const auditLog = new AuditLog({
      userId: user.userId,
      action,
      entityType,
      entityId: entityId || null,
      details: details || {},
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: new Date()
    });

    // Save audit log
    await auditLog.save();

    // Return success
    return NextResponse.json({
      message: 'Audit log created successfully',
      auditLog
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete audit logs (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const olderThan = url.searchParams.get('olderThan');
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const entityType = url.searchParams.get('entityType');
    
    if (!olderThan) {
      return NextResponse.json(
        { message: 'olderThan parameter is required for safety' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Build delete query
    const query: any = {
      timestamp: { $lt: new Date(olderThan) }
    };

    // Apply optional filters
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    // Delete matching audit logs
    const result = await AuditLog.deleteMany(query);

    // Return success
    return NextResponse.json({
      message: `${result.deletedCount} audit logs deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting audit logs:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
