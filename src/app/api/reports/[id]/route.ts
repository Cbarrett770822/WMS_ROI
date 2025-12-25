import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper function to check if user has access to the assessment
async function hasAssessmentAccess(userId: string, assessment: any, isAdmin: boolean) {
  // Admin has access to all assessments
  if (isAdmin) return true;
  
  // Creator has access
  if (assessment.createdBy.toString() === userId) return true;
  
  // Assigned users have access
  if (assessment.assignedTo.some((id: any) => id.toString() === userId)) return true;
  
  return false;
}

// Get a specific report
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').pop();
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report
    const report = await Report.findById(reportId)
      .populate({
        path: 'assessment',
        populate: [
          { path: 'company', select: 'name industry' },
          { path: 'warehouse', select: 'name type size location' }
        ]
      })
      .populate('roiCalculation')
      .populate('recommendations')
      .populate('createdBy', 'username firstName lastName');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      report.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a report
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report
    const report = await Report.findById(reportId)
      .populate('assessment');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      report.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }

    // Only admin or creator can update reports
    if (user.role !== 'admin' && report.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can update reports' },
        { status: 403 }
      );
    }

    // Update the report
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'assessment' && key !== 'roiCalculation' && key !== 'createdBy' && key !== 'createdAt') {
        report[key] = updateData[key];
      }
    });
    
    // Update lastModifiedAt
    report.lastModifiedAt = new Date();
    
    await report.save();

    return NextResponse.json({
      message: 'Report updated successfully',
      report
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a report
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportId = req.url.split('/').pop();
    
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json(
        { message: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the report
    const report = await Report.findById(reportId)
      .populate('assessment');
      
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      report.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this report' },
        { status: 403 }
      );
    }

    // Only admin or the creator can delete reports
    if (user.role !== 'admin' && report.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can delete reports' },
        { status: 403 }
      );
    }

    // Delete the report
    await Report.findByIdAndDelete(reportId);

    return NextResponse.json({
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
