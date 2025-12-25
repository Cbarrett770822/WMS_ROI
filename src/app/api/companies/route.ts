import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Company from '@/models/Company';
import User from '@/models/User';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';

// Get all companies (filtered by user access)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Connect to the database
    await connectToDatabase();

    let companies;

    // Admin can see all companies
    if (user.role === 'admin') {
      companies = await Company.find({}).sort({ name: 1 });
    } else {
      // Regular users can only see assigned companies
      const userDoc = await User.findById(user.userId);
      if (!userDoc) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }
      
      companies = await Company.find({
        _id: { $in: userDoc.assignedCompanies }
      }).sort({ name: 1 });
    }

    return NextResponse.json({ companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new company (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const companyData = await req.json();

    // Validate required fields
    if (!companyData.name || !companyData.industry || !companyData.size || !companyData.contactName || !companyData.contactEmail) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if company with same name already exists
    const existingCompany = await Company.findOne({ name: companyData.name });
    if (existingCompany) {
      return NextResponse.json(
        { message: 'A company with this name already exists' },
        { status: 409 }
      );
    }

    // Create the company
    const company = new Company(companyData);
    await company.save();

    return NextResponse.json(
      { message: 'Company created successfully', company },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
