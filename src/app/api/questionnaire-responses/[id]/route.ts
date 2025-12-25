import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
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

// Get a specific questionnaire response
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const responseId = req.url.split('/').pop();
    
    if (!responseId || !mongoose.Types.ObjectId.isValid(responseId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire response ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire response
    const response = await QuestionnaireResponse.findById(responseId)
      .populate('assessment')
      .populate('questionnaire', 'title version sections')
      .populate('respondent', 'username firstName lastName');
      
    if (!response) {
      return NextResponse.json(
        { message: 'Questionnaire response not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      response.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this questionnaire response' },
        { status: 403 }
      );
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error fetching questionnaire response:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a questionnaire response
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const responseId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!responseId || !mongoose.Types.ObjectId.isValid(responseId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire response ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire response
    const response = await QuestionnaireResponse.findById(responseId)
      .populate('assessment');
      
    if (!response) {
      return NextResponse.json(
        { message: 'Questionnaire response not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      response.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this questionnaire response' },
        { status: 403 }
      );
    }

    // Update the response
    if (updateData.sections) {
      response.sections = updateData.sections;
    }
    
    if (updateData.status) {
      response.status = updateData.status;
      
      // If status is being set to completed, set completedAt
      if (updateData.status === 'completed' && response.status !== 'completed') {
        response.completedAt = new Date();
        
        // Update assessment stage if needed
        const assessment = await Assessment.findById(response.assessment._id);
        if (assessment && assessment.currentStage === 2) {
          assessment.currentStage = 3; // Move to ROI calculation stage
          await assessment.save();
        }
      }
    }
    
    // Always update lastSavedAt
    response.lastSavedAt = new Date();
    
    await response.save();

    return NextResponse.json({
      message: 'Questionnaire response updated successfully',
      response
    });
  } catch (error) {
    console.error('Error updating questionnaire response:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a questionnaire response
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const responseId = req.url.split('/').pop();
    
    if (!responseId || !mongoose.Types.ObjectId.isValid(responseId)) {
      return NextResponse.json(
        { message: 'Invalid questionnaire response ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the questionnaire response
    const response = await QuestionnaireResponse.findById(responseId)
      .populate('assessment');
      
    if (!response) {
      return NextResponse.json(
        { message: 'Questionnaire response not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      response.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this questionnaire response' },
        { status: 403 }
      );
    }

    // Only admin or the respondent can delete responses
    if (user.role !== 'admin' && response.respondent.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the respondent can delete questionnaire responses' },
        { status: 403 }
      );
    }

    // Delete the questionnaire response
    await QuestionnaireResponse.findByIdAndDelete(responseId);

    return NextResponse.json({
      message: 'Questionnaire response deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting questionnaire response:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
