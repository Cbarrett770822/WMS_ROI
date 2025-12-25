import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all report templates
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const isActive = url.searchParams.get('isActive');
    const type = url.searchParams.get('type');
    
    // Connect to the database
    await connectToDatabase();

    let query: any = {};
    
    // Filter by active status if provided
    if (isActive !== null) {
      query.isActive = isActive === 'true';
    }
    
    // Filter by type if provided
    if (type) {
      query.type = type;
    }

    // Get report templates
    const templates = await ReportTemplate.find(query)
      .populate('createdBy', 'username firstName lastName')
      .sort({ type: 1, name: 1, createdAt: -1 });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching report templates:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new report template (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateData = await req.json();

    // Validate required fields
    if (!templateData.name || !templateData.type || !templateData.sections) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate sections structure
    if (!Array.isArray(templateData.sections) || templateData.sections.length === 0) {
      return NextResponse.json(
        { message: 'Report template must have at least one section' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if template with same name and type already exists
    const existingTemplate = await ReportTemplate.findOne({
      name: templateData.name,
      type: templateData.type
    });
    
    if (existingTemplate) {
      return NextResponse.json(
        { message: 'A report template with this name and type already exists' },
        { status: 409 }
      );
    }

    // Create the report template
    const reportTemplate = new ReportTemplate({
      ...templateData,
      createdBy: user.userId,
      createdAt: new Date(),
      isActive: templateData.isActive !== undefined ? templateData.isActive : true
    });
    
    await reportTemplate.save();

    return NextResponse.json(
      { message: 'Report template created successfully', template: reportTemplate },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating report template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
