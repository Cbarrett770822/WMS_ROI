import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import { withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Perform bulk operations on report templates (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { operation, templateIds, data } = await req.json();
    
    // Validate required fields
    if (!operation || typeof operation !== 'string') {
      return NextResponse.json(
        { message: 'Valid operation is required' },
        { status: 400 }
      );
    }

    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json(
        { message: 'At least one template ID is required' },
        { status: 400 }
      );
    }

    // Validate all template IDs
    for (const id of templateIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { message: `Invalid template ID: ${id}` },
          { status: 400 }
        );
      }
    }

    // Connect to the database
    await connectToDatabase();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find all the specified templates
      const templates = await ReportTemplate.find({
        _id: { $in: templateIds }
      })
        .session(session)
        .lean();
        
      if (!templates || templates.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'No valid templates found' },
          { status: 404 }
        );
      }

      // Process based on operation
      let result;
      let auditDetails = {};
      
      switch (operation) {
        case 'delete':
          // Check if any template is in use
          // This would require checking the Report collection for references
          // For now, we'll just delete the templates
          
          result = await ReportTemplate.deleteMany({
            _id: { $in: templateIds }
          }).session(session);
          
          auditDetails = {
            action: 'bulk-delete',
            templateCount: templateIds.length,
            templateIds
          };
          break;
          
        case 'activate':
          // Activate templates
          result = await ReportTemplate.updateMany(
            { _id: { $in: templateIds } },
            { $set: { isActive: true } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-activate',
            templateCount: templateIds.length,
            templateIds
          };
          break;
          
        case 'deactivate':
          // Deactivate templates
          result = await ReportTemplate.updateMany(
            { _id: { $in: templateIds } },
            { $set: { isActive: false } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-deactivate',
            templateCount: templateIds.length,
            templateIds
          };
          break;
          
        case 'update-type':
          // Validate type data
          if (!data || !data.type || !['assessment', 'roi', 'recommendation', 'custom'].includes(data.type)) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'Valid type is required for update-type operation' },
              { status: 400 }
            );
          }
          
          // Update template type
          result = await ReportTemplate.updateMany(
            { _id: { $in: templateIds } },
            { $set: { type: data.type } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-update-type',
            templateCount: templateIds.length,
            templateIds,
            newType: data.type
          };
          break;
          
        case 'clear-default':
          // Clear default status for templates of specific types
          if (!data || !data.types || !Array.isArray(data.types) || data.types.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'Template types are required for clear-default operation' },
              { status: 400 }
            );
          }
          
          // Validate all types
          for (const type of data.types) {
            if (!['assessment', 'roi', 'recommendation', 'custom'].includes(type)) {
              await session.abortTransaction();
              session.endSession();
              return NextResponse.json(
                { message: `Invalid template type: ${type}` },
                { status: 400 }
              );
            }
          }
          
          // Clear default status for templates of specified types
          result = await ReportTemplate.updateMany(
            { type: { $in: data.types } },
            { $set: { isDefault: false } }
          ).session(session);
          
          auditDetails = {
            action: 'bulk-clear-default',
            types: data.types
          };
          break;
          
        default:
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: `Unsupported operation: ${operation}` },
            { status: 400 }
          );
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.BULK_UPDATE,
        entityType: EntityTypes.REPORT_TEMPLATE,
        details: auditDetails,
        request: req
      });

      return NextResponse.json({
        message: `Bulk ${operation} operation completed successfully`,
        affectedTemplates: templates.length,
        result
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
    console.error(`Error performing bulk operation on report templates:`, error);
    
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
