import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import User from '@/models/User';
import { withAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper function to check if user has access to the company
async function hasCompanyAccess(userId: string, companyId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  
  const user = await User.findById(userId);
  if (!user) return false;
  
  return user.assignedCompanies.some(
    (id) => id.toString() === companyId.toString()
  );
}

// Helper function to check if user has access to the assessment
async function hasAssessmentAccess(userId: string, assessment: any, isAdmin: boolean) {
  // Admin has access to all assessments
  if (isAdmin) return true;
  
  // Creator has access
  if (assessment.createdBy.toString() === userId) return true;
  
  // Assigned users have access
  if (assessment.assignedTo.some((id: any) => id.toString() === userId)) return true;
  
  // Check company access
  return await hasCompanyAccess(userId, assessment.company.toString(), isAdmin);
}

// Get a specific assessment
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').pop();
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId)
      .populate('company', 'name industry')
      .populate('warehouse', 'name type size location')
      .populate('createdBy', 'username firstName lastName')
      .populate('assignedTo', 'username firstName lastName');
      
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

    return NextResponse.json({ assessment });
  } catch (error) {
    console.error('Error fetching assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update an assessment
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
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

    // If company is being changed, check if user has access to the new company
    if (updateData.company && updateData.company !== assessment.company.toString()) {
      const hasNewCompanyAccess = await hasCompanyAccess(
        user.userId, 
        updateData.company, 
        user.role === 'admin'
      );
      
      if (!hasNewCompanyAccess) {
        return NextResponse.json(
          { message: 'You do not have access to the specified company' },
          { status: 403 }
        );
      }

      // Check if company exists
      const companyExists = await Company.findById(updateData.company);
      if (!companyExists) {
        return NextResponse.json(
          { message: 'Company not found' },
          { status: 404 }
        );
      }
    }

    // If warehouse is being changed, check if it exists and belongs to the company
    if (updateData.warehouse && updateData.warehouse !== assessment.warehouse.toString()) {
      const companyId = updateData.company || assessment.company;
      
      const warehouse = await Warehouse.findOne({
        _id: updateData.warehouse,
        company: companyId
      });
      
      if (!warehouse) {
        return NextResponse.json(
          { message: 'Warehouse not found or does not belong to the specified company' },
          { status: 404 }
        );
      }
    }

    // If status is being changed to completed, set completion date
    if (updateData.status === 'completed' && assessment.status !== 'completed') {
      updateData.completionDate = new Date();
    }

    // Update the assessment
    Object.assign(assessment, updateData);
    await assessment.save();

    return NextResponse.json({
      message: 'Assessment updated successfully',
      assessment
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete an assessment
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentId = req.url.split('/').pop();
    
    if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json(
        { message: 'Invalid assessment ID' },
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

    // Only admin or creator can delete assessments
    if (user.role !== 'admin' && assessment.createdBy.toString() !== user.userId) {
      return NextResponse.json(
        { message: 'Only administrators or the creator can delete assessments' },
        { status: 403 }
      );
    }

    // Delete the assessment
    await Assessment.findByIdAndDelete(assessmentId);

    return NextResponse.json({
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
