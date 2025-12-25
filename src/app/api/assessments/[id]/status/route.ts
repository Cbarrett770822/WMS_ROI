import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Valid assessment status transitions
const VALID_TRANSITIONS = {
  'draft': ['in-progress', 'cancelled'],
  'in-progress': ['data-collection', 'cancelled'],
  'data-collection': ['analysis', 'in-progress', 'cancelled'],
  'analysis': ['review', 'data-collection', 'cancelled'],
  'review': ['complete', 'analysis', 'cancelled'],
  'complete': ['archived'],
  'cancelled': ['draft'],
  'archived': []
};

// Status that require comments
const STATUS_REQUIRING_COMMENTS = ['cancelled', 'review', 'complete'];

// Update assessment status
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
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
    const { status, comment } = body;
    
    if (!status) {
      return NextResponse.json(
        { message: 'Status is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name')
      .populate('warehouse', 'name')
      .populate('createdBy', 'username firstName lastName email')
      .populate('assignedUsers', 'username firstName lastName email');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy._id.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: any) => assignedUser._id.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to update this assessment' },
        { status: 403 }
      );
    }

    // Check if the status transition is valid
    const currentStatus = assessment.status;
    const validNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
    
    if (!validNextStatuses.includes(status)) {
      return NextResponse.json(
        { message: `Invalid status transition from '${currentStatus}' to '${status}'` },
        { status: 400 }
      );
    }

    // Check if comment is required for this status change
    if (STATUS_REQUIRING_COMMENTS.includes(status) && (!comment || comment.trim() === '')) {
      return NextResponse.json(
        { message: `A comment is required when changing status to '${status}'` },
        { status: 400 }
      );
    }

    // Update the assessment status
    assessment.status = status;
    assessment.statusHistory = assessment.statusHistory || [];
    assessment.statusHistory.push({
      status,
      changedBy: new mongoose.Types.ObjectId(user.userId),
      changedAt: new Date(),
      comment: comment || undefined
    });
    assessment.updatedBy = new mongoose.Types.ObjectId(user.userId);
    assessment.updatedAt = new Date();
    
    await assessment.save();

    // Create comment if provided
    if (comment && comment.trim() !== '') {
      const Comment = mongoose.model('Comment');
      const newComment = new Comment({
        assessment: assessmentId,
        author: user.userId,
        content: comment,
        section: 'general',
        createdAt: new Date()
      });
      await newComment.save();
    }

    // Send notifications to relevant users
    const notificationRecipients = [];
    
    // Always notify the creator if they're not the one making the change
    if (assessment.createdBy && assessment.createdBy._id.toString() !== user.userId) {
      notificationRecipients.push(assessment.createdBy._id.toString());
    }
    
    // Notify assigned users if they're not the one making the change
    if (assessment.assignedUsers && assessment.assignedUsers.length > 0) {
      assessment.assignedUsers.forEach((assignedUser: any) => {
        if (assignedUser._id.toString() !== user.userId) {
          notificationRecipients.push(assignedUser._id.toString());
        }
      });
    }
    
    // Send notifications if there are recipients
    if (notificationRecipients.length > 0) {
      await Promise.all(
        notificationRecipients.map(async (recipientId) => {
          await sendNotification({
            recipientId,
            senderId: user.userId,
            type: 'update',
            title: `Assessment status updated: ${assessment.name}`,
            message: `${user.username} changed the status of assessment "${assessment.name}" from "${currentStatus}" to "${status}"${comment ? ` with comment: "${comment}"` : ''}.`,
            entityType: 'assessment',
            entityId: assessmentId
          });
        })
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { 
        action: 'update-status', 
        previousStatus: currentStatus,
        newStatus: status,
        hasComment: !!comment
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Assessment status updated successfully',
      assessment: {
        id: assessment._id,
        name: assessment.name,
        status,
        previousStatus: currentStatus,
        company: assessment.company ? {
          id: assessment.company._id,
          name: assessment.company.name
        } : undefined,
        warehouse: assessment.warehouse ? {
          id: assessment.warehouse._id,
          name: assessment.warehouse.name
        } : undefined
      }
    });
  } catch (error) {
    console.error('Error updating assessment status:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Get assessment status history
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
      .populate('statusHistory.changedBy', 'username firstName lastName');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this assessment
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

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { action: 'view-status-history' },
      request: req
    });

    // Return status history
    return NextResponse.json({
      currentStatus: assessment.status,
      statusHistory: assessment.statusHistory || []
    });
  } catch (error) {
    console.error('Error fetching assessment status history:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
