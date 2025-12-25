import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Get users assigned to an assessment
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').slice(-2)[0];
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name')
      .populate('warehouse', 'name');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: any) => assignedUser.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to view this assessment' },
        { status: 403 }
      );
    }

    // Get assigned users
    const assignedUserIds = assessment.assignedUsers || [];
    const assignedUsers = await User.find({ 
      _id: { $in: assignedUserIds } 
    }).select('_id username firstName lastName email role');

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { action: 'view-assignments', count: assignedUsers.length },
      request: req
    });

    // Return assigned users
    return NextResponse.json({
      assessment: {
        id: assessment._id,
        name: assessment.name,
        company: assessment.company,
        warehouse: assessment.warehouse,
        status: assessment.status
      },
      assignedUsers
    });
  } catch (error) {
    console.error('Error fetching assessment assignments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Assign users to an assessment
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').slice(-2)[0];
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
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

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name')
      .populate('warehouse', 'name');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to assign users to this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy.toString() === user.userId;

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { message: 'You do not have permission to assign users to this assessment' },
        { status: 403 }
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

    // Update the assessment to add the users to assignedUsers array
    assessment.assignedUsers = assessment.assignedUsers || [];
    
    // Filter out users that are already assigned
    const newUserIds = userIds.filter(
      id => !assessment.assignedUsers.some(
        (assignedId: any) => assignedId.toString() === id
      )
    );
    
    // Add new users
    assessment.assignedUsers.push(...newUserIds.map(id => new mongoose.Types.ObjectId(id)));
    await assessment.save();

    // Send notifications to newly assigned users
    await Promise.all(
      newUserIds.map(async userId => {
        await sendNotification({
          recipientId: userId,
          senderId: user.userId,
          type: 'assignment',
          title: `You've been assigned to assessment: ${assessment.name}`,
          message: `You have been assigned to work on the assessment "${assessment.name}" for ${assessment.company?.name || 'a company'}${assessment.warehouse ? ` (${assessment.warehouse.name})` : ''}.`,
          entityType: 'assessment',
          entityId: assessmentId
        });
      })
    );

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.ASSIGN,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { 
        action: 'assign-users', 
        userIds: newUserIds,
        assessmentName: assessment.name,
        companyName: assessment.company?.name
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Users assigned to assessment successfully',
      assignedUsers: newUserIds,
      alreadyAssigned: userIds.length - newUserIds.length
    });
  } catch (error) {
    console.error('Error assigning users to assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Remove user assignments from an assessment
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').slice(-2)[0];
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
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

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name')
      .populate('warehouse', 'name');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to unassign users from this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy.toString() === user.userId;

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { message: 'You do not have permission to unassign users from this assessment' },
        { status: 403 }
      );
    }

    // Update the assessment to remove the users from assignedUsers array
    if (assessment.assignedUsers && assessment.assignedUsers.length > 0) {
      assessment.assignedUsers = assessment.assignedUsers.filter(
        (assignedId: any) => !userIds.includes(assignedId.toString())
      );
      await assessment.save();
    }

    // Send notifications to unassigned users
    await Promise.all(
      userIds.map(async userId => {
        await sendNotification({
          recipientId: userId,
          senderId: user.userId,
          type: 'info',
          title: `You've been unassigned from assessment: ${assessment.name}`,
          message: `You have been removed from the assessment "${assessment.name}" for ${assessment.company?.name || 'a company'}${assessment.warehouse ? ` (${assessment.warehouse.name})` : ''}.`,
          entityType: 'assessment',
          entityId: assessmentId
        });
      })
    );

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UNASSIGN,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { 
        action: 'unassign-users', 
        userIds,
        assessmentName: assessment.name,
        companyName: assessment.company?.name
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Users unassigned from assessment successfully'
    });
  } catch (error) {
    console.error('Error unassigning users from assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
