import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AssessmentTemplate from '@/models/AssessmentTemplate';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/auditLogger';
import mongoose from 'mongoose';

// Get all assessment templates (admin can see all, users see only published ones)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const industry = url.searchParams.get('industry');
    const warehouseType = url.searchParams.get('warehouseType');
    const status = url.searchParams.get('status');
    const sortField = url.searchParams.get('sortField') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Connect to the database
    await connectToDatabase();

    // Build query
    let query: any = {};

    // Non-admin users can only see published templates
    if (user.role !== 'admin') {
      query.status = 'published';
    } else if (status) {
      // Admin can filter by status
      query.status = status;
    }

    // Apply additional filters
    if (industry) {
      query.targetIndustries = industry;
    }

    if (warehouseType) {
      query.targetWarehouseTypes = warehouseType;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort direction
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = {};
    sortOptions[sortField] = sortDirection;

    // Get templates with pagination
    const templates = await AssessmentTemplate.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username firstName lastName')
      .populate('updatedBy', 'username firstName lastName')
      .lean();

    // Get total count for pagination
    const totalCount = await AssessmentTemplate.countDocuments(query);

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.READ,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      details: { action: 'list-templates', count: templates.length },
      request: req
    });

    // Return templates with pagination info
    return NextResponse.json({
      templates,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching assessment templates:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new assessment template (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateData = await req.json();
    
    // Validate required fields
    if (!templateData.name || !templateData.sections) {
      return NextResponse.json(
        { message: 'Name and sections are required' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if template with same name already exists
    const existingTemplate = await AssessmentTemplate.findOne({ name: templateData.name });
    
    if (existingTemplate) {
      return NextResponse.json(
        { message: 'A template with this name already exists' },
        { status: 409 }
      );
    }

    // Create new template
    const template = new AssessmentTemplate({
      name: templateData.name,
      description: templateData.description || '',
      status: templateData.status || 'draft',
      sections: templateData.sections,
      targetIndustries: templateData.targetIndustries || [],
      targetWarehouseTypes: templateData.targetWarehouseTypes || [],
      targetCompanySizes: templateData.targetCompanySizes || [],
      version: templateData.version || '1.0',
      createdBy: user.userId,
      createdAt: new Date(),
      updatedBy: user.userId,
      updatedAt: new Date()
    });

    // Save template
    await template.save();

    // Log the audit event
    await createAuditLog({
      userId: user.userId,
      action: AuditActions.CREATE,
      entityType: EntityTypes.ASSESSMENT_TEMPLATE,
      entityId: template._id.toString(),
      details: { 
        action: 'create-template', 
        templateName: template.name,
        sectionCount: template.sections.length
      },
      request: req
    });

    // Return success
    return NextResponse.json({
      message: 'Assessment template created successfully',
      template
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating assessment template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
