import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import ReportTemplate from '@/models/ReportTemplate';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Helper function to check if user has access to the ROI calculation
async function hasROICalculationAccess(userId: string, roiCalculation: any, assessment: any, isAdmin: boolean) {
  // Admin has access to all ROI calculations
  if (isAdmin) return true;
  
  // Creator has access
  if (roiCalculation.createdBy.toString() === userId) return true;
  
  // Assessment creator has access
  if (assessment && assessment.createdBy.toString() === userId) return true;
  
  // Assigned users have access
  if (assessment && assessment.assignedTo?.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Create a new report from an ROI calculation
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { roiCalculationId, templateId, name } = await req.json();
    
    // Validate required fields
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

      // Find the associated assessment
      const assessment = await Assessment.findById(roiCalculation.assessment)
        .session(session)
        .lean();
        
      if (!assessment) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'Associated assessment not found' },
          { status: 404 }
        );
      }

      // Check if user has access to the ROI calculation
      const hasAccess = await hasROICalculationAccess(
        user.userId,
        roiCalculation,
        assessment,
        user.role === 'admin'
      );
      
      if (!hasAccess) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: 'You do not have access to this ROI calculation' },
          { status: 403 }
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
        // Find default template for ROI reports
        template = await ReportTemplate.findOne({ 
          type: 'roi', 
          isDefault: true,
          isActive: true 
        })
          .session(session)
          .lean();
          
        if (!template) {
          // If no default template, find any active ROI template
          template = await ReportTemplate.findOne({ 
            type: 'roi', 
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

      // Check if a report with the same name already exists for this ROI calculation
      const existingReport = await Report.findOne({
        name: name.trim(),
        assessment: assessment._id
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

      // Process template sections to create report sections with ROI-specific data
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
          if (section.dataSource && section.dataSource.type === 'roi') {
            switch (section.dataSource.field) {
              case 'financialMetrics':
                chartData.labels = ['Investment', 'Annual Savings', 'NPV', 'ROI (%)'];
                chartData.datasets = [{
                  label: 'Financial Metrics',
                  data: [
                    roiCalculation.financialMetrics?.totalInvestment || 0,
                    roiCalculation.financialMetrics?.annualSavings || 0,
                    roiCalculation.financialMetrics?.npv || 0,
                    roiCalculation.financialMetrics?.roiPercentage || 0
                  ],
                  backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
                }];
                break;
              
              case 'categoryScores':
                if (roiCalculation.categoryScores) {
                  chartData.labels = Object.keys(roiCalculation.categoryScores);
                  chartData.datasets = [{
                    label: 'Category Scores',
                    data: Object.values(roiCalculation.categoryScores),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgb(54, 162, 235)'
                  }];
                }
                break;
                
              case 'paybackPeriod':
                chartData.type = 'line';
                chartData.labels = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`);
                
                // Calculate cumulative savings over time
                const monthlySavings = (roiCalculation.financialMetrics?.annualSavings || 0) / 12;
                const investment = roiCalculation.financialMetrics?.totalInvestment || 0;
                
                chartData.datasets = [{
                  label: 'Cumulative Savings',
                  data: Array.from({ length: 12 }, (_, i) => (i + 1) * monthlySavings),
                  borderColor: 'rgb(54, 162, 235)'
                }, {
                  label: 'Investment',
                  data: Array(12).fill(investment),
                  borderColor: 'rgb(255, 99, 132)',
                  borderDash: [5, 5]
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
          if (section.dataSource.type === 'roi') {
            switch (section.dataSource.field) {
              case 'operationalMetrics':
                tableData.headers = ['Metric', 'Current Value', 'Target Value', 'Improvement'];
                
                if (roiCalculation.operationalMetrics) {
                  tableData.rows = Object.entries(roiCalculation.operationalMetrics).map(([key, value]: [string, any]) => [
                    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // Format camelCase to Title Case
                    value.currentValue || 0,
                    value.targetValue || 0,
                    value.improvement || 0
                  ]);
                }
                break;
                
              case 'financialMetrics':
                tableData.headers = ['Metric', 'Value'];
                
                if (roiCalculation.financialMetrics) {
                  tableData.rows = Object.entries(roiCalculation.financialMetrics).map(([key, value]: [string, any]) => [
                    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // Format camelCase to Title Case
                    typeof value === 'number' ? value : 0
                  ]);
                }
                break;
            }
          }
          
          reportSection.content.tableData = tableData;
        }

        return reportSection;
      });

      // Create the new report
      const report = new Report({
        name: name.trim(),
        assessment: assessment._id,
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
          action: 'create-report-from-roi', 
          roiCalculationId,
          templateId: template._id,
          reportName: name
        },
        request: req
      });

      return NextResponse.json({
        message: 'ROI report created successfully',
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
    console.error('Error creating report from ROI calculation:', error);
    
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
