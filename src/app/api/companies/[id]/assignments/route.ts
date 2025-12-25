import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Company from '@/models/Company';
import User from '@/models/User';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Get users assigned to a company
export const GET = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').slice(-2)[0];
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the company
    const company = await Company.findById(companyId);
    
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Get assigned users
    const assignedUsers = await User.find({ 
      assignedCompanies: companyId 
    }).select('_id username firstName lastName email role');

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.COMPANY,
      entityId: companyId,
      details: { action: 'view-assignments', count: assignedUsers.length },
      request: req
    });

    // Return assigned users
    return NextResponse.json({
      company: {
        id: company._id,
        name: company.name
      },
      assignedUsers
    });
  } catch (error) {
    console.error('Error fetching company assignments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Assign users to a company
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').slice(-2)[0];
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    const { userIds } = body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { message: 'User IDs array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate all user IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: `Invalid user IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the company
    const company = await Company.findById(companyId);
    
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Find the users
    const users = await User.find({ _id: { $in: userIds } });
    
    if (users.length !== userIds.length) {
      const foundIds = users.map(u => u._id.toString());
      const missingIds = userIds.filter(id => !foundIds.includes(id));
      
      return NextResponse.json(
        { message: `Some users not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Update each user to add the company to their assignedCompanies array
    const updateResults = await Promise.all(
      users.map(async user => {
        // Skip if already assigned
        if (user.assignedCompanies && user.assignedCompanies.includes(companyId)) {
          return { userId: user._id, alreadyAssigned: true };
        }
        
        // Add company to user's assignments
        user.assignedCompanies = user.assignedCompanies || [];
        user.assignedCompanies.push(companyId);
        await user.save();
        
        // Send notification to user
        await sendNotification({
          recipientId: user._id.toString(),
          senderId: user.userId,
          type: 'assignment',
          title: `You've been assigned to ${company.name}`,
          message: `An administrator has given you access to ${company.name}. You can now view and manage data for this company.`,
          entityType: 'company',
          entityId: companyId
        });
        
        return { userId: user._id, assigned: true };
      })
    );

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.ASSIGN,
      entityType: EntityTypes.COMPANY,
      entityId: companyId,
      details: { 
        action: 'assign-users', 
        userIds,
        companyName: company.name
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Users assigned to company successfully',
      results: updateResults
    });
  } catch (error) {
    console.error('Error assigning users to company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Remove user assignments from a company
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').slice(-2)[0];
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const userIds = url.searchParams.get('userIds')?.split(',') || [];
    
    if (userIds.length === 0) {
      return NextResponse.json(
        { message: 'User IDs are required as comma-separated query parameter' },
        { status: 400 }
      );
    }

    // Validate all user IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { message: `Invalid user IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the company
    const company = await Company.findById(companyId);
    
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Update each user to remove the company from their assignedCompanies array
    const updateResults = await Promise.all(
      userIds.map(async userId => {
        const user = await User.findById(userId);
        
        if (!user) {
          return { userId, notFound: true };
        }
        
        // Skip if not assigned
        if (!user.assignedCompanies || !user.assignedCompanies.includes(companyId)) {
          return { userId, notAssigned: true };
        }
        
        // Remove company from user's assignments
        user.assignedCompanies = user.assignedCompanies.filter(
          id => id.toString() !== companyId
        );
        await user.save();
        
        // Send notification to user
        await sendNotification({
          recipientId: user._id.toString(),
          senderId: user.userId,
          type: 'info',
          title: `You've been unassigned from ${company.name}`,
          message: `An administrator has removed your access to ${company.name}. You can no longer view or manage data for this company.`,
          entityType: 'company',
          entityId: companyId
        });
        
        return { userId, unassigned: true };
      })
    );

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UNASSIGN,
      entityType: EntityTypes.COMPANY,
      entityId: companyId,
      details: { 
        action: 'unassign-users', 
        userIds,
        companyName: company.name
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Users unassigned from company successfully',
      results: updateResults
    });
  } catch (error) {
    console.error('Error unassigning users from company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
