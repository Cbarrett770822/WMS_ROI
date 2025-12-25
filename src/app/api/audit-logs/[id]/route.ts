import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get a specific audit log entry
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const logId = req.url.split('/').pop();
    
    if (!logId || !mongoose.Types.ObjectId.isValid(logId)) {
      return NextResponse.json(
        { message: 'Invalid audit log ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the audit log
    const auditLog = await AuditLog.findById(logId)
      .populate('userId', 'username firstName lastName');
      
    if (!auditLog) {
      return NextResponse.json(
        { message: 'Audit log not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this log
    const isAdmin = user.role === 'admin';
    if (!isAdmin && auditLog.userId.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'You do not have permission to view this audit log' },
        { status: 403 }
      );
    }

    // Return the audit log
    return NextResponse.json(auditLog);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a specific audit log entry (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest) => {
  try {
    const logId = req.url.split('/').pop();
    
    if (!logId || !mongoose.Types.ObjectId.isValid(logId)) {
      return NextResponse.json(
        { message: 'Invalid audit log ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find and delete the audit log
    const result = await AuditLog.findByIdAndDelete(logId);
    
    if (!result) {
      return NextResponse.json(
        { message: 'Audit log not found' },
        { status: 404 }
      );
    }

    // Return success
    return NextResponse.json({
      message: 'Audit log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting audit log:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
