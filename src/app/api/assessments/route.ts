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

// Get all assessments (filtered by user access)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const warehouseId = url.searchParams.get('warehouseId');
    const status = url.searchParams.get('status');
    
    // Connect to the database
    await connectToDatabase();

    let query: any = {};
    
    // Filter by company if provided
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return NextResponse.json(
          { message: 'Invalid company ID' },
          { status: 400 }
        );
      }
      
      // Check if user has access to this company
      const hasAccess = await hasCompanyAccess(user.userId, companyId, user.role === 'admin');
      if (!hasAccess) {
        return NextResponse.json(
          { message: 'You do not have access to this company' },
          { status: 403 }
        );
      }
      
      query.company = companyId;
    } else {
      // If no company filter, limit to companies the user has access to
      if (user.role !== 'admin') {
        const userDoc = await User.findById(user.userId);
        if (!userDoc) {
          return NextResponse.json(
            { message: 'User not found' },
            { status: 404 }
          );
        }
        
        query.company = { $in: userDoc.assignedCompanies };
      }
    }
    
    // Filter by warehouse if provided
    if (warehouseId) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        return NextResponse.json(
          { message: 'Invalid warehouse ID' },
          { status: 400 }
        );
      }
      
      query.warehouse = warehouseId;
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by user assignment if not admin
    if (user.role !== 'admin') {
      query.$or = [
        { createdBy: user.userId },
        { assignedTo: user.userId }
      ];
    }

    // Get assessments
    const assessments = await Assessment.find(query)
      .populate('company', 'name')
      .populate('warehouse', 'name')
      .populate('createdBy', 'username firstName lastName')
      .populate('assignedTo', 'username firstName lastName')
      .sort({ createdAt: -1 });

    return NextResponse.json({ assessments });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new assessment
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const assessmentData = await req.json();

    // Validate required fields
    if (!assessmentData.name || !assessmentData.company || !assessmentData.warehouse) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if company exists
    const company = await Company.findById(assessmentData.company);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this company
    const hasAccess = await hasCompanyAccess(user.userId, assessmentData.company, user.role === 'admin');
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this company' },
        { status: 403 }
      );
    }

    // Check if warehouse exists and belongs to the company
    const warehouse = await Warehouse.findOne({
      _id: assessmentData.warehouse,
      company: assessmentData.company
    });
    
    if (!warehouse) {
      return NextResponse.json(
        { message: 'Warehouse not found or does not belong to the specified company' },
        { status: 404 }
      );
    }

    // Create the assessment
    const assessment = new Assessment({
      ...assessmentData,
      createdBy: user.userId,
      assignedTo: assessmentData.assignedTo || [user.userId],
      status: 'draft',
      startDate: new Date(),
      currentStage: 1,
      totalStages: 5
    });
    
    await assessment.save();

    return NextResponse.json(
      { message: 'Assessment created successfully', assessment },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating assessment:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
