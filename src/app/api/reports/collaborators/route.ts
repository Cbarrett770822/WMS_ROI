import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get collaborators for a report
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    
    logApiRequest(req, 'api/reports/collaborators');
    
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
    const isPublic = report.isPublic;
    
    if (!isAdmin && !isOwner && !isSharedWithUser && !isPublic) {
      return sendError(req, 'You do not have access to this report', 403);
    }
    
    // Get collaborator information
    const collaborators = [];
    
    // Add owner
    if (report.generatedBy) {
      const owner = await User.findById(report.generatedBy).select('_id name email role').lean();
      if (owner) {
        collaborators.push({
          ...formatDocument(owner),
          role: 'owner',
          permissions: ['view', 'edit', 'delete', 'share', 'comment']
        });
      }
    }
    
    // Add shared users
    if (report.sharedWith && report.sharedWith.length > 0) {
      const sharedUsers = await User.find({
        _id: { $in: report.sharedWith }
      }).select('_id name email role').lean();
      
      sharedUsers.forEach((sharedUser: any) => {
        collaborators.push({
          ...formatDocument(sharedUser),
          role: 'collaborator',
          permissions: ['view', 'comment']
        });
      });
    }
    
    // Add editors if present
    if (report.editors && report.editors.length > 0) {
      const editors = await User.find({
        _id: { $in: report.editors }
      }).select('_id name email role').lean();
      
      editors.forEach((editor: any) => {
        // Skip if already added as owner
        if (editor._id.toString() === report.generatedBy.toString()) {
          return;
        }
        
        // Check if already added as collaborator
        const existingCollaborator = collaborators.find(
          (c: any) => c.id === editor._id.toString()
        );
        
        if (existingCollaborator) {
          // Update permissions
          existingCollaborator.role = 'editor';
          existingCollaborator.permissions = ['view', 'edit', 'comment'];
        } else {
          collaborators.push({
            ...formatDocument(editor),
            role: 'editor',
            permissions: ['view', 'edit', 'comment']
          });
        }
      });
    }
    
    // Add viewers if present
    if (report.viewers && report.viewers.length > 0) {
      const viewers = await User.find({
        _id: { $in: report.viewers }
      }).select('_id name email role').lean();
      
      viewers.forEach((viewer: any) => {
        // Skip if already added in another role
        const existingCollaborator = collaborators.find(
          (c: any) => c.id === viewer._id.toString()
        );
        
        if (!existingCollaborator) {
          collaborators.push({
            ...formatDocument(viewer),
            role: 'viewer',
            permissions: ['view']
          });
        }
      });
    }
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_COLLABORATORS,
      entityId: reportId,
      details: { reportId },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        collaborators,
        isPublic: report.isPublic || false,
        publicLink: report.isPublic ? `/reports/public/${report._id}` : null
      },
      'Report collaborators retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/collaborators', error);
    return sendError(
      req, 
      `Error retrieving report collaborators: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Update collaborators for a report
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/collaborators');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, collaborators, isPublic } = body;
    
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
    
    // Check if user has permission to modify collaborators
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can modify collaborators', 403);
    }
    
    // Process collaborators
    if (collaborators && Array.isArray(collaborators)) {
      // Initialize arrays
      const sharedWith: mongoose.Types.ObjectId[] = [];
      const editors: mongoose.Types.ObjectId[] = [];
      const viewers: mongoose.Types.ObjectId[] = [];
      
      // Validate collaborator IDs and roles
      for (const collaborator of collaborators) {
        if (!collaborator.id || !mongoose.Types.ObjectId.isValid(collaborator.id)) {
          return sendError(req, `Invalid collaborator ID: ${collaborator.id}`, 400);
        }
        
        // Skip the owner
        if (collaborator.id === report.generatedBy.toString()) {
          continue;
        }
        
        // Add to appropriate arrays based on role
        const userId = new mongoose.Types.ObjectId(collaborator.id);
        
        switch (collaborator.role) {
          case 'editor':
            editors.push(userId);
            sharedWith.push(userId);
            break;
          case 'viewer':
            viewers.push(userId);
            sharedWith.push(userId);
            break;
          case 'collaborator':
            sharedWith.push(userId);
            break;
          default:
            return sendError(req, `Invalid collaborator role: ${collaborator.role}`, 400);
        }
      }
      
      // Update report with new collaborators
      report.sharedWith = sharedWith;
      report.editors = editors;
      report.viewers = viewers;
    }
    
    // Update public status if provided
    if (typeof isPublic === 'boolean') {
      report.isPublic = isPublic;
    }
    
    // Save the report
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.REPORT_COLLABORATORS,
      entityId: reportId,
      details: { 
        reportId,
        sharedWithCount: report.sharedWith?.length || 0,
        editorsCount: report.editors?.length || 0,
        viewersCount: report.viewers?.length || 0,
        isPublic: report.isPublic
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        sharedWithCount: report.sharedWith?.length || 0,
        editorsCount: report.editors?.length || 0,
        viewersCount: report.viewers?.length || 0,
        isPublic: report.isPublic
      },
      'Report collaborators updated successfully'
    );
  } catch (error) {
    logApiError('api/reports/collaborators', error);
    return sendError(
      req, 
      `Error updating report collaborators: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Add a collaborator to a report
 */
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/collaborators');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId, userId, role } = body;
    
    // Validate required fields
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(req, 'Valid user ID is required', 400);
    }
    
    if (!role || !['editor', 'viewer', 'collaborator'].includes(role)) {
      return sendError(req, 'Valid role is required (editor, viewer, or collaborator)', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to add collaborators
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can add collaborators', 403);
    }
    
    // Check if user exists
    const userToAdd = await User.findById(userId);
    
    if (!userToAdd) {
      return sendError(req, 'User not found', 404);
    }
    
    // Check if user is already the owner
    if (report.generatedBy.toString() === userId) {
      return sendError(req, 'User is already the owner of this report', 400);
    }
    
    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Initialize arrays if they don't exist
    if (!report.sharedWith) report.sharedWith = [];
    if (!report.editors) report.editors = [];
    if (!report.viewers) report.viewers = [];
    
    // Add user to sharedWith if not already there
    if (!report.sharedWith.some((id: any) => id.toString() === userId)) {
      report.sharedWith.push(userObjectId);
    }
    
    // Update role-specific arrays
    switch (role) {
      case 'editor':
        // Add to editors if not already there
        if (!report.editors.some((id: any) => id.toString() === userId)) {
          report.editors.push(userObjectId);
        }
        
        // Remove from viewers if present
        report.viewers = report.viewers.filter((id: any) => id.toString() !== userId);
        break;
        
      case 'viewer':
        // Add to viewers if not already there
        if (!report.viewers.some((id: any) => id.toString() === userId)) {
          report.viewers.push(userObjectId);
        }
        
        // Remove from editors if present
        report.editors = report.editors.filter((id: any) => id.toString() !== userId);
        break;
        
      case 'collaborator':
        // Remove from both editors and viewers
        report.editors = report.editors.filter((id: any) => id.toString() !== userId);
        report.viewers = report.viewers.filter((id: any) => id.toString() !== userId);
        break;
    }
    
    // Save the report
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.ADD_COLLABORATOR,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        collaboratorId: userId,
        role
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        userId,
        role,
        user: {
          id: userToAdd._id,
          name: userToAdd.name,
          email: userToAdd.email
        }
      },
      'Collaborator added successfully'
    );
  } catch (error) {
    logApiError('api/reports/collaborators', error);
    return sendError(
      req, 
      `Error adding collaborator: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Remove a collaborator from a report
 */
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    const userId = url.searchParams.get('userId');
    
    logApiRequest(req, 'api/reports/collaborators');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return sendError(req, 'Valid report ID is required', 400);
    }
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(req, 'Valid user ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the report
    const report = await Report.findById(reportId);
    
    if (!report) {
      return sendError(req, 'Report not found', 404);
    }
    
    // Check if user has permission to remove collaborators
    const isAdmin = user.role === 'admin';
    const isOwner = report.generatedBy.toString() === user.userId;
    
    if (!isAdmin && !isOwner) {
      return sendError(req, 'Only the report owner or administrators can remove collaborators', 403);
    }
    
    // Check if user is trying to remove the owner
    if (report.generatedBy.toString() === userId) {
      return sendError(req, 'Cannot remove the owner from collaborators', 400);
    }
    
    // Remove user from all collaborator arrays
    if (report.sharedWith) {
      report.sharedWith = report.sharedWith.filter((id: any) => id.toString() !== userId);
    }
    
    if (report.editors) {
      report.editors = report.editors.filter((id: any) => id.toString() !== userId);
    }
    
    if (report.viewers) {
      report.viewers = report.viewers.filter((id: any) => id.toString() !== userId);
    }
    
    // Save the report
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.REMOVE_COLLABORATOR,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        collaboratorId: userId
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        reportId,
        userId
      },
      'Collaborator removed successfully'
    );
  } catch (error) {
    logApiError('api/reports/collaborators', error);
    return sendError(
      req, 
      `Error removing collaborator: ${(error as Error).message}`, 
      500
    );
  }
});
