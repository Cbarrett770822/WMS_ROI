import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
import RoiCalculation from '@/models/RoiCalculation';
import Recommendation from '@/models/Recommendation';
import { withAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Export assessment data in various formats
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').slice(-2)[0];
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const sections = url.searchParams.get('sections')?.split(',') || ['all'];
    const includeComments = url.searchParams.get('includeComments') === 'true';
    
    // Validate format
    const validFormats = ['json', 'summary', 'report'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { message: `Invalid format. Supported formats: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name industry size revenue employees')
      .populate('warehouse', 'name location size type')
      .populate('createdBy', 'username firstName lastName')
      .populate('updatedBy', 'username firstName lastName');
    
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to export this assessment
    const isAdmin = user.role === 'admin';
    const isCreator = assessment.createdBy && 
      assessment.createdBy._id.toString() === user.userId;
    const isAssigned = assessment.assignedUsers?.some(
      (assignedUser: any) => assignedUser.toString() === user.userId
    );

    if (!isAdmin && !isCreator && !isAssigned) {
      return NextResponse.json(
        { message: 'You do not have permission to export this assessment' },
        { status: 403 }
      );
    }

    // Prepare export data based on format and sections
    let exportData: any = {
      assessment: {
        id: assessment._id,
        name: assessment.name,
        description: assessment.description,
        status: assessment.status,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        createdBy: assessment.createdBy ? {
          id: assessment.createdBy._id,
          username: assessment.createdBy.username,
          name: `${assessment.createdBy.firstName} ${assessment.createdBy.lastName}`
        } : null,
        updatedBy: assessment.updatedBy ? {
          id: assessment.updatedBy._id,
          username: assessment.updatedBy.username,
          name: `${assessment.updatedBy.firstName} ${assessment.updatedBy.lastName}`
        } : null
      },
      company: assessment.company ? {
        id: assessment.company._id,
        name: assessment.company.name,
        industry: assessment.company.industry,
        size: assessment.company.size,
        revenue: assessment.company.revenue,
        employees: assessment.company.employees
      } : null,
      warehouse: assessment.warehouse ? {
        id: assessment.warehouse._id,
        name: assessment.warehouse.name,
        location: assessment.warehouse.location,
        size: assessment.warehouse.size,
        type: assessment.warehouse.type
      } : null
    };

    // Add questionnaire responses if requested
    if (sections.includes('all') || sections.includes('questionnaire')) {
      const questionnaireResponses = await QuestionnaireResponse.find({
        assessment: assessmentId
      }).lean();

      exportData.questionnaireResponses = questionnaireResponses;
    }

    // Add ROI calculations if requested
    if (sections.includes('all') || sections.includes('roi')) {
      const roiCalculations = await RoiCalculation.find({
        assessment: assessmentId
      }).lean();

      exportData.roiCalculations = roiCalculations;
    }

    // Add recommendations if requested
    if (sections.includes('all') || sections.includes('recommendations')) {
      const recommendations = await Recommendation.find({
        assessment: assessmentId
      }).lean();

      exportData.recommendations = recommendations;
    }

    // Add comments if requested
    if (includeComments) {
      const Comment = mongoose.model('Comment');
      const comments = await Comment.find({
        assessment: assessmentId
      })
      .populate('author', 'username firstName lastName')
      .sort({ createdAt: 1 })
      .lean();

      exportData.comments = comments;
    }

    // Format the export based on the requested format
    let formattedExport: any;
    
    switch (format) {
      case 'summary':
        // Create a summarized version with key metrics
        formattedExport = {
          assessmentName: assessment.name,
          company: assessment.company?.name || 'N/A',
          warehouse: assessment.warehouse?.name || 'N/A',
          status: assessment.status,
          createdAt: assessment.createdAt,
          completedSections: 0,
          totalSections: 0,
          keyMetrics: {}
        };
        
        // Count completed questionnaire sections
        if (exportData.questionnaireResponses) {
          const sections = new Set();
          const completedSections = new Set();
          
          exportData.questionnaireResponses.forEach((response: any) => {
            sections.add(response.section);
            if (response.completed) {
              completedSections.add(response.section);
            }
          });
          
          formattedExport.completedSections = completedSections.size;
          formattedExport.totalSections = sections.size;
        }
        
        // Add key ROI metrics if available
        if (exportData.roiCalculations && exportData.roiCalculations.length > 0) {
          const roiSummary = exportData.roiCalculations.reduce((summary: any, calc: any) => {
            summary.totalInvestment = (summary.totalInvestment || 0) + (calc.implementationCost || 0);
            summary.annualSavings = (summary.annualSavings || 0) + (calc.annualSavings || 0);
            return summary;
          }, {});
          
          formattedExport.keyMetrics = {
            totalInvestment: roiSummary.totalInvestment,
            annualSavings: roiSummary.annualSavings,
            paybackPeriod: roiSummary.totalInvestment / roiSummary.annualSavings,
            roi: (roiSummary.annualSavings / roiSummary.totalInvestment) * 100
          };
        }
        
        // Add recommendation count
        if (exportData.recommendations) {
          formattedExport.recommendationCount = exportData.recommendations.length;
          
          // Count by priority
          const priorityCounts = exportData.recommendations.reduce((counts: any, rec: any) => {
            counts[rec.priority] = (counts[rec.priority] || 0) + 1;
            return counts;
          }, {});
          
          formattedExport.recommendationsByPriority = priorityCounts;
        }
        
        break;
        
      case 'report':
        // Create a structured report format suitable for PDF generation
        formattedExport = {
          title: `Assessment Report: ${assessment.name}`,
          generatedAt: new Date(),
          generatedBy: `${user.firstName} ${user.lastName}`,
          sections: [
            {
              title: 'Assessment Overview',
              content: {
                name: assessment.name,
                description: assessment.description,
                status: assessment.status,
                createdAt: assessment.createdAt,
                company: assessment.company?.name,
                warehouse: assessment.warehouse?.name
              }
            }
          ]
        };
        
        // Add company section if available
        if (assessment.company) {
          formattedExport.sections.push({
            title: 'Company Information',
            content: {
              name: assessment.company.name,
              industry: assessment.company.industry,
              size: assessment.company.size,
              revenue: assessment.company.revenue,
              employees: assessment.company.employees
            }
          });
        }
        
        // Add warehouse section if available
        if (assessment.warehouse) {
          formattedExport.sections.push({
            title: 'Warehouse Information',
            content: {
              name: assessment.warehouse.name,
              location: assessment.warehouse.location,
              size: assessment.warehouse.size,
              type: assessment.warehouse.type
            }
          });
        }
        
        // Add questionnaire section if available
        if (exportData.questionnaireResponses && exportData.questionnaireResponses.length > 0) {
          // Group responses by section
          const responsesBySection = exportData.questionnaireResponses.reduce((grouped: any, response: any) => {
            if (!grouped[response.section]) {
              grouped[response.section] = [];
            }
            grouped[response.section].push(response);
            return grouped;
          }, {});
          
          formattedExport.sections.push({
            title: 'Questionnaire Responses',
            content: Object.keys(responsesBySection).map(section => ({
              section,
              responses: responsesBySection[section]
            }))
          });
        }
        
        // Add ROI section if available
        if (exportData.roiCalculations && exportData.roiCalculations.length > 0) {
          // Calculate summary metrics
          const roiSummary = exportData.roiCalculations.reduce((summary: any, calc: any) => {
            summary.totalInvestment = (summary.totalInvestment || 0) + (calc.implementationCost || 0);
            summary.annualSavings = (summary.annualSavings || 0) + (calc.annualSavings || 0);
            return summary;
          }, {});
          
          formattedExport.sections.push({
            title: 'Return on Investment',
            content: {
              summary: {
                totalInvestment: roiSummary.totalInvestment,
                annualSavings: roiSummary.annualSavings,
                paybackPeriod: roiSummary.totalInvestment / roiSummary.annualSavings,
                roi: (roiSummary.annualSavings / roiSummary.totalInvestment) * 100
              },
              calculations: exportData.roiCalculations
            }
          });
        }
        
        // Add recommendations section if available
        if (exportData.recommendations && exportData.recommendations.length > 0) {
          formattedExport.sections.push({
            title: 'Recommendations',
            content: exportData.recommendations.sort((a: any, b: any) => {
              // Sort by priority (high to low)
              const priorityOrder = { high: 1, medium: 2, low: 3 };
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            })
          });
        }
        
        // Add comments section if requested
        if (includeComments && exportData.comments && exportData.comments.length > 0) {
          formattedExport.sections.push({
            title: 'Comments',
            content: exportData.comments.map((comment: any) => ({
              author: `${comment.author.firstName} ${comment.author.lastName}`,
              date: comment.createdAt,
              content: comment.content,
              section: comment.section
            }))
          });
        }
        
        break;
        
      case 'json':
      default:
        // Return the full data structure
        formattedExport = exportData;
        break;
    }

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.EXPORT,
      entityType: EntityTypes.ASSESSMENT,
      entityId: assessmentId,
      details: { 
        action: 'export-assessment', 
        format,
        sections: sections.join(','),
        includeComments
      },
      request: req
    });

    // Return the formatted export
    return NextResponse.json(formattedExport);
  } catch (error) {
    console.error('Error exporting assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
