import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ReportTemplate from '@/models/ReportTemplate';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get a specific report template
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').pop();
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid report template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report template
    const template = await ReportTemplate.findById(templateId)
      .populate('createdBy', 'username firstName lastName');
      
    if (!template) {
      return NextResponse.json(
        { message: 'Report template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching report template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a report template (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid report template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report template
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return NextResponse.json(
        { message: 'Report template not found' },
        { status: 404 }
      );
    }

    // Validate sections structure if provided
    if (updateData.sections && (!Array.isArray(updateData.sections) || updateData.sections.length === 0)) {
      return NextResponse.json(
        { message: 'Report template must have at least one section' },
        { status: 400 }
      );
    }

    // If name or type is being changed, check for conflicts
    if ((updateData.name && updateData.name !== template.name) || 
        (updateData.type && updateData.type !== template.type)) {
      
      const existingTemplate = await ReportTemplate.findOne({
        name: updateData.name || template.name,
        type: updateData.type || template.type,
        _id: { $ne: templateId }
      });
      
      if (existingTemplate) {
        return NextResponse.json(
          { message: 'A report template with this name and type already exists' },
          { status: 409 }
        );
      }
    }

    // Update the template
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
        template[key] = updateData[key];
      }
    });
    
    // Update lastModifiedAt
    template.lastModifiedAt = new Date();
    template.lastModifiedBy = user.userId;
    
    await template.save();

    return NextResponse.json({
      message: 'Report template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating report template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a report template (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const templateId = req.url.split('/').pop();
    
    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { message: 'Invalid report template ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report template
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return NextResponse.json(
        { message: 'Report template not found' },
        { status: 404 }
      );
    }

    // Delete the report template
    await ReportTemplate.findByIdAndDelete(templateId);

    return NextResponse.json({
      message: 'Report template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report template:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
