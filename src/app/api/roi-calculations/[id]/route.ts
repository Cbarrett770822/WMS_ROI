import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ROICalculation from '@/models/ROICalculation';
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

// Get a specific ROI calculation
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const calculationId = req.url.split('/').pop();
    
    if (!calculationId || !mongoose.Types.ObjectId.isValid(calculationId)) {
      return NextResponse.json(
        { message: 'Invalid ROI calculation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the ROI calculation
    const calculation = await ROICalculation.findById(calculationId)
      .populate({
        path: 'assessment',
        populate: [
          { path: 'company', select: 'name industry' },
          { path: 'warehouse', select: 'name type size location' }
        ]
      })
      .populate('questionnaireResponse')
      .populate('createdBy', 'username firstName lastName');
      
    if (!calculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      calculation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this ROI calculation' },
        { status: 403 }
      );
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('Error fetching ROI calculation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a ROI calculation
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const calculationId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!calculationId || !mongoose.Types.ObjectId.isValid(calculationId)) {
      return NextResponse.json(
        { message: 'Invalid ROI calculation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the ROI calculation
    const calculation = await ROICalculation.findById(calculationId)
      .populate('assessment');
      
    if (!calculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      calculation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this ROI calculation' },
        { status: 403 }
      );
    }

    // Update the calculation
    if (updateData.financialMetrics) {
      calculation.financialMetrics = updateData.financialMetrics;
    }
    
    if (updateData.operationalMetrics) {
      calculation.operationalMetrics = updateData.operationalMetrics;
    }
    
    if (updateData.categoryScores) {
      calculation.categoryScores = updateData.categoryScores;
    }
    
    if (updateData.status) {
      calculation.status = updateData.status;
      
      // If status is being set to finalized, update assessment stage
      if (updateData.status === 'finalized' && calculation.status !== 'finalized') {
        const assessment = await Assessment.findById(calculation.assessment._id);
        if (assessment && assessment.currentStage === 4) {
          assessment.currentStage = 5; // Move to report generation stage
          await assessment.save();
        }
      }
    }
    
    // Always update lastModifiedAt
    calculation.lastModifiedAt = new Date();
    
    await calculation.save();

    return NextResponse.json({
      message: 'ROI calculation updated successfully',
      calculation
    });
  } catch (error) {
    console.error('Error updating ROI calculation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a ROI calculation
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const calculationId = req.url.split('/').pop();
    
    if (!calculationId || !mongoose.Types.ObjectId.isValid(calculationId)) {
      return NextResponse.json(
        { message: 'Invalid ROI calculation ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the ROI calculation
    const calculation = await ROICalculation.findById(calculationId)
      .populate('assessment');
      
    if (!calculation) {
      return NextResponse.json(
        { message: 'ROI calculation not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the associated assessment
    const hasAccess = await hasAssessmentAccess(
      user.userId,
      calculation.assessment,
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this ROI calculation' },
        { status: 403 }
      );
    }

    // Only admin or the creator can delete ROI calculations
    if (user.role !== 'admin' && calculation.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can delete ROI calculations' },
        { status: 403 }
      );
    }

    // Delete the ROI calculation
    await ROICalculation.findByIdAndDelete(calculationId);

    return NextResponse.json({
      message: 'ROI calculation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ROI calculation:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
