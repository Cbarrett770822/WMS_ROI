import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Warehouse from '@/models/Warehouse';
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
    (id) => id.toString() === companyId.toString()
  );
}

// Get all warehouses (filtered by user access)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    
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

    // Get warehouses
    const warehouses = await Warehouse.find(query)
      .populate('company', 'name industry')
      .sort({ name: 1 });

    return NextResponse.json({ warehouses });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Create a new warehouse
export const POST = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const warehouseData = await req.json();

    // Validate required fields
    if (!warehouseData.name || !warehouseData.company || !warehouseData.type || !warehouseData.size || !warehouseData.ownership) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!warehouseData.location || !warehouseData.location.address || !warehouseData.location.city || 
        !warehouseData.location.state || !warehouseData.location.zipCode || !warehouseData.location.country) {
      return NextResponse.json(
        { message: 'Missing required location fields' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Check if company exists
    const company = await Company.findById(warehouseData.company);
    if (!company) {
      return NextResponse.json(
        { message: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this company
    const hasAccess = await hasCompanyAccess(user.userId, warehouseData.company, user.role === 'admin');
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this company' },
        { status: 403 }
      );
    }

    // Check if warehouse with same name already exists for this company
    const existingWarehouse = await Warehouse.findOne({ 
      name: warehouseData.name,
      company: warehouseData.company
    });
    
    if (existingWarehouse) {
      return NextResponse.json(
        { message: 'A warehouse with this name already exists for this company' },
        { status: 409 }
      );
    }

    // Create the warehouse
    const warehouse = new Warehouse(warehouseData);
    await warehouse.save();

    return NextResponse.json(
      { message: 'Warehouse created successfully', warehouse },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
