import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AssessmentTemplate from '@/models/AssessmentTemplate';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Clone an existing assessment template (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Get template ID from URL
    const parts = req.url.split('/');
    const templateId = parts[parts.indexOf('assessment-templates') + 1];
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Get clone options from request body
    const { newName, keepStatus = false } = await req.json();
    
    if (!newName) {
      return NextResponse.json(
        { message: 'New template name is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if template with new name already exists
    const existingTemplate = await AssessmentTemplate.findOne({ name: newName });
    
    if (existingTemplate) {
      return NextResponse.json(
        { message: 'A template with this name already exists' },
        { status: 409 }
      );
    }

    // Find the source template
    const sourceTemplate = await AssessmentTemplate.findById(templateId);
    
    if (!sourceTemplate) {
      return NextResponse.json(
        { message: 'Source template not found' },
        { status: 404 }
      );
    }

    // Create a new template based on the source
    const clonedTemplate = new AssessmentTemplate({
      name: newName,
      description: `${sourceTemplate.description} (Cloned)`,
      // Set status to draft unless keepStatus is true
      status: keepStatus ? sourceTemplate.status : 'draft',
      version: sourceTemplate.version,
      sections: JSON.parse(JSON.stringify(sourceTemplate.sections)), // Deep copy
      targetIndustries: sourceTemplate.targetIndustries,
      targetWarehouseTypes: sourceTemplate.targetWarehouseTypes,
      targetCompanySizes: sourceTemplate.targetCompanySizes,
      createdBy: user.userId,
      createdAt: new Date(),
      updatedBy: user.userId,
      updatedAt: new Date()
    });

    // If keeping published status and source was published, set publishedAt
    if (keepStatus && sourceTemplate.status === 'published') {
      clonedTemplate.publishedAt = new Date();
    }

    // Save the cloned template
    await clonedTemplate.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      entityId: clonedTemplate._id.toString(),
      details: { 
        action: 'clone-template', 
        sourceTemplateId: templateId,
        sourceTemplateName: sourceTemplate.name,
        newTemplateName: newName
      },
      request: req
    });

    // Return success with the cloned template
    return NextResponse.json({
      message: 'Assessment template cloned successfully',
      template: clonedTemplate
    }, { status: 201 });
  } catch (error) {
    console.error('Error cloning assessment template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
