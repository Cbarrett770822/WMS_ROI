import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Recommendation from '@/models/Recommendation';
import Assessment from '@/models/Assessment';
import ROICalculation from '@/models/ROICalculation';
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

// Get recommendations
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const assessmentId = url.searchParams.get('assessmentId');
    const roiCalculationId = url.searchParams.get('roiCalculationId');
    
    if ((!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) && 
        (!roiCalculationId || !mongoose.Types.ObjectId.isValid(roiCalculationId))) {
      return NextResponse.json(
        { message: 'Invalid or missing assessment ID or ROI calculation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    let assessment;
    let query: any = {};
    
    if (assessmentId) {
      // Find the assessment
      assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        return NextResponse.json(
          { message: 'Assessment not found' },
          { status: 404 }
        );
      }
      
      query.assessment = assessmentId;
    } else if (roiCalculationId) {
      // Find the ROI calculation
      const roiCalculation = await ROICalculation.findById(roiCalculationId);
      if (!roiCalculation) {
        return NextResponse.json(
          { message: 'ROI calculation not found' },
          { status: 404 }
        );
      }
      
      assessment = await Assessment.findById(roiCalculation.assessment);
      if (!assessment) {
        return NextResponse.json(
          { message: 'Assessment not found' },
          { status: 404 }
        );
      }
      
      query.roiCalculation = roiCalculationId;
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

    // Get recommendations
    const recommendations = await Recommendation.find(query)
      .populate('assessment', 'name')
      .populate('roiCalculation')
      .populate('createdBy', 'username firstName lastName')
      .sort({ priority: 1, createdAt: -1 });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new recommendation
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const recommendationData = await req.json();

    // Validate required fields
    if (!recommendationData.assessment || !recommendationData.roiCalculation || 
        !recommendationData.title || !recommendationData.description || 
        !recommendationData.category || !recommendationData.priority) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if assessment exists
    const assessment = await Assessment.findById(recommendationData.assessment);
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
      _id: recommendationData.roiCalculation,
      assessment: recommendationData.assessment
    });
    
    if (!roiCalculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found or does not belong to the specified assessment' },
        { status: 404 }
      );
    }

    // Create the recommendation
    const recommendation = new Recommendation({
      ...recommendationData,
      createdBy: user.userId,
      createdAt: new Date()
    });
    
    await recommendation.save();

    return NextResponse.json(
      { message: 'Recommendation created successfully', recommendation },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating recommendation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
