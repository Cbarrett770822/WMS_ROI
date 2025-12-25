import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AssessmentTemplate from '@/models/AssessmentTemplate';
import Assessment from '@/models/Assessment';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Get a specific assessment template
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').slice(-1)[0];
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the template
    const template = await AssessmentTemplate.findById(templateId)
      .populate('createdBy', 'username firstName lastName')
      .populate('updatedBy', 'username firstName lastName');
    
    if (!template) {
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      );
    }

    // Non-admin users can only view published templates
    if (user.role !== 'admin' && template.status !== 'published') {
      return NextResponse.json(
        { message: 'Template not available' },
        { status: 403 }
      );
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      entityId: templateId,
      details: { action: 'view-template', templateName: template.name },
      request: req
    });

    // Return the template
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching assessment template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update an assessment template (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').slice(-1)[0];
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const updateData = await req.json();
    
    // Connect to the database
    await connectToDatabase();

    // Find the template
    const template = await AssessmentTemplate.findById(templateId);
    
    if (!template) {
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if it would conflict
    if (updateData.name && updateData.name !== template.name) {
      const existingTemplate = await AssessmentTemplate.findOne({ 
        name: updateData.name,
        _id: { $ne: templateId }
      });
      
      if (existingTemplate) {
        return NextResponse.json(
          { message: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update fields
    if (updateData.name) template.name = updateData.name;
    if (updateData.description !== undefined) template.description = updateData.description;
    if (updateData.status) template.status = updateData.status;
    if (updateData.sections) template.sections = updateData.sections;
    if (updateData.targetIndustries) template.targetIndustries = updateData.targetIndustries;
    if (updateData.targetWarehouseTypes) template.targetWarehouseTypes = updateData.targetWarehouseTypes;
    if (updateData.targetCompanySizes) template.targetCompanySizes = updateData.targetCompanySizes;
    if (updateData.version) template.version = updateData.version;
    
    // Update metadata
    template.updatedBy = new mongoose.Types.ObjectId(user.userId);
    template.updatedAt = new Date();

    // If status is changing to published, set publishedAt
    if (updateData.status === 'published' && template.status !== 'published') {
      template.publishedAt = new Date();
    }

    // Save template
    await template.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.UPDATE,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      entityId: templateId,
      details: { 
        action: 'update-template', 
        templateName: template.name,
        updatedFields: Object.keys(updateData)
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Assessment template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating assessment template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete an assessment template (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').slice(-1)[0];
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the template
    const template = await AssessmentTemplate.findById(templateId);
    
    if (!template) {
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      );
    }

    // Check if template is used in any assessments
    const assessmentCount = await Assessment.countDocuments({ template: templateId });
    
    if (assessmentCount > 0) {
      return NextResponse.json(
        { 
          message: 'Cannot delete template that is used in assessments',
          assessmentCount
        },
        { status: 400 }
      );
    }

    // Delete the template
    await AssessmentTemplate.deleteOne({ _id: templateId });

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.DELETE,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      entityId: templateId,
      details: { 
        action: 'delete-template', 
        templateName: template.name
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Assessment template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
