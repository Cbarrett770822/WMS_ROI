import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import ReportTemplate from '@/models/ReportTemplate';
import { withAuthAppRouter } from '@/lib/auth';
import { sendSuccess, sendError, formatDocument, logApiRequest, logApiError } from '@/lib/apiResponse';
import mongoose from 'mongoose';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';

/**
 * Get all report templates or create a new template
 */
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    const includeGlobal = url.searchParams.get('includeGlobal') !== 'false';
    
    logApiRequest(req, 'api/reports/templates');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Build query
    const query: any = {};
    
    // Filter by company if provided
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      query.company = new mongoose.Types.ObjectId(companyId);
    }
    
    // Filter by access
    const isAdmin = user.role === 'admin';
    
    if (!isAdmin) {
      // Regular users can see:
      // 1. Templates they created
      // 2. Templates shared with them
      // 3. Global templates (if includeGlobal is true)
      const accessQuery = [
        { createdBy: new mongoose.Types.ObjectId(user.userId) },
        { sharedWith: new mongoose.Types.ObjectId(user.userId) }
      ];
      
      if (includeGlobal) {
        accessQuery.push({ isGlobal: true });
      }
      
      query.$or = accessQuery;
    }
    
    // Get templates
    const templates = await ReportTemplate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination
    const totalCount = await ReportTemplate.countDocuments(query);
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: 'multiple',
      details: { companyId, includeGlobal },
      request: req
    });
    
    return sendSuccess(
      req,
      {
        templates: formatDocument(templates),
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + limit < totalCount
        }
      },
      'Report templates retrieved successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates', error);
    return sendError(
      req, 
      `Error retrieving report templates: ${(error as Error).message}`, 
      500
    );
  }
});

/**
 * Create a new report template
 */
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    logApiRequest(req, 'api/reports/templates');
    
    if (!user) {
      return sendError(req, 'Authentication required', 401);
    }
    
    // Parse request body
    const body = await req.json();
    const { name, description, company, sections, isGlobal, baseReportId } = body;
    
    // Validate required fields
    if (!name || name.trim().length === 0) {
      return sendError(req, 'Template name is required', 400);
    }
    
    // Connect to the database
    await connectToDatabase();
    
    // Check if company exists if provided
    if (company && !mongoose.Types.ObjectId.isValid(company)) {
      return sendError(req, 'Invalid company ID', 400);
    }
    
    // Check if user can create global templates
    if (isGlobal && user.role !== 'admin') {
      return sendError(req, 'Only administrators can create global templates', 403);
    }
    
    // If baseReportId is provided, use it to create a template
    let templateData: any = {
      name,
      description: description || '',
      createdBy: user.userId,
      createdAt: new Date(),
      isGlobal: isGlobal || false,
      sections: sections || []
    };
    
    // Add company if provided
    if (company) {
      templateData.company = new mongoose.Types.ObjectId(company);
    }
    
    // If baseReportId is provided, use the report as a base for the template
    if (baseReportId && mongoose.Types.ObjectId.isValid(baseReportId)) {
      const baseReport = await Report.findById(baseReportId).lean();
      
      if (!baseReport) {
        return sendError(req, 'Base report not found', 404);
      }
      
      // Check if user has access to the base report
      const isReportAdmin = user.role === 'admin';
      const isReportOwner = baseReport.generatedBy.toString() === user.userId;
      const isSharedWithUser = baseReport.sharedWith?.some((id: any) => id.toString() === user.userId);
      const isReportPublic = baseReport.isPublic;
      
      if (!isReportAdmin && !isReportOwner && !isSharedWithUser && !isReportPublic) {
        return sendError(req, 'You do not have access to the base report', 403);
      }
      
      // Use sections from the base report if no sections were provided
      if (!sections || sections.length === 0) {
        templateData.sections = baseReport.sections.map((section: any) => ({
          title: section.title,
          type: section.type,
          content: section.content,
          data: section.data,
          order: section.order
        }));
      }
      
      // Use company from the base report if no company was provided
      if (!company && baseReport.company) {
        templateData.company = baseReport.company;
      }
    }
    
    // Create the template
    const template = new ReportTemplate(templateData);
    await template.save();
    
    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.REPORT_TEMPLATE,
      entityId: template._id.toString(),
      details: { 
        templateId: template._id.toString(),
        name,
        isGlobal,
        baseReportId
      },
      request: req
    });
    
    return sendSuccess(
      req,
      formatDocument(template),
      'Report template created successfully'
    );
  } catch (error) {
    logApiError('api/reports/templates', error);
    return sendError(
      req, 
      `Error creating report template: ${(error as Error).message}`, 
      500
    );
  }
});
