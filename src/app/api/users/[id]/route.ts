import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { withAuthAppRouter, withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Get a specific user (admin only or self)
export const GET = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const userId = req.url.split('/').pop();
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check if user is requesting their own profile or is an admin
    if (userId !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized to access this user profile' },
        { status: 403 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDoc = await User.findById(userId)
      .select('-password')
      .populate('assignedCompanies', 'name industry');
      
    if (!userDoc) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: userDoc });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Update a user (admin only or self with restrictions)
export const PUT = withAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const userId = req.url.split('/').pop();
    const updateData = await req.json();
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isSelf = userId === user.userId;
    const isAdmin = user.role === 'admin';
    
    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { message: 'Unauthorized to update this user' },
        { status: 403 }
      );
    }

    // Non-admin users can only update certain fields of their own profile
    if (isSelf && !isAdmin) {
      // Only allow these fields to be updated by non-admin users
      const allowedFields = ['firstName', 'lastName', 'email', 'password', 'currentPassword'];
      
      // Filter out fields that are not allowed
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
      
      // If changing password, verify current password
      if (updateData.password) {
        if (!updateData.currentPassword) {
          return NextResponse.json(
            { message: 'Current password is required to set a new password' },
            { status: 400 }
          );
        }
        
        const isPasswordValid = await userDoc.comparePassword(updateData.currentPassword);
        if (!isPasswordValid) {
          return NextResponse.json(
            { message: 'Current password is incorrect' },
            { status: 401 }
          );
        }
        
        // Remove currentPassword from updateData
        delete updateData.currentPassword;
      }
    }

    // Check if username or email is being changed and if it already exists
    if (updateData.username && updateData.username !== userDoc.username) {
      const existingUser = await User.findOne({ username: updateData.username });
      if (existingUser) {
        return NextResponse.json(
          { message: 'Username already exists' },
          { status: 409 }
        );
      }
    }
    
    if (updateData.email && updateData.email !== userDoc.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        return NextResponse.json(
          { message: 'Email already exists' },
          { status: 409 }
        );
      }
    }

    // Validate role if being updated
    if (updateData.role && !['admin', 'user'].includes(updateData.role)) {
      return NextResponse.json(
        { message: 'Invalid role. Role must be either "admin" or "user"' },
        { status: 400 }
      );
    }

    // Update the user
    Object.keys(updateData).forEach(key => {
      // Special handling for password
      if (key === 'password') {
        userDoc.password = updateData.password;
      } else if (key !== '_id') {
        userDoc[key] = updateData[key];
      }
    });
    
    await userDoc.save();

    // Return user without password
    const userResponse = userDoc.toObject();
    delete userResponse.password;

    return NextResponse.json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Delete a user (admin only)
export const DELETE = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const userId = req.url.split('/').pop();
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Prevent deleting self
    if (userId === user.userId) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Find the user
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return NextResponse.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
});
