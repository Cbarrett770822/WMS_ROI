import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Warehouse from '@/models/Warehouse';
import Company from '@/models/Company';
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

// Get a specific warehouse
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const warehouseId = req.url.split('/').pop();
    
    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return NextResponse.json(
        { message: 'Invalid warehouse ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the warehouse
    const warehouse = await Warehouse.findById(warehouseId)
      .populate('company', 'name industry');
      
    if (!warehouse) {
      return NextResponse.json(
        { message: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this warehouse's company
    const hasAccess = await hasCompanyAccess(
      user.userId, 
      warehouse.company._id.toString(), 
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this warehouse' },
        { status: 403 }
      );
    }

    return NextResponse.json({ warehouse });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a warehouse
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const warehouseId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return NextResponse.json(
        { message: 'Invalid warehouse ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the warehouse
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      return NextResponse.json(
        { message: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this warehouse's company
    const hasAccess = await hasCompanyAccess(
      user.userId, 
      warehouse.company.toString(), 
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this warehouse' },
        { status: 403 }
      );
    }

    // If company is being changed, check if user has access to the new company
    if (updateData.company && updateData.company !== warehouse.company.toString()) {
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

    // Check for name conflicts if name is being updated
    if (updateData.name && updateData.name !== warehouse.name) {
      const companyId = updateData.company || warehouse.company;
      
      const existingWarehouse = await Warehouse.findOne({ 
        name: updateData.name,
        company: companyId,
        _id: { $ne: warehouseId }
      });
      
      if (existingWarehouse) {
        return NextResponse.json(
          { message: 'A warehouse with this name already exists for this company' },
          { status: 409 }
        );
      }
    }

    // Update the warehouse
    Object.assign(warehouse, updateData);
    await warehouse.save();

    return NextResponse.json({
      message: 'Warehouse updated successfully',
      warehouse
    });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a warehouse
export const DELETE = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const warehouseId = req.url.split('/').pop();
    
    if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
      return NextResponse.json(
        { message: 'Invalid warehouse ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the warehouse
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      return NextResponse.json(
        { message: 'Warehouse not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this warehouse's company
    const hasAccess = await hasCompanyAccess(
      user.userId, 
      warehouse.company.toString(), 
      user.role === 'admin'
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this warehouse' },
        { status: 403 }
      );
    }

    // Only admin can delete warehouses
    if (user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Only administrators can delete warehouses' },
        { status: 403 }
      );
    }

    // Delete the warehouse
    await Warehouse.findByIdAndDelete(warehouseId);

    return NextResponse.json({
      message: 'Warehouse deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
