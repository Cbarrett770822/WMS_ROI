import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Validate a report for completeness and consistency
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/validate');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { reportId } = body;
    
    // Validate required fields
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
    
    // Perform validation checks
    const validationResults = validateReport(report);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.VALIDATE,
      entityType: EntityTypes.REPORT,
      entityId: reportId,
      details: { 
        reportId,
        validationPassed: validationResults.isValid,
        issueCount: validationResults.issues.length
      },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(validationResults),
      validationResults.isValid 
        ? 'Report validation passed successfully' 
        : 'Report validation completed with issues'
    );
  } catch (error) {
    logApiError('api/reports/validate', error);
    return sendError(
      req, 
      `Error validating report: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Validate a report for completeness and consistency
 */
function validateReport(report: any) {
  // Initialize validation results
  const validationResults = {
    isValid: true,
    issues: [] as any[],
    warnings: [] as any[],
    score: 100,
    requiredSections: {
      total: 0,
      completed: 0
    },
    optionalSections: {
      total: 0,
      completed: 0
    }
  };
  
  // Check for required fields
  if (!report.title || report.title.trim().length === 0) {
    validationResults.issues.push({
      type: 'missing-field',
      field: 'title',
      message: 'Report title is required',
      severity: 'high'
    });
    validationResults.isValid = false;
    validationResults.score -= 10;
  }
  
  if (!report.company || !mongoose.Types.ObjectId.isValid(report.company)) {
    validationResults.issues.push({
      type: 'missing-field',
      field: 'company',
      message: 'Company association is required',
      severity: 'high'
    });
    validationResults.isValid = false;
    validationResults.score -= 10;
  }
  
  // Check for sections
  if (!report.sections || report.sections.length === 0) {
    validationResults.issues.push({
      type: 'missing-sections',
      message: 'Report has no sections',
      severity: 'high'
    });
    validationResults.isValid = false;
    validationResults.score -= 20;
  } else {
    // Define required and optional section types
    const requiredSectionTypes = ['executive-summary', 'roi-analysis'];
    const optionalSectionTypes = ['operational-analysis', 'implementation-plan', 'recommendations'];
    
    // Track section counts
    validationResults.requiredSections.total = requiredSectionTypes.length;
    validationResults.optionalSections.total = optionalSectionTypes.length;
    
    // Check for required sections
    const sectionTypes = report.sections.map((section: any) => section.type);
    
    requiredSectionTypes.forEach(type => {
      if (!sectionTypes.includes(type)) {
        validationResults.issues.push({
          type: 'missing-section',
          sectionType: type,
          message: `Required section "${type}" is missing`,
          severity: 'high'
        });
        validationResults.isValid = false;
        validationResults.score -= 15;
      } else {
        validationResults.requiredSections.completed++;
      }
    });
    
    // Check for optional sections
    optionalSectionTypes.forEach(type => {
      if (sectionTypes.includes(type)) {
        validationResults.optionalSections.completed++;
      } else {
        validationResults.warnings.push({
          type: 'missing-optional-section',
          sectionType: type,
          message: `Optional section "${type}" is missing`,
          severity: 'low'
        });
        validationResults.score -= 5;
      }
    });
    
    // Check section content
    report.sections.forEach((section: any) => {
      // Check for empty content
      if (!section.content || section.content.trim().length === 0) {
        validationResults.issues.push({
          type: 'empty-section',
          sectionId: section._id,
          sectionTitle: section.title,
          message: `Section "${section.title}" has no content`,
          severity: 'medium'
        });
        validationResults.score -= 5;
        
        if (requiredSectionTypes.includes(section.type)) {
          validationResults.isValid = false;
        }
      }
      
      // Check for missing title
      if (!section.title || section.title.trim().length === 0) {
        validationResults.issues.push({
          type: 'missing-section-title',
          sectionId: section._id,
          message: 'Section is missing a title',
          severity: 'medium'
        });
        validationResults.score -= 3;
      }
    });
  }
  
  // Check for ROI data consistency
  const roiSection = report.sections?.find((section: any) => section.type === 'roi-analysis');
  if (roiSection && roiSection.data) {
    // Check if investment and returns are present
    if (!roiSection.data.investment || !roiSection.data.returns) {
      validationResults.issues.push({
        type: 'incomplete-roi-data',
        sectionId: roiSection._id,
        message: 'ROI section is missing investment or returns data',
        severity: 'medium'
      });
      validationResults.isValid = false;
      validationResults.score -= 10;
    } 
    // Check if investment and returns are consistent
    else if (roiSection.data.investment.total <= 0 || roiSection.data.returns.annual <= 0) {
      validationResults.issues.push({
        type: 'invalid-roi-data',
        sectionId: roiSection._id,
        message: 'ROI section has invalid investment or returns values',
        severity: 'medium'
      });
      validationResults.isValid = false;
      validationResults.score -= 10;
    }
    
    // Check if metrics are consistent
    if (roiSection.data.metrics) {
      const { paybackPeriod, roiPercentage } = roiSection.data.metrics;
      const { total: investment } = roiSection.data.investment;
      const { annual: returns } = roiSection.data.returns;
      
      // Calculate expected payback period
      const expectedPayback = investment / returns;
      
      // Check if payback period is consistent with investment and returns
      if (paybackPeriod && Math.abs(paybackPeriod - expectedPayback) > 0.5) {
        validationResults.warnings.push({
          type: 'inconsistent-payback',
          sectionId: roiSection._id,
          message: 'Payback period is inconsistent with investment and returns',
          severity: 'low',
          details: {
            stated: paybackPeriod,
            calculated: expectedPayback.toFixed(2)
          }
        });
        validationResults.score -= 5;
      }
      
      // Calculate expected ROI percentage
      const expectedRoi = (returns / investment) * 100;
      
      // Check if ROI percentage is consistent with investment and returns
      if (roiPercentage && Math.abs(roiPercentage - expectedRoi) > 5) {
        validationResults.warnings.push({
          type: 'inconsistent-roi',
          sectionId: roiSection._id,
          message: 'ROI percentage is inconsistent with investment and returns',
          severity: 'low',
          details: {
            stated: roiPercentage,
            calculated: expectedRoi.toFixed(2)
          }
        });
        validationResults.score -= 5;
      }
    }
  }
  
  // Check for implementation plan if ROI is significant
  if (roiSection && roiSection.data && roiSection.data.investment && roiSection.data.investment.total > 100000) {
    const implementationSection = report.sections?.find((section: any) => section.type === 'implementation-plan');
    if (!implementationSection) {
      validationResults.warnings.push({
        type: 'missing-implementation-plan',
        message: 'Implementation plan is recommended for high-value investments',
        severity: 'medium',
        details: {
          investmentAmount: roiSection.data.investment.total
        }
      });
      validationResults.score -= 8;
    }
  }
  
  // Check for recommendations
  const recommendationsSection = report.sections?.find((section: any) => section.type === 'recommendations');
  if (!recommendationsSection && !report.recommendations) {
    validationResults.warnings.push({
      type: 'missing-recommendations',
      message: 'Report has no recommendations section or data',
      severity: 'medium'
    });
    validationResults.score -= 8;
  }
  
  // Ensure score doesn't go below 0
  validationResults.score = Math.max(0, validationResults.score);
  
  // Determine overall validity
  validationResults.isValid = validationResults.isValid && validationResults.score >= 70;
  
  return validationResults;
}
