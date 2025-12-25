import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Company from '@/models/Company';
import User from '@/models/User';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper function to check if user has access to the company
async function hasCompanyAccess(userId: string, companyId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  
  const user = await User.findById(userId);
  if (!user) return false;
  
  return user.assignedCompanies.some(
    (id) => id.toString() === companyId
  );
}

// Get a specific company
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').pop();
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if user has access to this company
    const hasAccess = await hasCompanyAccess(user.userId, companyId, user.role === 'admin');
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this company' },
        { status: 403 }
      );
    }

    // Find the company
    const company = await Company.findById(companyId);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a company (admin only)
export const PUT = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the company
    const company = await Company.findById(companyId);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Check for name conflicts if name is being updated
    if (updateData.name && updateData.name !== company.name) {
      const existingCompany = await Company.findOne({ 
        name: updateData.name,
        _id: { $ne: companyId }
      });
      
      if (existingCompany) {
        return NextResponse.json(
          { message: 'A company with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update the company
    Object.assign(company, updateData);
    await company.save();

    return NextResponse.json({
      message: 'Company updated successfully',
      company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a company (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyId = req.url.split('/').pop();
    
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { message: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find and delete the company
    const company = await Company.findByIdAndDelete(companyId);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Remove company from all users' assignedCompanies
    await User.updateMany(
      { assignedCompanies: companyId },
      { $pull: { assignedCompanies: companyId } }
    );

    return NextResponse.json({
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
