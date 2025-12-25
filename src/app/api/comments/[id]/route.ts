import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Comment from '@/models/Comment';
import Assessment from '@/models/Assessment';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import { sendNotification } from '@/lib/notificationService';
import mongoose from 'mongoose';

// Get a specific comment
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const commentId = req.url.split('/').slice(-1)[0];
    
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { message: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the comment
    const comment = await Comment.findById(commentId)
      .populate('author', 'username firstName lastName')
      .lean();
    
    if (!comment) {
      return NextResponse.json(
        { message: 'Comment not found' },
        { status: 404 }
      );
    }

    // Find the assessment to check permissions
    const assessment = await Assessment.findById(comment.assessment);
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Associated assessment not found' },
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
        { message: 'You do not have permission to view this comment' },
        { status: 403 }
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.COMMENT,
      entityId: commentId,
      details: { 
        action: 'view-comment',
        assessmentId: assessment._id.toString()
      },
      request: req
    });

    // Return the comment
    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error fetching comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a comment
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const commentId = req.url.split('/').slice(-1)[0];
    
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { message: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    const { content } = body;
    
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { message: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the comment
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return NextResponse.json(
        { message: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user is the author of the comment or an admin
    const isAdmin = user.role === 'admin';
    const isAuthor = comment.author.toString() === user.userId;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json(
        { message: 'You do not have permission to update this comment' },
        { status: 403 }
      );
    }

    // Find the assessment to check permissions
    const assessment = await Assessment.findById(comment.assessment)
      .populate('company', 'name');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Associated assessment not found' },
        { status: 404 }
      );
    }

    // Extract mentions from content (format: @username)
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const newMentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      newMentions.push(match[1]);
    }

    // Find new mentions that weren't in the original comment
    const oldMentions = comment.mentions || [];
    const addedMentions = newMentions.filter(mention => !oldMentions.includes(mention));

    // Update the comment
    comment.content = content;
    comment.mentions = newMentions;
    comment.updatedAt = new Date();
    await comment.save();

    // Process new mentions and send notifications
    if (addedMentions.length > 0) {
      // Find mentioned users
      const mentionedUsers = await mongoose.model('User').find({
        username: { $in: addedMentions }
      });

      // Send notifications to newly mentioned users
      await Promise.all(
        mentionedUsers.map(async (mentionedUser: any) => {
          // Skip if the mentioned user is the comment author
          if (mentionedUser._id.toString() === user.userId) {
            return;
          }

          // Check if mentioned user has access to this assessment
          const hasAccess = mentionedUser.role === 'admin' || 
            mentionedUser._id.toString() === assessment.createdBy?.toString() ||
            assessment.assignedUsers?.some((assignedUser: any) => 
              assignedUser.toString() === mentionedUser._id.toString()
            );

          if (hasAccess) {
            await sendNotification({
              recipientId: mentionedUser._id.toString(),
              senderId: user.userId,
              type: 'mention',
              title: `You were mentioned in a comment`,
              message: `${user.username} mentioned you in an updated comment on assessment "${assessment.name}"${assessment.company ? ` for ${assessment.company.name}` : ''}.`,
              entityType: 'assessment',
              entityId: assessment._id.toString()
            });
          }
        })
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.COMMENT,
      entityId: commentId,
      details: { 
        action: 'update-comment',
        assessmentId: assessment._id.toString(),
        newMentions: addedMentions
      },
      request: req
    });

    // Return success with populated author
    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'username firstName lastName')
      .lean();

    return NextResponse.json({
      message: 'Comment updated successfully',
      comment: updatedComment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a comment
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const commentId = req.url.split('/').slice(-1)[0];
    
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { message: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the comment
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return NextResponse.json(
        { message: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user is the author of the comment or an admin
    const isAdmin = user.role === 'admin';
    const isAuthor = comment.author.toString() === user.userId;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json(
        { message: 'You do not have permission to delete this comment' },
        { status: 403 }
      );
    }

    // Find the assessment to include in audit log
    const assessment = await Assessment.findById(comment.assessment);
    
    // Delete the comment
    await Comment.deleteOne({ _id: commentId });

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.COMMENT,
      entityId: commentId,
      details: { 
        action: 'delete-comment',
        assessmentId: assessment?._id.toString() || comment.assessment.toString()
      },
      request: req
    });

    return NextResponse.json({
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
