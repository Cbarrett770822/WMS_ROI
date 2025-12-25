import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ROICalculation from '@/models/ROICalculation';
import Assessment from '@/models/Assessment';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
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

// Get ROI calculations
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

    // Get ROI calculations for this assessment
    const calculations = await ROICalculation.find({ assessment: assessmentId })
      .populate('createdBy', 'username firstName lastName')
      .sort({ createdAt: -1 });

    return NextResponse.json({ calculations });
  } catch (error) {
    console.error('Error fetching ROI calculations:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new ROI calculation
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const calculationData = await req.json();

    // Validate required fields
    if (!calculationData.assessment) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if assessment exists
    const assessment = await Assessment.findById(calculationData.assessment);
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

    // Check if questionnaire response exists and is completed
    const questionnaireResponse = await QuestionnaireResponse.findOne({
      assessment: calculationData.assessment,
      status: 'completed'
    });
    
    if (!questionnaireResponse) {
      return NextResponse.json(
        { message: 'No completed questionnaire response found for this assessment' },
        { status: 400 }
      );
    }

    // Create the ROI calculation
    const roiCalculation = new ROICalculation({
      ...calculationData,
      createdBy: user.userId,
      status: 'draft',
      questionnaireResponse: questionnaireResponse._id,
      calculatedAt: new Date()
    });
    
    await roiCalculation.save();

    // Update assessment stage if needed
    if (assessment.currentStage === 3) {
      assessment.currentStage = 4; // Move to recommendations stage
      await assessment.save();
    }

    return NextResponse.json(
      { message: 'ROI calculation created successfully', calculation: roiCalculation },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating ROI calculation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
