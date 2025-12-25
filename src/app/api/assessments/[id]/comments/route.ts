import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import Comment from '@/models/Comment';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Get comments for an assessment
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
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
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId);
    
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
        { message: 'You do not have permission to view comments for this assessment' },
        { status: 403 }
      );
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort direction
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Get comments with pagination
    const comments = await Comment.find({ assessment: assessmentId })
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username firstName lastName')
      .lean();

    // Get total count for pagination
    const totalCount = await Comment.countDocuments({ assessment: assessmentId });

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { action: 'view-comments', count: comments.length },
      request: req
    });

    // Return comments with pagination info
    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching assessment comments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Add a comment to an assessment
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
    const { content, section } = body;
    
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { message: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name')
      .populate('warehouse', 'name')
      .populate('assignedUsers', '_id');
    
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
      (assignedUser: any) => assignedUser._id.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to comment on this assessment' },
        { status: 403 }
      );
    }

    // Extract mentions from content (format: @username)
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    // Create new comment
    const comment = new Comment({
      assessment: assessmentId,
      author: user.userId,
      content,
      section: section || null,
      mentions: mentions.length > 0 ? mentions : [],
      createdAt: new Date()
    });

    // Save comment
    await comment.save();

    // Process mentions and send notifications
    if (mentions.length > 0) {
      // Find mentioned users
      const mentionedUsers = await mongoose.model('User').find({
        username: { $in: mentions }
      });

      // Send notifications to mentioned users
      await Promise.all(
        mentionedUsers.map(async (mentionedUser: any) => {
          // Skip if the mentioned user is the comment author
          if (mentionedUser._id.toString() === user.userId) {
            return;
          }

          // Check if mentioned user has access to this assessment
          const hasAccess = isAdmin || 
            mentionedUser._id.toString() === assessment.createdBy?.toString() ||
            assessment.assignedUsers?.some((assignedUser: any) => 
              assignedUser._id.toString() === mentionedUser._id.toString()
            );

          if (hasAccess) {
            await sendNotification({
              recipientId: mentionedUser._id.toString(),
              senderId: user.userId,
              type: 'mention',
              title: `You were mentioned in a comment`,
              message: `${user.username} mentioned you in a comment on assessment "${assessment.name}"${assessment.company ? ` for ${assessment.company.name}` : ''}.`,
              entityType: 'assessment',
              entityId: assessmentId
            });
          }
        })
      );
    }

    // Notify assessment creator if they're not the comment author
    if (assessment.createdBy && 
        assessment.createdBy.toString() !== user.userId) {
      await sendNotification({
        recipientId: assessment.createdBy.toString(),
        senderId: user.userId,
        type: 'update',
        title: `New comment on your assessment`,
        message: `${user.username} commented on your assessment "${assessment.name}"${assessment.company ? ` for ${assessment.company.name}` : ''}.`,
        entityType: 'assessment',
        entityId: assessmentId
      });
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { 
        action: 'add-comment', 
        commentId: comment._id.toString(),
        section: section || 'general',
        mentions: mentions.length
      },
      request: req
    });

    // Return success with populated author
    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username firstName lastName')
      .lean();

    return NextResponse.json({
      message: 'Comment added successfully',
      comment: populatedComment
    });
  } catch (error) {
    console.error('Error adding comment to assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
