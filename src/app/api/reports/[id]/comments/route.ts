import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';
import { sendNotification } from '@/lib/notifications';

// Helper function to check if user has access to a report
async function hasReportAccess(userId: string, report: any, isAdmin: boolean) {
  // Admin has access to all reports
  if (isAdmin) return true;
  
  // Creator has access
  if (report.generatedBy.toString() === userId) return true;
  
  // Users with whom the report is shared have access
  if (report.sharedWith?.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Get comments for a report
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/comments')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId)
      .select('name generatedBy sharedWith comments')
      .lean();
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the report
    const hasAccess = await hasReportAccess(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }
    
    // If report has no comments, return empty array
    if (!report.comments || report.comments.length === 0) {
      return NextResponse.json({ comments: [] });
    }
    
    // Get user information for comments
    const userIds = [...new Set(report.comments.map((comment: any) => comment.userId))];
    
    const users = await User.find({
      _id: { $in: userIds }
    })
      .select('firstName lastName email profileImage')
      .lean();
      
    // Create a map of user information
    const userMap = new Map();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage
      });
    });
    
    // Enrich comments with user information
    const enrichedComments = report.comments.map((comment: any) => {
      const userInfo = userMap.get(comment.userId.toString()) || {
        firstName: 'Unknown',
        lastName: 'User',
        email: '',
        profileImage: ''
      };
      
      return {
        ...comment,
        user: userInfo
      };
    });
    
    return NextResponse.json({
      comments: enrichedComments
    });
  } catch (error) {
    console.error('Error getting report comments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Add a comment to a report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/comments')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const { text, sectionId, replyTo } = await req.json();
    
    // Validate comment text
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { message: 'Comment text is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the report
    const hasAccess = await hasReportAccess(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }
    
    // Validate section ID if provided
    if (sectionId) {
      const sectionExists = report.sections.some((section: any) => 
        section.sectionId === sectionId
      );
      
      if (!sectionExists) {
        return NextResponse.json(
          { message: 'Invalid section ID' },
          { status: 400 }
        );
      }
    }
    
    // Validate reply ID if provided
    if (replyTo) {
      const replyExists = report.comments?.some((comment: any) => 
        comment._id.toString() === replyTo
      );
      
      if (!replyExists) {
        return NextResponse.json(
          { message: 'Invalid reply comment ID' },
          { status: 400 }
        );
      }
    }
    
    // Create new comment
    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(user.userId),
      text: text.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add section ID if provided
    if (sectionId) {
      newComment['sectionId'] = sectionId;
    }
    
    // Add reply ID if provided
    if (replyTo) {
      newComment['replyTo'] = new mongoose.Types.ObjectId(replyTo);
    }
    
    // Initialize comments array if it doesn't exist
    if (!report.comments) {
      report.comments = [];
    }
    
    // Add comment to report
    report.comments.push(newComment);
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: newComment._id,
      details: { 
        reportId,
        sectionId,
        replyTo
      },
      request: req
    });
    
    // Send notification to report owner if the commenter is not the owner
    if (report.generatedBy.toString() !== user.userId) {
      await sendNotification({
        userId: report.generatedBy.toString(),
        type: 'report_comment',
        title: 'New Comment on Your Report',
        message: `A new comment has been added to your report "${report.name}".`,
        data: {
          reportId,
          commentId: newComment._id.toString(),
          commentText: text.length > 50 ? text.substring(0, 50) + '...' : text
        }
      });
    }
    
    // Send notification to users mentioned in the comment
    // This would require parsing the comment text for @mentions
    // and then sending notifications to those users
    
    // Get user information for the comment
    const commentUser = await User.findById(user.userId)
      .select('firstName lastName email profileImage')
      .lean();
      
    // Return the new comment with user information
    return NextResponse.json({
      message: 'Comment added successfully',
      comment: {
        ...newComment,
        user: commentUser ? {
          firstName: commentUser.firstName,
          lastName: commentUser.lastName,
          email: commentUser.email,
          profileImage: commentUser.profileImage
        } : {
          firstName: 'Unknown',
          lastName: 'User',
          email: '',
          profileImage: ''
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding report comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a comment
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.pathname.split('/reports/')[1].split('/comments')[0];
    const commentId = url.searchParams.get('commentId');
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Validate comment ID
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { message: 'Valid comment ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the report
    const hasAccess = await hasReportAccess(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }
    
    // Find the comment
    const commentIndex = report.comments?.findIndex((comment: any) => 
      comment._id.toString() === commentId
    );
    
    if (commentIndex === -1 || commentIndex === undefined) {
      return NextResponse.json(
        { message: 'Comment not found' },
        { status: 404 }
      );
    }
    
    // Check if user is the comment owner or an admin
    const comment = report.comments[commentIndex];
    
    if (comment.userId.toString() !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { message: 'You are not authorized to delete this comment' },
        { status: 403 }
      );
    }
    
    // Remove the comment
    report.comments.splice(commentIndex, 1);
    
    // Also remove any replies to this comment
    if (report.comments) {
      report.comments = report.comments.filter((c: any) => 
        !c.replyTo || c.replyTo.toString() !== commentId
      );
    }
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: commentId,
      details: { reportId },
      request: req
    });
    
    return NextResponse.json({
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a comment
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/reports/')[1].split('/comments')[0];
    
    // Validate report ID
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Valid report ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const { commentId, text } = await req.json();
    
    // Validate comment ID
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { message: 'Valid comment ID is required' },
        { status: 400 }
      );
    }
    
    // Validate comment text
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { message: 'Comment text is required' },
        { status: 400 }
      );
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access to the report
    const hasAccess = await hasReportAccess(
      user.userId,
      report,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }
    
    // Find the comment
    const commentIndex = report.comments?.findIndex((comment: any) => 
      comment._id.toString() === commentId
    );
    
    if (commentIndex === -1 || commentIndex === undefined) {
      return NextResponse.json(
        { message: 'Comment not found' },
        { status: 404 }
      );
    }
    
    // Check if user is the comment owner
    const comment = report.comments[commentIndex];
    
    if (comment.userId.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'You are not authorized to update this comment' },
        { status: 403 }
      );
    }
    
    // Update the comment
    comment.text = text.trim();
    comment.updatedAt = new Date();
    comment.edited = true;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_COMMENT,
      entityId: commentId,
      details: { reportId },
      request: req
    });
    
    // Get user information for the comment
    const commentUser = await User.findById(user.userId)
      .select('firstName lastName email profileImage')
      .lean();
      
    // Return the updated comment with user information
    return NextResponse.json({
      message: 'Comment updated successfully',
      comment: {
        ...comment,
        user: commentUser ? {
          firstName: commentUser.firstName,
          lastName: commentUser.lastName,
          email: commentUser.email,
          profileImage: commentUser.profileImage
        } : {
          firstName: 'Unknown',
          lastName: 'User',
          email: '',
          profileImage: ''
        }
      }
    });
  } catch (error) {
    console.error('Error updating report comment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
