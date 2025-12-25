import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
import Assessment from '@/models/Assessment';
import Questionnaire from '@/models/Questionnaire';
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

// Get questionnaire responses
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

    // Get questionnaire responses for this assessment
    const responses = await QuestionnaireResponse.find({ assessment: assessmentId })
      .populate('questionnaire', 'title version')
      .populate('respondent', 'username firstName lastName')
      .sort({ createdAt: -1 });

    return NextResponse.json({ responses });
  } catch (error) {
    console.error('Error fetching questionnaire responses:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new questionnaire response
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const responseData = await req.json();

    // Validate required fields
    if (!responseData.assessment || !responseData.questionnaire) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if assessment exists
    const assessment = await Assessment.findById(responseData.assessment);
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

    // Check if questionnaire exists
    const questionnaire = await Questionnaire.findById(responseData.questionnaire);
    if (!questionnaire) {
      return NextResponse.json(
        { message: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Check if a response already exists for this assessment and questionnaire
    const existingResponse = await QuestionnaireResponse.findOne({
      assessment: responseData.assessment,
      questionnaire: responseData.questionnaire
    });
    
    if (existingResponse) {
      return NextResponse.json(
        { message: 'A response for this assessment and questionnaire already exists', existingResponseId: existingResponse._id },
        { status: 409 }
      );
    }

    // Create the questionnaire response
    const questionnaireResponse = new QuestionnaireResponse({
      ...responseData,
      respondent: user.userId,
      status: 'in_progress',
      startedAt: new Date(),
      lastSavedAt: new Date(),
      sections: responseData.sections || []
    });
    
    await questionnaireResponse.save();

    // Update assessment stage if needed
    if (assessment.currentStage === 1) {
      assessment.currentStage = 2;
      assessment.status = 'in_progress';
      await assessment.save();
    }

    return NextResponse.json(
      { message: 'Questionnaire response created successfully', response: questionnaireResponse },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating questionnaire response:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
