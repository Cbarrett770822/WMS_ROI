import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Set a report template as default for its type (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').slice(-2)[0];
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid report template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the template to set as default
      const template = await ReportTemplate.findById(templateId).session(session);
      
      if (!template) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Report template not found' },
          { status: 404 }
        );
      }

      // Get the template type
      const templateType = template.type;

      // Clear default flag from all templates of the same type
      await ReportTemplate.updateMany(
        { type: templateType, isDefault: true },
        { $set: { isDefault: false } },
        { session }
      );

      // Set this template as default
      template.isDefault = true;
      await template.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.UPDATE,
        entityType: EntityTypes.REPORT_TEMPLATE,
        entityId: templateId,
        details: { 
          action: 'set-default-template', 
          templateType: templateType
        },
        request: req
      });

      return NextResponse.json({
        message: `Template successfully set as default for ${templateType} reports`,
        template
      });
    } catch (error) {
      // Abort transaction on error
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error setting default template:', error);
    
    // Handle MongoDB transaction errors with retry mechanism
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
