import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get approval status and history for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/approvals');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId).lean();
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has access to this report
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    const isSharedWithUser = report.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isEditor = report.editors?.some((id: any) => id.toString() === user.userId);
    const isViewer = report.viewers?.some((id: any) => id.toString() === user.userId);
    const isPublic = report.isPublic;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isEditor && !isViewer && !isPublic) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Get approval data
    const approvalData = report.approvals || {
      status: 'pending',
      history: []
    };
    
    // Get user details for approval history
    const userIds = approvalData.history?.map((entry: any) => entry.userId) || [];
    
    // Add current approvers if present
    if (report.approvers && Array.isArray(report.approvers)) {
      report.approvers.forEach((approver: any) => {
        if (approver.userId && !userIds.includes(approver.userId.toString())) {
          userIds.push(approver.userId.toString());
        }
      });
    }
    
    // Get user information
    const users = userIds.length > 0 
      ? await User.find({
          _id: { $in: userIds.map((id: string) => new mongoose.Types.ObjectId(id)) }
        }).select('_id name email role').lean()
      : [];
    
    // Create a map of user IDs to user information
    const userMap: { [key: string]: any } = {};
    users.forEach((user: any) => {
      userMap[user._id.toString()] = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    });
    
    // Format approval history with user details
    const formattedHistory = approvalData.history?.map((entry: any) => {
      const userInfo = userMap[entry.userId] || { id: entry.userId, name: 'Unknown User', email: '' };
      
      return {
        ...entry,
        user: userInfo
      };
    }) || [];
    
    // Format current approvers with user details
    const formattedApprovers = report.approvers?.map((approver: any) => {
      const userInfo = approver.userId && userMap[approver.userId.toString()] 
        ? userMap[approver.userId.toString()] 
        : { id: approver.userId, name: 'Unknown User', email: '' };
      
      return {
        ...approver,
        user: userInfo
      };
    }) || [];
    
    // Check if current user can approve the report
    const canApprove = isAdmin || (report.approvers?.some((approver: any) => 
      approver.userId && approver.userId.toString() === user.userId && 
      (!approver.status || approver.status === 'pending')
    ) || false);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_APPROVALS,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        status: approvalData.status || 'pending',
        history: formattedHistory,
        approvers: formattedApprovers,
        canApprove,
        isApprovalComplete: approvalData.status === 'approved'
      },
      'Report approval status retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/approvals', error);
    return sendError(
      req, 
      `Error retrieving report approval status: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Submit a report for approval or update approval settings
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/approvals');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, approvers, action } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to submit for approval or update approval settings
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can manage approvals', 403);
    }
    
    // Initialize approvals if not present
    if (!report.approvals) {
      report.approvals = {
        status: 'pending',
        history: []
      };
    }
    
    // Handle different actions
    switch (action) {
      case 'submit':
        // Submit for approval
        if (!approvers || !Array.isArray(approvers) || approvers.length === 0) {
          return sendError(req, 'At least one approver is required', 400);
        }
        
        // Validate approver IDs
        for (const approver of approvers) {
          if (!approver.userId || !mongoose.Types.ObjectId.isValid(approver.userId)) {
            return sendError(req, `Invalid approver ID: ${approver.userId}`, 400);
          }
        }
        
        // Format approvers with status
        const formattedApprovers = approvers.map((approver: any) => ({
          userId: new mongoose.Types.ObjectId(approver.userId),
          role: approver.role || 'reviewer',
          status: 'pending',
          required: approver.required !== false, // Default to true if not specified
          order: approver.order || 0
        }));
        
        // Update report
        report.approvers = formattedApprovers;
        report.approvals.status = 'pending';
        report.status = 'pending_approval';
        
        // Add submission to history
        report.approvals.history.push({
          userId: user.userId,
          action: 'submit',
          timestamp: new Date(),
          comments: body.comments || 'Submitted for approval'
        });
        
        break;
        
      case 'cancel':
        // Cancel approval process
        report.approvals.status = 'cancelled';
        report.status = 'draft';
        
        // Add cancellation to history
        report.approvals.history.push({
          userId: user.userId,
          action: 'cancel',
          timestamp: new Date(),
          comments: body.comments || 'Approval process cancelled'
        });
        
        // Reset approvers
        report.approvers = [];
        
        break;
        
      case 'update_approvers':
        // Update approvers
        if (!approvers || !Array.isArray(approvers)) {
          return sendError(req, 'Approvers array is required', 400);
        }
        
        // Validate approver IDs
        for (const approver of approvers) {
          if (!approver.userId || !mongoose.Types.ObjectId.isValid(approver.userId)) {
            return sendError(req, `Invalid approver ID: ${approver.userId}`, 400);
          }
        }
        
        // Check if we can update approvers
        if (report.approvals.status === 'approved') {
          return sendError(req, 'Cannot update approvers for an already approved report', 400);
        }
        
        // Format approvers with status
        const updatedApprovers = approvers.map((approver: any) => {
          // Check if this approver already exists
          const existingApprover = report.approvers?.find(
            (a: any) => a.userId.toString() === approver.userId
          );
          
          return {
            userId: new mongoose.Types.ObjectId(approver.userId),
            role: approver.role || existingApprover?.role || 'reviewer',
            status: existingApprover?.status || 'pending',
            required: approver.required !== false, // Default to true if not specified
            order: approver.order || existingApprover?.order || 0
          };
        });
        
        // Update report
        report.approvers = updatedApprovers;
        
        // Add update to history
        report.approvals.history.push({
          userId: user.userId,
          action: 'update_approvers',
          timestamp: new Date(),
          comments: body.comments || 'Updated approval workflow'
        });
        
        break;
        
      default:
        return sendError(req, `Invalid action: ${action}`, 400);
    }
    
    // Update report timestamps
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_APPROVALS,
      entityId: reportId,
      details: { 
        reportId,
        action,
        approverCount: report.approvers?.length || 0
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        status: report.approvals.status,
        approvers: formatDocument(report.approvers || []),
        action
      },
      action === 'submit' 
        ? 'Report submitted for approval successfully' 
        : action === 'cancel'
          ? 'Approval process cancelled successfully'
          : 'Approvers updated successfully'
    );
  } catch (error) {
    logApiError('api/reports/approvals', error);
    return sendError(
      req, 
      `Error managing report approvals: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Approve or reject a report
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/approvals');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, decision, comments } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return sendError(req, 'Valid decision (approve or reject) is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if report is pending approval
    if (!report.approvals || report.approvals.status !== 'pending') {
      return sendError(req, 'Report is not pending approval', 400);
    }
    
    // Check if user is an approver
    const isAdmin = user.role === 'admin';
    const approverIndex = report.approvers?.findIndex(
      (approver: any) => approver.userId.toString() === user.userId
    );
    
    if (!isAdmin && approverIndex === -1) {
      return sendError(req, 'You are not authorized to approve or reject this report', 403);
    }
    
    // Check if the user's approval is already processed
    if (approverIndex !== -1 && report.approvers[approverIndex].status !== 'pending') {
      return sendError(
        req, 
        `You have already ${report.approvers[approverIndex].status} this report`, 
        400
      );
    }
    
    // Process the decision
    const decisionAction = decision === 'approve' ? 'approved' : 'rejected';
    
    // If user is an approver, update their status
    if (approverIndex !== -1) {
      report.approvers[approverIndex].status = decisionAction;
      report.approvers[approverIndex].timestamp = new Date();
      report.approvers[approverIndex].comments = comments || '';
    }
    
    // Add decision to history
    if (!report.approvals.history) {
      report.approvals.history = [];
    }
    
    report.approvals.history.push({
      userId: user.userId,
      action: decisionAction,
      timestamp: new Date(),
      comments: comments || `Report ${decisionAction}`
    });
    
    // Check if all required approvers have approved
    const allRequiredApproved = report.approvers
      .filter((approver: any) => approver.required)
      .every((approver: any) => approver.status === 'approved');
    
    // Check if any approver has rejected
    const anyRejected = report.approvers.some(
      (approver: any) => approver.status === 'rejected'
    );
    
    // Update overall approval status
    if (anyRejected) {
      report.approvals.status = 'rejected';
      report.status = 'rejected';
    } else if (allRequiredApproved) {
      report.approvals.status = 'approved';
      report.status = 'approved';
      
      // Lock the report if approved
      report.locked = true;
      report.lockInfo = {
        lockedBy: user.userId,
        lockedAt: new Date(),
        reason: 'Report approved'
      };
    } else {
      // Keep as pending
      report.approvals.status = 'pending';
      report.status = 'pending_approval';
    }
    
    // Update report timestamps
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: decision === 'approve' ? AuditActions.APPROVE : AuditActions.REJECT,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        decision,
        comments: comments || `Report ${decisionAction}`
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        status: report.approvals.status,
        decision: decisionAction,
        overallStatus: report.status
      },
      decision === 'approve' 
        ? 'Report approved successfully' 
        : 'Report rejected successfully'
    );
  } catch (error) {
    logApiError('api/reports/approvals', error);
    return sendError(
      req, 
      `Error processing approval decision: ${(error as Error).message}`, 
      500
    );
  }
});
