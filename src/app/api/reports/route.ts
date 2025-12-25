import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Report from '@/models/Report';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
import Recommendation from '@/models/Recommendation';
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

// Get reports
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const assessmentId = url.searchParams.get('assessmentId');
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid or missing assessment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this assessment' },
        { status: 403 }
      );
    }

    // Get reports for this assessment
    const reports = await Report.find({ assessment: assessmentId })
      .populate('assessment', 'name')
      .populate('roiCalculation')
      .populate('createdBy', 'username firstName lastName')
      .sort({ createdAt: -1 });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new report
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const reportData = await req.json();

    // Validate required fields
    if (!reportData.assessment || !reportData.roiCalculation || !reportData.title) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if assessment exists
    const assessment = await Assessment.findById(reportData.assessment);
    if (!assessment) {
      return NextResponse.json(
        { message: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this assessment' },
        { status: 403 }
      );
    }

    // Check if ROI calculation exists and belongs to the assessment
    const roiCalculation = await ROICalculation.findOne({
      _id: reportData.roiCalculation,
      assessment: reportData.assessment
    });
    
    if (!roiCalculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found or does not belong to the specified assessment' },
        { status: 404 }
      );
    }

    // Get recommendations for this assessment and ROI calculation
    const recommendations = await Recommendation.find({
      assessment: reportData.assessment,
      roiCalculation: reportData.roiCalculation
    }).sort({ priority: 1 });

    // Create the report
    const report = new Report({
      ...reportData,
      createdBy: user.userId,
      createdAt: new Date(),
      recommendations: recommendations.map(rec => rec._id),
      status: 'draft'
    });
    
    await report.save();

    // Update assessment status if needed
    if (assessment.currentStage === 5) {
      assessment.status = 'completed';
      assessment.completionDate = new Date();
      await assessment.save();
    }

    return NextResponse.json(
      { message: 'Report created successfully', report },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
