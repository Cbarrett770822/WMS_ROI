import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Recommendation from '@/models/Recommendation';
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

// Get a specific recommendation
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const recommendationId = req.url.split('/').pop();
    
    if (!recommendationId || !mongoose.Types.ObjectId.isValid(recommendationId)) {
      return NextResponse.json(
        { message: 'Invalid recommendation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the recommendation
    const recommendation = await Recommendation.findById(recommendationId)
      .populate({
        path: 'assessment',
        populate: [
          { path: 'company', select: 'name industry' },
          { path: 'warehouse', select: 'name type size location' }
        ]
      })
      .populate('roiCalculation')
      .populate('createdBy', 'username firstName lastName');
      
    if (!recommendation) {
      return NextResponse.json(
        { message: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      recommendation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this recommendation' },
        { status: 403 }
      );
    }

    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a recommendation
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const recommendationId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!recommendationId || !mongoose.Types.ObjectId.isValid(recommendationId)) {
      return NextResponse.json(
        { message: 'Invalid recommendation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the recommendation
    const recommendation = await Recommendation.findById(recommendationId)
      .populate('assessment');
      
    if (!recommendation) {
      return NextResponse.json(
        { message: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      recommendation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this recommendation' },
        { status: 403 }
      );
    }

    // Only admin or creator can update recommendations
    if (user.role !== 'admin' && recommendation.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can update recommendations' },
        { status: 403 }
      );
    }

    // Update the recommendation
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'assessment' && key !== 'roiCalculation' && key !== 'createdBy' && key !== 'createdAt') {
        recommendation[key] = updateData[key];
      }
    });
    
    // Update lastModifiedAt
    recommendation.lastModifiedAt = new Date();
    
    await recommendation.save();

    return NextResponse.json({
      message: 'Recommendation updated successfully',
      recommendation
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a recommendation
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const recommendationId = req.url.split('/').pop();
    
    if (!recommendationId || !mongoose.Types.ObjectId.isValid(recommendationId)) {
      return NextResponse.json(
        { message: 'Invalid recommendation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the recommendation
    const recommendation = await Recommendation.findById(recommendationId)
      .populate('assessment');
      
    if (!recommendation) {
      return NextResponse.json(
        { message: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      recommendation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this recommendation' },
        { status: 403 }
      );
    }

    // Only admin or the creator can delete recommendations
    if (user.role !== 'admin' && recommendation.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can delete recommendations' },
        { status: 403 }
      );
    }

    // Delete the recommendation
    await Recommendation.findByIdAndDelete(recommendationId);

    return NextResponse.json({
      message: 'Recommendation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
