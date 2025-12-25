import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import Recommendation from '@/models/Recommendation';
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

// Create a new report from recommendations
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { assessmentId, recommendationIds, templateId, name } = await req.json();
    
    // Validate required fields
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Valid assessment ID is required' },
        { status: 400 }
      );
    }

    if (!recommendationIds || !Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { message: 'At least one recommendation ID is required' },
        { status: 400 }
      );
    }

    // Validate all recommendation IDs
    for (const id of recommendationIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { message: `Invalid recommendation ID: ${id}` },
          { status: 400 }
        );
      }
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

      // Find all the specified recommendations
      const recommendations = await Recommendation.find({
        _id: { $in: recommendationIds },
        assessment: assessmentId
      })
        .session(session)
        .lean();
        
      if (!recommendations || recommendations.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'No valid recommendations found for this assessment' },
          { status: 404 }
        );
      }

      // Check if all requested recommendations were found
      if (recommendations.length !== recommendationIds.length) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Some recommendation IDs are invalid or do not belong to this assessment' },
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
        // Find default template for recommendation reports
        template = await ReportTemplate.findOne({ 
          type: 'recommendation', 
          isDefault: true,
          isActive: true 
        })
          .session(session)
          .lean();
          
        if (!template) {
          // If no default template, find any active recommendation template
          template = await ReportTemplate.findOne({ 
            type: 'recommendation', 
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
          let chartData: any = {
            type: section.chartType,
            labels: [],
            datasets: []
          };

          // Populate chart data based on dataSource if available
          if (section.dataSource && section.dataSource.type === 'recommendations') {
            switch (section.dataSource.field) {
              case 'priorityDistribution':
                // Count recommendations by priority
                const priorityCounts = {
                  high: recommendations.filter(r => r.priority === 'high').length,
                  medium: recommendations.filter(r => r.priority === 'medium').length,
                  low: recommendations.filter(r => r.priority === 'low').length
                };
                
                chartData.labels = ['High', 'Medium', 'Low'];
                chartData.datasets = [{
                  label: 'Recommendations by Priority',
                  data: [priorityCounts.high, priorityCounts.medium, priorityCounts.low],
                  backgroundColor: ['#FF6384', '#FFCE56', '#36A2EB']
                }];
                break;
              
              case 'categoryDistribution':
                // Count recommendations by category
                const categoryMap: Record<string, number> = {};
                recommendations.forEach(r => {
                  if (r.category) {
                    categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
                  }
                });
                
                chartData.labels = Object.keys(categoryMap);
                chartData.datasets = [{
                  label: 'Recommendations by Category',
                  data: Object.values(categoryMap),
                  backgroundColor: 'rgba(54, 162, 235, 0.2)',
                  borderColor: 'rgb(54, 162, 235)'
                }];
                break;
                
              case 'implementationTimeDistribution':
                // Count recommendations by implementation time
                const timeMap: Record<string, number> = {};
                recommendations.forEach(r => {
                  if (r.implementationTime) {
                    timeMap[r.implementationTime] = (timeMap[r.implementationTime] || 0) + 1;
                  }
                });
                
                chartData.labels = Object.keys(timeMap);
                chartData.datasets = [{
                  label: 'Recommendations by Implementation Time',
                  data: Object.values(timeMap),
                  backgroundColor: 'rgba(75, 192, 192, 0.2)',
                  borderColor: 'rgb(75, 192, 192)'
                }];
                break;
            }
          }
          
          reportSection.content.chartData = chartData;
        }

        // Add table data if section is a table
        if (section.contentType === 'table' && section.dataSource) {
          let tableData: any = {
            headers: [],
            rows: []
          };
          
          // Populate table data based on dataSource if available
          if (section.dataSource.type === 'recommendations') {
            switch (section.dataSource.field) {
              case 'recommendationsList':
                tableData.headers = ['Title', 'Category', 'Priority', 'Implementation Time', 'Estimated Cost', 'Estimated Benefit'];
                
                tableData.rows = recommendations.map(r => [
                  r.title || '',
                  r.category || '',
                  r.priority || '',
                  r.implementationTime || '',
                  r.estimatedCost ? `$${r.estimatedCost.toLocaleString()}` : '$0',
                  r.estimatedBenefit ? `$${r.estimatedBenefit.toLocaleString()}` : '$0'
                ]);
                break;
            }
          }
          
          reportSection.content.tableData = tableData;
        }

        // Add recommendation details to text sections if specified
        if (section.contentType === 'text' && section.dataSource && 
            section.dataSource.type === 'recommendations' && 
            section.dataSource.field === 'recommendationDetails') {
          
          let detailsText = section.defaultContent || '';
          
          // Add each recommendation's details to the text
          recommendations.forEach((rec, index) => {
            detailsText += `\n\n## ${index + 1}. ${rec.title || 'Untitled Recommendation'}\n\n`;
            detailsText += `**Category:** ${rec.category || 'Uncategorized'}\n`;
            detailsText += `**Priority:** ${rec.priority || 'Not specified'}\n`;
            detailsText += `**Implementation Time:** ${rec.implementationTime || 'Not specified'}\n`;
            detailsText += `**Estimated Cost:** $${(rec.estimatedCost || 0).toLocaleString()}\n`;
            detailsText += `**Estimated Benefit:** $${(rec.estimatedBenefit || 0).toLocaleString()}\n\n`;
            detailsText += `${rec.description || 'No description provided.'}\n\n`;
            
            if (rec.implementationSteps && rec.implementationSteps.length > 0) {
              detailsText += `### Implementation Steps:\n\n`;
              rec.implementationSteps.forEach((step, stepIndex) => {
                detailsText += `${stepIndex + 1}. ${step}\n`;
              });
            }
          });
          
          reportSection.content.text = detailsText;
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
        sharedWith: [],
        metadata: {
          recommendationIds: recommendationIds
        }
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
          action: 'create-report-from-recommendations', 
          assessmentId,
          recommendationCount: recommendationIds.length,
          templateId: template._id,
          reportName: name
        },
        request: req
      });

      return NextResponse.json({
        message: 'Recommendation report created successfully',
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
    console.error('Error creating report from recommendations:', error);
    
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
