import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import ReportTemplate from '@/models/ReportTemplate';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Helper function to check if user has access to the assessment
async function hasAssessmentAccess(userId: string, assessment: any, isAdmin: boolean) {
  // Admin has access to all assessments
  if (isAdmin) return true;
  
  // Creator has access
  if (assessment.createdBy.toString() === userId) return true;
  
  // Assigned users have access
  if (assessment.assignedTo?.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Create a new report from an assessment
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { assessmentId, roiCalculationId, templateId, name } = await req.json();
    
    // Validate required fields
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Valid assessment ID is required' },
        { status: 400 }
      );
    }

    if (!roiCalculationId || !mongoose.Types.ObjectId.isValid(roiCalculationId)) {
      return NextResponse.json(
        { message: 'Valid ROI calculation ID is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { message: 'Report name is required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the assessment
      const assessment = await Assessment.findById(assessmentId)
        .session(session)
        .lean();
        
      if (!assessment) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Assessment not found' },
          { status: 404 }
        );
      }

      // Check if assessment is completed
      if (assessment.status !== 'completed') {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Cannot create a report for an incomplete assessment' },
          { status: 400 }
        );
      }

      // Check if user has access to the assessment
      const hasAccess = await hasAssessmentAccess(
        user.userId,
        assessment,
        user.role === 'admin'
      );
      
      if (!hasAccess) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'You do not have access to this assessment' },
          { status: 403 }
        );
      }

      // Find the ROI calculation
      const roiCalculation = await ROICalculation.findById(roiCalculationId)
        .session(session)
        .lean();
        
      if (!roiCalculation) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'ROI calculation not found' },
          { status: 404 }
        );
      }

      // Check if ROI calculation belongs to the assessment
      if (roiCalculation.assessment.toString() !== assessmentId) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'ROI calculation does not belong to the specified assessment' },
          { status: 400 }
        );
      }

      // Find the report template (use default if not specified)
      let template;
      
      if (templateId && mongoose.Types.ObjectId.isValid(templateId)) {
        template = await ReportTemplate.findById(templateId)
          .session(session)
          .lean();
          
        if (!template) {
          await session.abortTransaction();
          session.endSession();
          return NextResponse.json(
            { message: 'Report template not found' },
            { status: 404 }
          );
        }
      } else {
        // Find default template for assessment reports
        template = await ReportTemplate.findOne({ 
          type: 'assessment', 
          isDefault: true,
          isActive: true 
        })
          .session(session)
          .lean();
          
        if (!template) {
          // If no default template, find any active assessment template
          template = await ReportTemplate.findOne({ 
            type: 'assessment', 
            isActive: true 
          })
            .session(session)
            .lean();
            
          if (!template) {
            await session.abortTransaction();
            session.endSession();
            return NextResponse.json(
              { message: 'No suitable report template found' },
              { status: 404 }
            );
          }
        }
      }

      // Check if a report with the same name already exists for this assessment
      const existingReport = await Report.findOne({
        name: name.trim(),
        assessment: assessmentId
      })
        .session(session)
        .lean();
        
      if (existingReport) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'A report with this name already exists for this assessment' },
          { status: 409 }
        );
      }

      // Process template sections to create report sections
      const sections = template.sections.map((section: any) => {
        const reportSection = {
          sectionId: section.sectionId,
          title: section.title,
          order: section.order,
          content: {
            type: section.contentType,
            text: section.defaultContent || ''
          }
        };

        // Add chart data if section is a chart
        if (section.contentType === 'chart' && section.chartType) {
          reportSection.content.chartData = {
            type: section.chartType,
            labels: [],
            datasets: []
          };
        }

        // Add table data if section is a table
        if (section.contentType === 'table') {
          reportSection.content.tableData = {
            headers: [],
            rows: []
          };
        }

        return reportSection;
      });

      // Create the new report
      const report = new Report({
        name: name.trim(),
        assessment: assessmentId,
        template: template._id,
        company: assessment.company,
        warehouse: assessment.warehouse,
        sections,
        generatedBy: user.userId,
        generatedAt: new Date(),
        status: 'draft',
        sharedWith: []
      });

      await report.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Log the audit event
      await createAuditLog({
        userId: user.userId,
        action: AuditActions.CREATE,
        entityType: EntityTypes.REPORT,
        entityId: report._id,
        details: { 
          action: 'create-report-from-assessment', 
          assessmentId,
          templateId: template._id,
          reportName: name
        },
        request: req
      });

      return NextResponse.json({
        message: 'Report created successfully',
        report
      }, { status: 201 });
    } catch (error) {
      // Abort transaction on error
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error creating report from assessment:', error);
    
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
