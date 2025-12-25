import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Clone a report template (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').slice(-2)[0];
    const { name, description } = await req.json();
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid report template ID' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: 'Name is required for the cloned template' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the source template
    const sourceTemplate = await ReportTemplate.findById(templateId);
    if (!sourceTemplate) {
      return NextResponse.json(
        { message: 'Source report template not found' },
        { status: 404 }
      );
    }

    // Check if a template with the same name and type already exists
    const existingTemplate = await ReportTemplate.findOne({
      name,
      type: sourceTemplate.type
    });
    
    if (existingTemplate) {
      return NextResponse.json(
        { message: 'A report template with this name and type already exists' },
        { status: 409 }
      );
    }

    // Create a new template based on the source
    const clonedTemplate = new ReportTemplate({
      name,
      description: description || `Clone of ${sourceTemplate.name}`,
      type: sourceTemplate.type,
      sections: JSON.parse(JSON.stringify(sourceTemplate.sections)), // Deep copy sections
      isDefault: false, // Cloned templates are never default
      isActive: true,
      createdBy: user.userId
    });
    
    await clonedTemplate.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: clonedTemplate._id,
      details: { 
        action: 'clone-report-template', 
        sourceTemplateId: templateId,
        sourceTemplateName: sourceTemplate.name
      },
      request: req
    });

    return NextResponse.json({
      message: 'Report template cloned successfully',
      template: clonedTemplate
    }, { status: 201 });
  } catch (error) {
    console.error('Error cloning report template:', error);
    
    // Handle MongoDB transaction errors with retry
    if (error.name === 'MongoError' && 
        (error.code === 112 || 
         (error.errorLabels && error.errorLabels.includes('TransientTransactionError')))) {
      return NextResponse.json(
        { message: 'Database conflict detected, please try again' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
