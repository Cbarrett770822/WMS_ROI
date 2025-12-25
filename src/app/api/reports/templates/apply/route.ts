import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import Report from '@/models/Report';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Apply a template to create a new report or update an existing one
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/templates/apply');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { templateId, reportId, company, title, description, mergeStrategy } = body;
    
    // Validate required fields
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return sendError(req, 'Valid template ID is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Find the template
    const template = await ReportTemplate.findById(templateId).lean();
    
    if (!template) {
      return sendError(req, 'Template not found', 404);
    }
    
    // Check if user has access to this template
    const isAdmin = user.role === 'admin';
    const isTemplateOwner = template.createdBy.toString() === user.userId;
    const isSharedWithUser = template.sharedWith?.some((id: any) => id.toString() === user.userId);
    const isGlobal = template.isGlobal;
    
    if (!isAdmin && !isTemplateOwner && !isSharedWithUser && !isGlobal) {
      return sendError(req, 'You do not have access to this template', 403);
    }
    
    // Determine if we're creating a new report or updating an existing one
    let report;
    let action = AuditActions.CREATE;
    
    if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
      // Updating an existing report
      report = await Report.findById(reportId);
      
      if (!report) {
        return sendError(req, 'Report not found', 404);
      }
      
      // Check if user has permission to update this report
      const isReportOwner = report.generatedBy.toString() === user.userId;
      const isEditor = report.editors?.some((id: any) => id.toString() === user.userId);
      
      if (!isAdmin && !isReportOwner && !isEditor) {
        return sendError(req, 'You do not have permission to update this report', 403);
      }
      
      action = AuditActions.UPDATE;
    } else {
      // Creating a new report
      // Validate company
      if (!company || !mongoose.Types.ObjectId.isValid(company)) {
        return sendError(req, 'Valid company ID is required when creating a new report', 400);
      }
      
      // Validate title
      if (!title || title.trim().length === 0) {
        return sendError(req, 'Report title is required when creating a new report', 400);
      }
      
      report = new Report({
        title,
        description: description || '',
        company: new mongoose.Types.ObjectId(company),
        generatedBy: user.userId,
        createdAt: new Date(),
        status: 'draft',
        sections: [],
        metadata: {
          templateId: template._id,
          templateName: template.name,
          appliedAt: new Date()
        }
      });
    }
    
    // Apply template sections based on merge strategy
    const strategy = mergeStrategy || 'replace';
    
    if (strategy === 'replace') {
      // Replace all sections with template sections
      report.sections = template.sections.map((section: any) => ({
        ...section,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        createdBy: user.userId
      }));
    } else if (strategy === 'append') {
      // Append template sections to existing sections
      const maxOrder = report.sections.length > 0 
        ? Math.max(...report.sections.map((s: any) => s.order || 0)) 
        : 0;
      
      const newSections = template.sections.map((section: any, index: number) => ({
        ...section,
        _id: new mongoose.Types.ObjectId(),
        order: maxOrder + index + 1,
        createdAt: new Date(),
        createdBy: user.userId
      }));
      
      report.sections = [...report.sections, ...newSections];
    } else if (strategy === 'merge') {
      // Merge template sections with existing sections by type
      const existingSectionsByType: { [key: string]: any } = {};
      report.sections.forEach((section: any) => {
        if (section.type) {
          existingSectionsByType[section.type] = section;
        }
      });
      
      // Create a new sections array
      const newSections = [...report.sections];
      
      // Process template sections
      template.sections.forEach((templateSection: any) => {
        if (templateSection.type && existingSectionsByType[templateSection.type]) {
          // Update existing section of the same type
          const existingSection = existingSectionsByType[templateSection.type];
          const existingSectionIndex = newSections.findIndex(
            (s: any) => s._id.toString() === existingSection._id.toString()
          );
          
          if (existingSectionIndex !== -1) {
            // Merge data
            newSections[existingSectionIndex] = {
              ...existingSection,
              title: templateSection.title || existingSection.title,
              content: templateSection.content || existingSection.content,
              data: {
                ...(existingSection.data || {}),
                ...(templateSection.data || {})
              },
              lastModified: new Date(),
              lastModifiedBy: user.userId
            };
          }
        } else {
          // Add new section
          newSections.push({
            ...templateSection,
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            createdBy: user.userId
          });
        }
      });
      
      // Update report sections
      report.sections = newSections;
    }
    
    // Update report metadata
    if (!report.metadata) {
      report.metadata = {};
    }
    
    report.metadata.lastTemplateId = template._id;
    report.metadata.lastTemplateName = template.name;
    report.metadata.lastTemplateAppliedAt = new Date();
    
    // Update report timestamps
    report.lastModified = new Date();
    report.lastModifiedBy = user.userId;
    
    // Save the report
    await report.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action,
      entityType: EntityTypes.REPORT,
      entityId: report._id.toString(),
      details: { 
        reportId: report._id.toString(),
        templateId,
        mergeStrategy: strategy,
        action: reportId ? 'updated' : 'created'
      },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        report: formatDocument(report),
        appliedTemplate: {
          id: template._id,
          name: template.name
        },
        mergeStrategy: strategy
      },
      reportId ? 'Template applied to existing report successfully' : 'New report created from template successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates/apply', error);
    return sendError(
      req, 
      `Error applying template: ${(error as Error).message}`, 
      500
    );
  }
});
